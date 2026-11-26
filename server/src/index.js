import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { processDocument } from "./ocr.js";
import { prepareImage } from "./prepare.js";

const app = express();
const port = Number(process.env.PORT || 8787);
const maxUploadBytes = 10 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp"
]);
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "http://localhost:5173,http://127.0.0.1:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const localDevelopmentBypass = process.env.NODE_ENV !== "production" &&
  process.env.LOCAL_DEV_AUTH_BYPASS === "true";
const authClient = supabaseUrl && supabasePublishableKey
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false
      }
    })
  : null;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxUploadBytes, files: 1 }
});

app.disable("x-powered-by");
app.use((request, response, next) => {
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  response.setHeader("Cache-Control", "no-store");
  const origin = request.get("origin");
  const localExtensionOrigin = localDevelopmentBypass && origin?.startsWith("chrome-extension://");
  if (origin && !allowedOrigins.has(origin) && !localExtensionOrigin) {
    return response.status(403).json({ error: "This website is not allowed to use the FormSaathi API." });
  }
  next();
});

app.use(cors({
  origin(origin, callback) {
    const localExtensionOrigin = localDevelopmentBypass && origin?.startsWith("chrome-extension://");
    callback(null, !origin || allowedOrigins.has(origin) || localExtensionOrigin);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 600
}));
app.use(express.json({ limit: "256kb" }));

app.get("/health", (_request, response) => {
  response.json({ ok: true, service: "formsaathi-ocr-api" });
});

function createRateLimiterStore() {
  const store = new Map();
  return {
    consume(key, maxRequests, windowMs) {
      const now = Date.now();
      let entry = store.get(key);
      if (!entry || now - entry.startedAt >= windowMs) {
        entry = { startedAt: now, count: 0 };
        store.set(key, entry);
      }
      if (entry.count >= maxRequests) {
        return Math.max(1, Math.ceil((windowMs - (now - entry.startedAt)) / 1000));
      }
      entry.count += 1;

      if (store.size > 5000) {
        for (const [storedKey, storedEntry] of store) {
          if (now - storedEntry.startedAt >= windowMs) store.delete(storedKey);
        }
      }
      return 0;
    }
  };
}

const apiRateLimits = createRateLimiterStore();
const ocrRateLimits = createRateLimiterStore();

async function requireAuthenticatedUser(request, response, next) {
  if (localDevelopmentBypass) {
    request.formSaathiUser = { id: "local-development" };
    return next();
  }
  if (!authClient) {
    return response.status(503).json({ error: "The OCR service is not configured. Contact the FormSaathi team." });
  }

  const authorization = request.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1].length > 8192) {
    return response.status(401).json({ error: "Sign in to FormSaathi before processing a document." });
  }

  try {
    const { data, error } = await authClient.auth.getUser(match[1]);
    if (error || !data?.user?.id) {
      return response.status(401).json({ error: "Your session is invalid or expired. Sign in again and retry." });
    }
    request.formSaathiUser = data.user;
    next();
  } catch {
    response.status(503).json({ error: "Could not verify your FormSaathi session. Please retry." });
  }
}

function applyRateLimit(store, maxRequests, windowMs, label) {
  return (request, response, next) => {
    const retryAfter = store.consume(request.formSaathiUser.id, maxRequests, windowMs);
    if (retryAfter > 0) {
      response.setHeader("Retry-After", String(retryAfter));
      return response.status(429).json({ error: label + " limit reached. Wait before trying again." });
    }
    next();
  };
}

app.use("/api", requireAuthenticatedUser);
app.use("/api", applyRateLimit(apiRateLimits, 60, 60_000, "API request"));

function detectFileType(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return "image/png";
  }
  if (buffer.length >= 12 &&
      buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
      buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return "image/webp";
  }
  return null;
}

function validateUploadedFile(file, response, imageOnly = false) {
  if (!file) {
    response.status(400).json({ error: "Choose a PDF or image document." });
    return false;
  }
  const detectedType = detectFileType(file.buffer);
  if (!allowedMimeTypes.has(file.mimetype) || detectedType !== file.mimetype) {
    response.status(415).json({ error: "The file content does not match a supported PDF, JPEG, PNG or WebP document." });
    return false;
  }
  if (imageOnly && detectedType === "application/pdf") {
    response.status(415).json({ error: "Choose a JPEG, PNG or WebP image." });
    return false;
  }
  return true;
}

// Every API route requires a valid Supabase user session. The OCR route also
// applies a stricter per-user quota and one-at-a-time processing guard.
let ocrBusy = false;

app.post(
  "/api/ocr",
  applyRateLimit(ocrRateLimits, 8, 5 * 60_000, "OCR request"),
  upload.single("file"),
  async (request, response) => {
    if (!validateUploadedFile(request.file, response)) return;
    if (ocrBusy) {
      return response.status(503).json({ error: "The OCR service is processing another document. Retry in a moment." });
    }

    ocrBusy = true;
    try {
      const result = await processDocument(request.file);
      response.json({
        facts: result.facts,
        note: "OCR output is unverified. Check every value against the original document."
      });
    } catch (error) {
      response.status(422).json({ error: error instanceof Error ? error.message : "OCR processing failed." });
    } finally {
      ocrBusy = false;
    }
  }
);

app.post("/api/prepare-image", upload.single("file"), async (request, response) => {
  if (!validateUploadedFile(request.file, response, true)) return;
  try {
    const result = await prepareImage(request.file, {
      maxKb: request.body?.maxKb,
      width: request.body?.width,
      height: request.body?.height
    });
    const baseName = String(request.file.originalname || "document").replace(/[^a-zA-Z0-9._-]/g, "_");
    response.setHeader("Content-Type", "image/jpeg");
    response.setHeader("Content-Disposition", 'attachment; filename="' + baseName.replace(/\.[^.]+$/, "") + '-prepared.jpg"');
    response.setHeader("X-Output-Width", String(result.width));
    response.setHeader("X-Output-Height", String(result.height));
    response.setHeader("X-Output-Bytes", String(result.bytes));
    response.send(result.buffer);
  } catch (error) {
    response.status(422).json({ error: error instanceof Error ? error.message : "Image preparation failed." });
  }
});

app.use((error, _request, response, _next) => {
  if (error?.code === "LIMIT_FILE_SIZE") {
    return response.status(413).json({ error: "The document exceeds the 10 MB upload limit." });
  }
  if (error?.code === "LIMIT_FILE_COUNT" || error?.code === "LIMIT_UNEXPECTED_FILE") {
    return response.status(400).json({ error: "Upload one document at a time." });
  }
  response.status(400).json({ error: "The request could not be processed." });
});

const bindHost = process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1";
app.listen(port, bindHost, () => {
  console.log("FormSaathi OCR API listening on port " + port);
  console.log("Uploads are processed in memory and are not written to disk.");
});
