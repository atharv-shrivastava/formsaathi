import type { CandidateFact, DocumentCategory, PortalField, ReviewRow, StoredDocument } from "./types";

/**
 * One canonical vocabulary is shared by web profile facts, document extraction,
 * and portal labels. Keep aliases broad, but never map ambiguous labels by
 * substring (for example, "name" must not match "father's name").
 */
const aliases: Record<string, string[]> = {
  first_name: ["first name", "firstname", "given name", "forename", "fname", "applicant first name", "candidate first name"],
  middle_name: ["middle name", "middlename", "second name"],
  last_name: ["last name", "lastname", "surname", "family name", "lname", "applicant last name", "candidate last name"],
  applicant_name: ["applicant name", "applicants name", "name of applicant", "candidate name", "student name", "full name", "applicant full name", "name of candidate", "name of student", "beneficiary name", "applicant's full name", "name"],
  father_name: ["father name", "fathers name", "name of father", "father full name", "father fullname", "father"],
  mother_name: ["mother name", "mothers name", "name of mother", "mother full name", "mother fullname", "mother"],
  guardian_name: ["guardian name", "name of guardian", "parent name", "parents name", "legal guardian"],
  date_of_birth: ["date of birth", "dob", "birth date", "birthdate", " जन्म तिथि", " जन्मतिथि", "date birth"],
  annual_income: ["annual family income", "family annual income", "family income", "annual income", "yearly income", "income per annum", "annual earnings", "total family income", "gross annual income", "income"],
  percentage: ["class 12 percentage", "12th percentage", "aggregate percentage", "marks percentage", "percentage", "class xii percentage", "overall percentage"],
  bank_account_number: ["bank account number", "account number", "account no", "a c number", "ac number", "bank a c no", "savings account number", "bank a c number"],
  ifsc_code: ["ifsc code", "ifsc"],
  email: ["email address", "e mail", "email id", "mail id", "email"],
  phone: ["mobile number", "mobile no", "contact number", "phone number", "telephone", "phone", "mobile", "cell number", "primary mobile", "registered mobile number"],
  address: ["permanent address", "residential address", "correspondence address", "postal address", "address"],
  city: ["city", "town"],
  state: ["state", "province"],
  pincode: ["pin code", "pincode", "postal code", "zip code", "zip", "area pin", "postal pin code"],
  aadhaar_number: ["aadhaar number", "aadhar number", "uid number", "aadhaar no", "aadhar no", "unique identification number", "uidai number"],
  pan_number: ["pan number", "pan card number", "permanent account number", "income tax pan", "pan"],
  nationality: ["nationality", "citizenship"],
  religion: ["religion"],
  caste: ["caste", "category"],
  domicile_state: ["domicile state", "state of domicile"],
  school_name: ["school name", "name of school", "institution name"],
  roll_number: ["roll number", "roll no", "registration number", "enrolment number"],
  passing_year: ["passing year", "year of passing", "completion year"]
};

