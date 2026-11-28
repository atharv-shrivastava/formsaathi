import { retrieveProfileFactsForFields, validateAiMappings } from "./form-analysis.js";

export function buildPaperFormFields(ocrText) {
  const lines = String(ocrText || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length >= 2)
    .slice(0, 100);
  return lines.map((label, index) => ({
    id: String(index),
    label: label.slice(0, 240),
    tagName: "input",
    inputType: "text",
    required: false,
    placeholder: "",
    name: "",
    options: [],
    isFile: false
  }));
}

export function validatePaperPlacements(rawPlacements, ocrFields, verifiedFacts) {
  if (!Array.isArray(rawPlacements)) return [];
  const retrievedFacts = retrieveProfileFactsForFields(ocrFields, verifiedFacts);
  const candidatesByField = new Map(retrievedFacts.map((item) => [
    item.fieldId,
    item.candidates
  ]));
  const mappings = validateAiMappings(
    rawPlacements.map((placement) => {
      const fieldId = String(placement?.lineIndex ?? "");
      const factKey = String(placement?.factKey || "");
      const candidate = (candidatesByField.get(fieldId) || [])
        .find((item) => item.factKey === factKey);
      return {
        fieldId,
        factId: candidate?.factId || "",
        confidence: Number(placement?.confidence)
      };
    }),
    ocrFields,
    retrievedFacts
  );
  const approved = new Map(mappings.map((mapping) => [mapping.fieldId + "|" + mapping.factKey, mapping]));
  const placements = [];

  for (const raw of rawPlacements.slice(0, 80)) {
    const lineIndex = String(raw?.lineIndex ?? "");
    const factKey = String(raw?.factKey || "");
    const mapping = approved.get(lineIndex + "|" + factKey);
    if (!mapping) continue;

    const x = Number(raw.x);
    const y = Number(raw.y);
    const width = Number(raw.width);
    const height = Number(raw.height);
    const confidence = Number(raw.confidence);
    if (![x, y, width, height, confidence].every(Number.isFinite)) continue;
    if (confidence < 0.72 || confidence > 1) continue;
    if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1000 || y + height > 1000) continue;
    if (width < 28 || height < 12) continue;

    placements.push({
      lineIndex: Number(lineIndex),
      label: ocrFields[Number(lineIndex)]?.label || "Detected field",
      factKey,
      value: mapping.value,
      confidence,
      x, y, width, height,
      sourceDocumentId: mapping.sourceDocumentId || null
    });
  }

  // Prevent overlay boxes from colliding. Keep the higher-confidence placement.
  const accepted = [];
  for (const candidate of placements.sort((a, b) => b.confidence - a.confidence)) {
    const overlaps = accepted.some((current) => {
      const overlapWidth = Math.max(0, Math.min(candidate.x + candidate.width, current.x + current.width) - Math.max(candidate.x, current.x));
      const overlapHeight = Math.max(0, Math.min(candidate.y + candidate.height, current.y + current.height) - Math.max(candidate.y, current.y));
      const overlapArea = overlapWidth * overlapHeight;
      return overlapArea > Math.min(candidate.width * candidate.height, current.width * current.height) * 0.18;
    });
    if (!overlaps) accepted.push(candidate);
  }
  return accepted;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildImageOverlaySvg(width, height, placements) {
  const texts = [];
  for (const placement of placements) {
    const left = Math.round(placement.x / 1000 * width);
    const top = Math.round(placement.y / 1000 * height);
    const boxWidth = Math.round(placement.width / 1000 * width);
    const boxHeight = Math.round(placement.height / 1000 * height);
    const value = String(placement.value || "").trim();
    if (!value || boxWidth < 8 || boxHeight < 8) continue;

    const estimatedFont = Math.min(42, boxHeight * 0.68, boxWidth / Math.max(4, value.length * 0.57));
    if (estimatedFont < 9) continue;
    const fontSize = Math.round(estimatedFont);
    const x = left + 2;
    const y = top + Math.round((boxHeight + fontSize * 0.72) / 2);
    texts.push(
      '<text x="' + x + '" y="' + y + '" fill="#17243a" font-family="Arial, sans-serif" font-size="' + fontSize +
      '" font-weight="500" textLength="' + Math.max(4, boxWidth - 4) +
      '" lengthAdjust="spacingAndGlyphs">' + escapeXml(value) + "</text>"
    );
  }
  return Buffer.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '">' +
    texts.join("") + "</svg>"
  );
}
