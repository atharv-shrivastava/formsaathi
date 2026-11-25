import test from "node:test";
import assert from "node:assert/strict";
import { extractCandidateFacts } from "../src/facts.js";

test("extracts labelled candidate facts without treating them as verified", () => {
  const text = [
    "Applicant Name: Sample Student",
    "Father's Name: Sample Parent",
    "Date of Birth: 16/11/2006",
    "Annual Family Income: 120000",
    "Class 12 Percentage: 88.50",
    "IFSC Code: ABCD0123456"
  ].join("\n");

  const facts = extractCandidateFacts(text);
  assert.equal(facts.find((fact) => fact.key === "applicant_name")?.value, "Sample Student");
  assert.equal(facts.find((fact) => fact.key === "father_name")?.value, "Sample Parent");
  assert.equal(facts.find((fact) => fact.key === "date_of_birth")?.value, "16/11/2006");
  assert.equal(facts.find((fact) => fact.key === "annual_income")?.value, "120000");
  assert.equal(facts.find((fact) => fact.key === "percentage")?.value, "88.50");
  assert.equal(facts.find((fact) => fact.key === "ifsc_code")?.value, "ABCD0123456");
  assert.ok(facts.every((fact) => fact.confidence < 1));
});


test("removes leading salutations from extracted applicant and father names", () => {
  const facts = extractCandidateFacts([
    "Applicant Name: Mr. Atharv Shrivastava",
    "Father's Name: Shri Shashi Shrivastava"
  ].join("\n"));

  assert.equal(facts.find((fact) => fact.key === "applicant_name")?.value, "Atharv Shrivastava");
  assert.equal(facts.find((fact) => fact.key === "father_name")?.value, "Shashi Shrivastava");
});

test("does not strip title-like text embedded in a real name", () => {
  const facts = extractCandidateFacts("Applicant Name: Mrinal Sharma");
  assert.equal(facts.find((fact) => fact.key === "applicant_name")?.value, "Mrinal Sharma");
});
