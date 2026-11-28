import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalFactKey,
  categoryForKey,
  retrieveRelevantDocuments
} from "../lib/mapping.ts";

test("maps common residential address labels to the address category", () => {
  for (const label of [
    "Current Address",
    "Present Address",
    "Residential Address",
    "Street Address",
    "House Number",
    "House No.",
    "Locality"
  ]) {
    assert.equal(canonicalFactKey(label), "address", label);
  }

  assert.equal(categoryForKey("address"), "address");
});

test("retrieves address-category documents for address form fields", () => {
  const addressDocument = {
    id: "address-doc",
    name: "Electricity Bill.pdf",
    category: "address",
    mimeType: "application/pdf",
    size: 1200,
    addedAt: 1,
    file: new Blob(["synthetic"])
  };
  const identityDocument = {
    ...addressDocument,
    id: "identity-doc",
    name: "Identity Card.pdf",
    category: "identity"
  };
  const field = {
    id: "current-address",
    label: "Current Address",
    tagName: "textarea",
    inputType: "textarea",
    required: true,
    isFile: false
  };

  assert.deepEqual(
    retrieveRelevantDocuments([field], [addressDocument, identityDocument]).map((item) => item.id),
    ["address-doc"]
  );
});

test("does not infer annual income from an unrelated income-source label", () => {
  assert.equal(canonicalFactKey("Other Income Source"), null);
  assert.equal(canonicalFactKey("Additional Income Source"), null);
  assert.equal(canonicalFactKey("Annual Family Income"), "annual_income");
});

test("does not infer academic marks from attendance percentage", () => {
  assert.equal(canonicalFactKey("Attendance Percentage"), null);
  assert.equal(canonicalFactKey("Class 12 Percentage"), "percentage");
});

test("does not map a combined IFSC/MICR field to IFSC alone", () => {
  assert.equal(canonicalFactKey("IFSC/MICR Code"), null);
  assert.equal(canonicalFactKey("IFSC Code"), "ifsc_code");
  assert.equal(canonicalFactKey("IFSC Code / MICR"), null);
});