function normalize(value: string): string {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const aliasLookup = new Map<string, string>();
for (const [key, names] of Object.entries(aliases)) {
  aliasLookup.set(normalize(key), key);
  for (const name of names) aliasLookup.set(normalize(name), key);
}

export function canonicalFactKey(value: string): string | null {
  const normalized = normalize(value);
  if (!normalized) return null;
  const exact = aliasLookup.get(normalized);
  if (exact) return exact;

  // Prefer the longest complete alias phrase, not arbitrary substring matches.
  const padded = " " + normalized + " ";
  const matches = Array.from(aliasLookup.entries())
    .filter(([alias]) => alias && padded.includes(" " + alias + " "))
    .sort((a, b) => b[0].length - a[0].length);
  return matches[0]?.[1] || null;
}

export function canonicalFieldKey(field: PortalField): string | null {
  const parts = [
    field.label,
    field.name,
    field.placeholder,
    field.id,
    (field as PortalField & { autoComplete?: string }).autoComplete
  ].filter(Boolean);
  // Try each source independently first so incidental parent/context text
  // cannot override an explicit label.
  for (const part of parts) {
    const key = canonicalFactKey(String(part));
    if (key) return key;
  }
  return null;
}

export function categoryForKey(key: string | null): DocumentCategory | null {
  if (!key) return null;
  if (["applicant_name", "first_name", "middle_name", "last_name", "father_name", "mother_name", "guardian_name", "date_of_birth", "aadhaar_number", "pan_number", "nationality", "caste"].includes(key)) return "identity";
  if (["address", "city", "state", "pincode", "domicile_state"].includes(key)) return "address";
  if (key === "annual_income") return "income";
  if (["percentage", "school_name", "roll_number", "passing_year"].includes(key)) return "education";
  if (["bank_account_number", "ifsc_code"].includes(key)) return "bank";
  return null;
}

export function retrieveRelevantDocuments(fields: PortalField[], documents: StoredDocument[]): StoredDocument[] {
  const categories = new Set<DocumentCategory>();
  fields.forEach((field) => {
    const category = categoryForKey(canonicalFieldKey(field));
    if (category) categories.add(category);
  });
  return documents.filter((document) => categories.has(document.category));
}

const generalProfileKeys = new Set([
  "applicant_name", "full_name", "first_name", "middle_name", "last_name",
  "father_name", "mother_name", "guardian_name", "date_of_birth",
  "email", "email_address", "phone", "phone_number", "mobile_number",
  "address", "permanent_address", "correspondence_address", "city", "state",
  "pincode", "postal_code", "nationality", "religion", "caste",
  "annual_income", "family_income", "bank_account_number", "ifsc_code", "gender", "district"
]);

function normalizedFactKey(key: string): string | null {
  return canonicalFactKey(key) || normalize(key).replace(/\s+/g, "_");
}

function isApplicantFullNameFact(fact: CandidateFact): boolean {
  return ["applicant_name", "full_name", "student_name", "candidate_name"].includes(
    normalize(fact.key).replace(/\s+/g, "_")
  );
}

function deriveFullNamePart(key: string, value: string): string {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return "";
  if (key === "first_name") return parts[0] || "";
  if (key === "middle_name") return parts.length > 2 ? parts.slice(1, -1).join(" ") : "";
  return parts.at(-1) || "";
}

export function createReviewRows(
  fields: PortalField[],
  facts: Array<CandidateFact & { sourceId: string; sourceName: string }>
): ReviewRow[] {
  return fields.map((field) => {
    const key = canonicalFieldKey(field);
    if (!key || field.isFile) return { field, canonicalKey: key, value: "", status: "unmapped" };

    let candidates = facts.filter((fact) => normalizedFactKey(fact.key) === key);
    const documentSpecific = !generalProfileKeys.has(key);
    const preferredScope = documentSpecific ? "document" : "general";
    const scoped = candidates.filter((fact) => fact.sourceType === preferredScope);
    if (scoped.length) candidates = scoped;
    else if (documentSpecific) candidates = candidates.filter((fact) => fact.sourceType !== "general");
    if (!candidates.length && ["first_name", "middle_name", "last_name"].includes(key)) {
      candidates = facts.filter(isApplicantFullNameFact).map((fact) => ({
        ...fact,
        key,
        value: deriveFullNamePart(key, fact.value),
        evidence: [fact.evidence, "Derived from the reviewed full name."].filter(Boolean).join(" · ")
      })).filter((fact) => Boolean(fact.value));
    }

    if (!candidates.length) return { field, canonicalKey: key, value: "", status: "unmapped" };
    const distinctValues = Array.from(new Set(candidates.map((fact) => fact.value.trim())));
    if (distinctValues.length > 1) {
      const evidence = candidates.map((fact) => fact.sourceName + ": " + fact.value).join(" | ");
      return {
        field, canonicalKey: key, value: "", sourceName: "Conflicting documents",
        confidence: 0, evidence: "Conflict: " + evidence, status: "conflict"
      };
    }

    const candidate = [...candidates].sort((a, b) => b.confidence - a.confidence)[0];
    if (!candidate) return { field, canonicalKey: key, value: "", status: "unmapped" };
    return {
      field, canonicalKey: key, value: candidate.value, sourceName: candidate.sourceName,
      sourceId: candidate.sourceId, confidence: candidate.confidence,
      evidence: candidate.evidence, status: "needs-review"
    };
  });
}

export function inferDocumentCategory(filename: string, fallback: DocumentCategory): DocumentCategory {
  const name = filename.toLowerCase().replace(/[_-]+/g, " ");
  if (/(aadhaar|aadhar|pan card|passport|voter id|identity)/.test(name)) return "identity";
  if (/(address proof|electricity bill|utility bill|residence|domicile)/.test(name)) return "address";
  if (/(income certificate|income proof|salary slip|salary certificate|itr)/.test(name)) return "income";
  if (/(marksheet|mark sheet|class 10|class 12|10th|12th|academic|school certificate)/.test(name)) return "education";
  if (/(passbook|bank statement|cancelled cheque|cancel cheque|bank account)/.test(name)) return "bank";
  if (/(signature|sign image)/.test(name)) return "signature";
  if (/(passport size|photograph|profile photo)/.test(name)) return "photo";
  return fallback;
}
