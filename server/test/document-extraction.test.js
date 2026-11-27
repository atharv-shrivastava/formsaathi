import test from "node:test";
import assert from "node:assert/strict";
import {
  buildDocumentExtractionPrompt,
  mergeDocumentFacts,
  validateDocumentExtraction
} from "../src/document-extraction.js";

test("prompt asks for broad labelled extraction and treats document contents as data", () => {
  const prompt = buildDocumentExtractionPrompt("Name: Alex\nRoll No: 42");
  assert.match(prompt, /regardless of the document category/i);
  assert.match(prompt, /untrusted document data/i);
  assert.match(prompt, /Do not infer missing values/i);
});

test("validation keeps multiple labelled fields and only evidence grounded in OCR text", () => {
  const text = "Student Name: Alex Demo\nRoll Number: 0042\nBoard: MPBSE";
  const result = validateDocumentExtraction({
    documentType: "Class 12 marksheet",
    facts: [
      { key: "student_name", label: "Student Name", value: "Alex Demo", confidence: 0.98, evidence: "Student Name: Alex Demo" },
      { key: "roll_number", label: "Roll Number", value: "0042", confidence: 0.9, evidence: "Roll Number: 0042" },
      { key: "board", label: "Board", value: "MPBSE", confidence: 0.8, evidence: "Board: MPBSE" },
      { key: "hallucinated", label: "Certificate Number", value: "NOT-IN-DOCUMENT", confidence: 0.99, evidence: "Certificate Number: NOT-IN-DOCUMENT" },
      { key: "blank", label: "Date of Issue", value: "", confidence: 0.9, evidence: "Date of Issue:" }
    ]
  }, text);

  assert.equal(result.documentType, "Class 12 marksheet");
  assert.equal(result.facts.length, 3);
  assert.equal(result.facts[1].value, "0042");
  assert.equal(result.facts[1].label, "Roll Number");
});

test("validation normalizes field keys and rejects low-confidence or empty candidates", () => {
  const result = validateDocumentExtraction({
    documentType: "Utility bill",
    facts: [
      { key: "Consumer Number", label: "Consumer Number", value: "A-1092", confidence: 0.8, evidence: "Consumer Number A-1092" },
      { key: "Meter", label: "Meter Number", value: "M123", confidence: 0.1, evidence: "Meter Number M123" },
      { key: "!", label: "", value: "2026-11-27", confidence: 0.9, evidence: "Reading Date 2026-11-27" }
    ]
  }, "Consumer Number A-1092\nMeter Number M123\nReading Date 2026-11-27");

  assert.equal(result.facts.length, 1);
  assert.equal(result.facts[0].key, "consumer_number");
});

test("merge prefers Gemini values and adds rule-based fallback values without duplicates", () => {
  const facts = mergeDocumentFacts(
    [{ key: "applicant_name", label: "Applicant Name", value: "Alex Demo", confidence: 0.92, evidence: "Applicant Name: Alex Demo" }],
    [
      { key: "applicant_name", value: "Alex Demo", confidence: 0.52, evidence: "Name: Alex Demo" },
      { key: "date_of_birth", value: "12/08/2004", confidence: 0.7, evidence: "DOB: 12/08/2004" }
    ]
  );

  assert.equal(facts.length, 2);
  assert.equal(facts[0].confidence, 0.92);
  assert.equal(facts[1].key, "date_of_birth");
});

test("rejects a hallucinated value even when the model cites a genuine but unrelated OCR line", () => {
  const result = validateDocumentExtraction({
    documentType: "Identity document",
    facts: [
      {
        key: "roll_number",
        label: "Roll Number",
        value: "9999",
        confidence: 0.99,
        evidence: "Roll Number: 0042"
      },
      {
        key: "roll_number_short",
        label: "Roll Number",
        value: "004",
        confidence: 0.99,
        evidence: "Roll Number: 0042"
      }
    ]
  }, "Student Name: Alex Demo\\nRoll Number: 0042");

  assert.deepEqual(result.facts, []);
});
