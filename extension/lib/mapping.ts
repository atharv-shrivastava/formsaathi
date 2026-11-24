import type { CandidateFact, DocumentCategory, PortalField, ReviewRow, StoredDocument } from "./types";

const aliases: Record<string, string[]> = {
  applicant_name: ["applicant name", "applicants name", "name of applicant", "candidate name", "student name", "full name", "name"],
  father_name: ["father name", "fathers name", "name of father", "guardian name", "name of guardian", "parent name"],
  date_of_birth: ["date of birth", "dob", "birth date"],
  annual_income: ["annual family income", "family income", "annual income", "income"],
  percentage: ["class 12 percentage", "12th percentage", "aggregate percentage", "marks percentage", "percentage"],
  bank_account_number: ["bank account number", "account number", "a c number"],
  ifsc_code: ["ifsc code", "ifsc"]
};

const orderedAliases = Object.entries(aliases)
  .flatMap(([key, names]) => names.map((name) => ({ key, name })))
  .sort((a, b) => b.name.length - a.name.length);

export function canonicalFieldKey(field: PortalField): string | null {
  const haystack = [field.label, field.name, field.placeholder].filter(Boolean).join(" ").toLowerCase();
  const normalized = haystack
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  for (const alias of orderedAliases) {
    if (alias.name === "name") {
      if (normalized === "name") return alias.key;
    } else if (normalized === alias.name || normalized.includes(alias.name)) {
      return alias.key;
    }
  }
  return null;
}

export function categoryForKey(key: string | null): DocumentCategory | null {
  if (!key) return null;
  if (["applicant_name", "father_name", "date_of_birth"].includes(key)) return "identity";
  if (key === "annual_income") return "income";
  if (key === "percentage") return "education";
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

export function createReviewRows(
  fields: PortalField[],
  facts: Array<CandidateFact & { sourceId: string; sourceName: string }>
): ReviewRow[] {
  return fields.map((field) => {
    const key = canonicalFieldKey(field);
    if (!key || field.isFile) {
      return { field, canonicalKey: key, value: "", status: "unmapped" };
    }
    const candidate = facts
      .filter((fact) => fact.key === key)
      .sort((a, b) => b.confidence - a.confidence)[0];
    if (!candidate) return { field, canonicalKey: key, value: "", status: "unmapped" };
    return {
      field,
      canonicalKey: key,
      value: candidate.value,
      sourceName: candidate.sourceName,
      sourceId: candidate.sourceId,
      confidence: candidate.confidence,
      evidence: candidate.evidence,
      status: "needs-review"
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
