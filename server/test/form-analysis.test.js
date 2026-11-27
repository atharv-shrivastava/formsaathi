import test from "node:test";
import assert from "node:assert/strict";
import {
  filterRelevantProfileFacts,
  sanitizeDetectedFields,
  validateAiMappings
} from "../src/form-analysis.js";

const fields = [
  { id: "name-field", label: "Name of Applicant", tagName: "input", inputType: "text", required: true },
  { id: "father-field", label: "Father's Name", tagName: "input", inputType: "text" },
  { id: "state-field", label: "State", tagName: "select", inputType: "select", options: ["Madhya Pradesh", "Uttar Pradesh"] },
  { id: "upload-field", label: "Upload certificate", tagName: "input", inputType: "file", isFile: true }
];

const facts = [
  { id: "1", fact_key: "applicant_name", fact_value: "Aarav Sharma", source_document_id: "doc-1", updated_at: "2026-11-26T00:00:00Z" },
  { id: "2", fact_key: "father_name", fact_value: "Rakesh Sharma", source_document_id: "doc-2", updated_at: "2026-11-26T00:00:00Z" },
  { id: "3", fact_key: "state", fact_value: "Madhya Pradesh", source_document_id: null, updated_at: "2026-11-26T00:00:00Z" },
  { id: "4", fact_key: "bank_account_number", fact_value: "1234567890", source_document_id: null, updated_at: "2026-11-26T00:00:00Z" }
];

test("sanitizes detected fields and rejects duplicate or malformed controls", () => {
  const sanitized = sanitizeDetectedFields([
    ...fields,
    { id: "name-field", label: "Duplicate", tagName: "input", inputType: "text" },
    { id: "bad id", label: "Bad ID", tagName: "input", inputType: "text" },
    { id: "frame", label: "Frame", tagName: "iframe", inputType: "text" }
  ]);
  assert.deepEqual(sanitized.map((field) => field.id), ["name-field", "father-field", "state-field", "upload-field"]);
});

test("filters verified facts to facts plausibly related to detected labels", () => {
  const relevant = filterRelevantProfileFacts(fields, facts);
  assert.deepEqual(relevant.map((fact) => fact.fact_key), ["applicant_name", "father_name", "state"]);
});

test("accepts only exact database values and confident mappings", () => {
  const mappings = validateAiMappings([
    { fieldId: "name-field", factKey: "applicant_name", confidence: 0.93 },
    { fieldId: "father-field", factKey: "father_name", confidence: 0.91 },
    { fieldId: "state-field", factKey: "state", confidence: 0.90 },
    { fieldId: "name-field", factKey: "bank_account_number", confidence: 0.99 },
    { fieldId: "upload-field", factKey: "applicant_name", confidence: 0.99 },
    { fieldId: "father-field", factKey: "father_name", confidence: 0.50 },
    { fieldId: "name-field", factKey: "applicant_name", value: "Invented Name", confidence: 0.99 }
  ], fields, facts);
  assert.deepEqual(mappings.map((mapping) => mapping.fieldId), ["name-field", "father-field", "state-field"]);
  assert.equal(mappings[0].value, "Aarav Sharma");
});

test("matches generic extracted fields by their original document label", () => {
  const genericFacts = [
    { id: "generic-1", fact_key: "consumer_ref_2026", fact_label: "Consumer Number", fact_value: "A-1092" },
    { id: "generic-2", fact_key: "branch_name_text", fact_label: "Bank Branch", fact_value: "Bhopal Main" }
  ];
  const genericFields = [
    { id: "consumer", label: "Consumer No.", tagName: "input", inputType: "text" },
    { id: "branch", label: "Bank Branch", tagName: "input", inputType: "text" }
  ];
  const relevant = filterRelevantProfileFacts(genericFields, genericFacts);
  assert.deepEqual(relevant.map((fact) => fact.id), ["generic-1", "generic-2"]);
});

test("rejects dropdown values not present in the form options", () => {
  const mappings = validateAiMappings([
    { fieldId: "state-field", factKey: "state", confidence: 0.95 }
  ], fields, [{ ...facts[2], fact_value: "Delhi" }]);
  assert.deepEqual(mappings, []);
});
