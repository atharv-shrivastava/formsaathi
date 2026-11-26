import test from "node:test";
import assert from "node:assert/strict";
import {
  buildImageOverlaySvg,
  buildPaperFormFields,
  validatePaperPlacements
} from "../src/paper-form.js";

const facts = [
  { id: "1", fact_key: "applicant_name", fact_value: "Aarav Sharma", source_document_id: "doc-1", updated_at: "2026-11-26T00:00:00Z" },
  { id: "2", fact_key: "father_name", fact_value: "Rakesh Sharma", source_document_id: "doc-2", updated_at: "2026-11-26T00:00:00Z" }
];

test("builds bounded OCR labels for paper-form matching", () => {
  const fields = buildPaperFormFields("Name of Applicant: ______\nFather's Name: ______\n\n");
  assert.equal(fields.length, 2);
  assert.equal(fields[0].label, "Name of Applicant: ______");
  assert.equal(fields[1].id, "1");
});

test("uses only verified facts relevant to the selected OCR line", () => {
  const fields = buildPaperFormFields("Name of Applicant: ______\nFather's Name: ______");
  const placements = validatePaperPlacements([
    { lineIndex: 0, factKey: "applicant_name", x: 100, y: 100, width: 350, height: 35, confidence: 0.94 },
    { lineIndex: 0, factKey: "father_name", x: 100, y: 150, width: 350, height: 35, confidence: 0.99 },
    { lineIndex: 1, factKey: "father_name", x: 100, y: 200, width: 350, height: 35, confidence: 0.91 }
  ], fields, facts);
  assert.deepEqual(placements.map((item) => item.value), ["Aarav Sharma", "Rakesh Sharma"]);
});

test("rejects out-of-bounds, tiny, low-confidence and overlapping placements", () => {
  const fields = buildPaperFormFields("Name of Applicant: ______\nFull name: ______");
  const placements = validatePaperPlacements([
    { lineIndex: 0, factKey: "applicant_name", x: 100, y: 100, width: 350, height: 35, confidence: 0.94 },
    { lineIndex: 1, factKey: "applicant_name", x: 110, y: 105, width: 350, height: 35, confidence: 0.90 },
    { lineIndex: 0, factKey: "applicant_name", x: 990, y: 100, width: 30, height: 35, confidence: 0.98 },
    { lineIndex: 0, factKey: "applicant_name", x: 100, y: 100, width: 10, height: 5, confidence: 0.99 },
    { lineIndex: 0, factKey: "applicant_name", x: 100, y: 100, width: 350, height: 35, confidence: 0.50 }
  ], fields, facts);
  assert.equal(placements.length, 1);
  assert.equal(placements[0].confidence, 0.94);
});

test("escapes profile text before embedding it in an SVG overlay", () => {
  const svg = buildImageOverlaySvg(1200, 1600, [{
    x: 100, y: 100, width: 400, height: 40, value: "Aarav <Sharma> & Co."
  }]).toString("utf8");
  assert.match(svg, /Aarav &lt;Sharma&gt; &amp; Co\./);
  assert.doesNotMatch(svg, /<Sharma>/);
});
