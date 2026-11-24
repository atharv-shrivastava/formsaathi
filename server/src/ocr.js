import sharp from "sharp";
import { createWorker } from "tesseract.js";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { extractCandidateFacts } from "./facts.js";

let workerPromise;

async function getOcrWorker() {
  if (!workerPromise) workerPromise = createWorker("eng");
  return workerPromise;
}

async function recognizeImage(buffer) {
  const prepared = await sharp(buffer)
    .rotate()
    .resize({ width: 2400, withoutEnlargement: true })
    .grayscale()
    .normalize()
    .png()
    .toBuffer();
  const worker = await getOcrWorker();
  const result = await worker.recognize(prepared);
  return result.data.text || "";
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
  return lines.join("\\n");
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

      if (embeddedText.replace(/\\s/g, "").length > 40) {
        pages.push(embeddedText);
        continue;
      }

      const viewport = page.getViewport({ scale: 1.8 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext("2d");
      await page.render({ canvasContext: context, viewport }).promise;
      pages.push(await recognizeImage(canvas.toBuffer("image/png")));
    }
  } finally {
    await pdf.destroy();
  }
  return pages.join("\\n\\n");
}

export async function processDocument(file) {
  if (!file?.buffer) throw new Error("No file was received.");
  const filename = String(file.originalname || "").toLowerCase();
  let text;
  if (file.mimetype === "application/pdf" || filename.endsWith(".pdf")) {
    text = await recognizePdf(file.buffer);
  } else if (String(file.mimetype || "").startsWith("image/")) {
    text = await recognizeImage(file.buffer);
  } else {
    throw new Error("Only PDF and image documents are supported.");
  }
  return { text, facts: extractCandidateFacts(text) };
}
