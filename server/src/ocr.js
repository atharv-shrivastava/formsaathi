import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractCandidateFacts } from "./facts.js";

const maxImagePixels = 20_000_000;
let workerPromise;

async function getOcrWorker() {
  if (!workerPromise) workerPromise = createWorker("eng");
  return workerPromise;
}

async function recognizeWithRapidOcr(buffer) {
  const serviceUrl = String(process.env.RAPIDOCR_SERVICE_URL || "").replace(/\/+$/, "");
  const apiToken = process.env.RAPIDOCR_API_TOKEN;
  if (!serviceUrl || !apiToken) return null;

  let response;
  try {
    response = await fetch(serviceUrl + "/ocr", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiToken,
        "Content-Type": "application/octet-stream"
      },
      body: buffer,
      signal: AbortSignal.timeout(180_000)
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new Error("RapidOCR took too long to respond. The OCR service may be waking up; retry the scan.");
    }
    throw new Error("Could not reach the RapidOCR service. It may be starting up; retry the scan shortly.");
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.detail || payload.error || "RapidOCR could not process this image.");
    error.status = response.status;
    throw error;
  }
  return typeof payload.text === "string" ? payload.text : "";
}

async function recognizeImage(buffer) {
  const image = sharp(buffer, { limitInputPixels: maxImagePixels });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > maxImagePixels) {
    throw new Error("Image dimensions are too large. Resize the image and retry.");
  }

  const prepared = await sharp(buffer, { limitInputPixels: maxImagePixels })
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .sharpen()
    .jpeg({ quality: 92, mozjpeg: true })
    .toBuffer();

  try {
    const rapidText = await recognizeWithRapidOcr(prepared);
    if (rapidText !== null && rapidText.trim()) return rapidText;
  } catch (error) {
    // A transient RapidOCR inference failure should not make document extraction unusable.
    // Authentication errors indicate a deployment configuration problem and must remain visible.
    if ([401, 403].includes(error?.status)) throw error;
    console.warn("RapidOCR failed; falling back to Tesseract:", error instanceof Error ? error.message : error);
  }

  const grayscale = await sharp(prepared).grayscale().normalize().png().toBuffer();
  const worker = await getOcrWorker();
  const result = await worker.recognize(grayscale);
  const fallbackText = result.data.text || "";
  if (!fallbackText.trim()) throw new Error("Neither RapidOCR nor fallback OCR could read text from this file. Try a clearer JPG/PNG photo or a text-based PDF.");
  return fallbackText;
}

function getPdfTextLines(items) {
  const lines = [];
  let currentLine = "";
  let previousY = null;

  for (const item of items) {
    if (!("str" in item) || !item.str.trim()) continue;
    const text = item.str.trim();
    const y = Array.isArray(item.transform) ? item.transform[5] : null;
    if (currentLine && y !== null && previousY !== null && Math.abs(y - previousY) > 3) {
      lines.push(currentLine.trim());
      currentLine = text;
    } else {
      currentLine += (currentLine ? " " : "") + text;
    }
    if (y !== null) previousY = y;
  }

  if (currentLine.trim()) lines.push(currentLine.trim());
  return lines.join("\n");
}

async function recognizePdf(buffer) {
  const pdf = await getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
    isEvalSupported: false
  }).promise;

  if (pdf.numPages > 12) {
    await pdf.destroy();
    throw new Error("PDF has more than 12 pages. Split it into smaller files.");
  }

  const pages = [];
  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const embeddedText = getPdfTextLines(textContent.items);

      if (embeddedText.replace(/\s/g, "").length > 40) {
        pages.push(embeddedText);
        continue;
      }

      const viewport = page.getViewport({ scale: 1.5 });
      if (viewport.width * viewport.height > maxImagePixels) {
        throw new Error("A PDF page is too large to process safely. Split or resize the document.");
      }
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push(await recognizeImage(canvas.toBuffer("image/png")));
    }
  } finally {
    await pdf.destroy();
  }
  return pages.join("\n\n");
}

export async function processDocument(file) {
  if (!file?.buffer) throw new Error("No file was received.");
  const filename = String(file.originalname || "").toLowerCase();
  let text;
  if (file.mimetype === "application/pdf" || filename.endsWith(".pdf")) {
    text = await recognizePdf(file.buffer);
  } else if (["image/jpeg", "image/png", "image/webp"].includes(file.mimetype)) {
    text = await recognizeImage(file.buffer);
  } else {
    throw new Error("Only PDF, JPEG, PNG and WebP documents are supported.");
  }
  return { text, facts: extractCandidateFacts(text) };
}
