import test from "node:test";
import assert from "node:assert/strict";
import {
  filterRelevantProfileFacts,
  retrieveProfileFactsForFields,
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
  { id: "1", fact_key: "applicant_name", fact_label: "Applicant Name", fact_value: "Aarav Sharma", source_document_id: "doc-1", updated_at: "2026-11-26T00:00:00Z" },
  { id: "2", fact_key: "father_name", fact_label: "Father Name", fact_value: "Rakesh Sharma", source_document_id: "doc-2", updated_at: "2026-11-26T00:00:00Z" },
  { id: "3", fact_key: "state", fact_label: "State", fact_value: "Madhya Pradesh", source_document_id: null, updated_at: "2026-11-26T00:00:00Z" },
  { id: "4", fact_key: "bank_account_number", fact_label: "Bank Account Number", fact_value: "1234567890", source_document_id: null, updated_at: "2026-11-26T00:00:00Z" }
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

test("does not forward checkboxes, radio buttons or feedback textareas to analysis", () => {
  const sanitized = sanitizeDetectedFields([
    { id: "agree", label: "I agree", tagName: "input", inputType: "checkbox" },
    { id: "gender", label: "Gender", tagName: "input", inputType: "radio" },
    { id: "feedback", label: "Feedback", tagName: "textarea", inputType: "textarea" },
    { id: "comments", label: "Additional comments", tagName: "textarea", inputType: "textarea" },
    { id: "address", label: "Address", tagName: "textarea", inputType: "textarea" },
    { id: "name", label: "Full Name", tagName: "input", inputType: "text" }
  ]);
  assert.deepEqual(sanitized.map((field) => field.id), ["address", "name"]);
});

test("passes the complete bounded detected-field set through sanitization", () => {
  const raw = Array.from({ length: 120 }, (_, index) => ({
    id: "field-" + index,
    label: "Custom field " + index,
    tagName: "input",
    inputType: "text"
  }));
  assert.equal(sanitizeDetectedFields(raw).length, 120);
});

test("regex retrieval separates applicant and father name candidates", () => {
  const retrieved = retrieveProfileFactsForFields(fields, facts);
  const applicant = retrieved.find((item) => item.fieldId === "name-field");
  const father = retrieved.find((item) => item.fieldId === "father-field");
  assert.deepEqual(applicant.candidates.map((candidate) => candidate.factId), ["1"]);
  assert.deepEqual(father.candidates.map((candidate) => candidate.factId), ["2"]);
});

test("derives first and last names from an explicitly labelled applicant full-name fact", () => {
  const nameFields = [
    { id: "first", label: "First Name", name: "firstName", tagName: "input", inputType: "text" },
    { id: "last", label: "Last Name", name: "lastName", tagName: "input", inputType: "text" }
  ];
  const fullNameFacts = [{
    id: "full-name-1",
    fact_key: "full_name",
    fact_label: "Full Name",
    fact_value: "Aarav Kumar Sharma"
  }];
  const retrieved = retrieveProfileFactsForFields(nameFields, fullNameFacts);
  assert.equal(retrieved[0].candidates[0].factValue, "Aarav");
  assert.equal(retrieved[1].candidates[0].factValue, "Sharma");

  const mappings = validateAiMappings([
    { fieldId: "first", factId: "full-name-1", confidence: 0.94 },
    { fieldId: "last", factId: "full-name-1", confidence: 0.94 }
  ], nameFields, retrieved);
  assert.deepEqual(mappings.map((mapping) => [mapping.fieldId, mapping.value]), [
    ["first", "Aarav"],
    ["last", "Sharma"]
  ]);
});

test("does not derive a surname from a single-token full name", () => {
  const nameFields = [
    { id: "first", label: "First Name", tagName: "input", inputType: "text" },
    { id: "last", label: "Last Name", tagName: "input", inputType: "text" }
  ];
  const facts = [{
    id: "one-part",
    fact_key: "full_name",
    fact_label: "Full Name",
    fact_value: "Aarav"
  }];
  const retrieved = retrieveProfileFactsForFields(nameFields, facts);
  assert.equal(retrieved[0].candidates.length, 0);
  assert.equal(retrieved[1].candidates.length, 0);
});

test("retrieves semantically related facts using lexical RAG for uncommon labels", () => {
  const genericFacts = [
    { id: "generic-1", fact_key: "consumer_ref_2026", fact_label: "Consumer Number", fact_value: "A-1092" },
    { id: "generic-2", fact_key: "branch_name_text", fact_label: "Bank Branch", fact_value: "Bhopal Main" },
    { id: "generic-3", fact_key: "passport_number", fact_label: "Passport Number", fact_value: "P1234567" }
  ];
  const genericFields = [
    { id: "consumer", label: "Consumer No.", tagName: "input", inputType: "text" },
    { id: "branch", label: "Bank Branch", tagName: "input", inputType: "text" }
  ];
  const retrieved = retrieveProfileFactsForFields(genericFields, genericFacts);
  assert.deepEqual(retrieved[0].candidates.map((candidate) => candidate.factId), ["generic-1"]);
  assert.deepEqual(retrieved[1].candidates.map((candidate) => candidate.factId), ["generic-2"]);
});

test("filterRelevantProfileFacts remains compatible with the paper-form route", () => {
  const relevant = filterRelevantProfileFacts(fields, facts);
  assert.deepEqual(relevant.map((fact) => fact.fact_key), ["applicant_name", "father_name", "state"]);
});

test("accepts only retrieved exact database facts and confident mappings", () => {
  const retrieved = retrieveProfileFactsForFields(fields, facts);
  const mappings = validateAiMappings([
    { fieldId: "name-field", factId: "1", confidence: 0.93 },
    { fieldId: "father-field", factId: "2", confidence: 0.91 },
    { fieldId: "state-field", factId: "3", confidence: 0.90 },
    { fieldId: "name-field", factId: "4", confidence: 0.99 },
    { fieldId: "upload-field", factId: "1", confidence: 0.99 },
    { fieldId: "father-field", factId: "2", confidence: 0.50 },
    { fieldId: "name-field", factId: "unknown-fact", confidence: 0.99 }
  ], fields, retrieved);
  assert.deepEqual(mappings.map((mapping) => mapping.fieldId), ["name-field", "father-field", "state-field"]);
  assert.equal(mappings[0].value, "Aarav Sharma");
});

test("rejects dropdown values not present in the form options", () => {
  const wrongFacts = [{ ...facts[2], fact_value: "Delhi" }];
  const retrieved = retrieveProfileFactsForFields(fields, wrongFacts);
  const mappings = validateAiMappings([
    { fieldId: "state-field", factId: "3", confidence: 0.95 }
  ], fields, retrieved);
  assert.deepEqual(mappings, []);
});

test("does not allow Gemini to cross applicant, father, mother or guardian name roles", () => {
  const nameFields = [
    { id: "applicant", label: "Applicant Name", tagName: "input", inputType: "text" },
    { id: "father", label: "Father Name", tagName: "input", inputType: "text" },
    { id: "mother", label: "Mother Name", tagName: "input", inputType: "text" }
  ];
  const nameFacts = [
    { id: "a", fact_key: "applicant_name", fact_label: "Applicant Name", fact_value: "Aarav Sharma" },
    { id: "f", fact_key: "father_name", fact_label: "Father Name", fact_value: "Rakesh Sharma" },
    { id: "m", fact_key: "mother_name", fact_label: "Mother Name", fact_value: "Sunita Sharma" }
  ];
  const retrieved = retrieveProfileFactsForFields(nameFields, nameFacts);
  const mappings = validateAiMappings([
    { fieldId: "applicant", factId: "f", confidence: 0.99 },
    { fieldId: "father", factId: "a", confidence: 0.99 },
    { fieldId: "mother", factId: "m", confidence: 0.94 }
  ], nameFields, retrieved);
  assert.deepEqual(mappings.map((mapping) => [mapping.fieldId, mapping.factId]), [["mother", "m"]]);
});
