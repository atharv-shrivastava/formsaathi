import type { CandidateFact, DocumentCategory, PortalField, ReviewRow, StoredDocument } from "./types";

const aliases: Record<string, string[]> = {
  first_name: ["first name", "firstname", "given name", "forename", "fname"],
  last_name: ["last name", "lastname", "surname", "family name", "lname"],
  applicant_name: ["applicant name", "applicants name", "name of applicant", "candidate name", "student name", "full name", "name"],
  father_name: ["father name", "fathers name", "name of father"],
  mother_name: ["mother name", "mothers name", "name of mother"],
  guardian_name: ["guardian name", "name of guardian", "parent name", "parents name"],
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
  const haystack = [field.label, field.name, field.placeholder].filter(Boolean).join(" ");
  const normalized = haystack
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
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
  if (["applicant_name", "father_name", "mother_name", "guardian_name", "date_of_birth", "first_name", "last_name"].includes(key)) return "identity";
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

function isApplicantFullNameFact(fact: CandidateFact): boolean {
  return ["applicant_name", "full_name", "student_name", "candidate_name"].includes(
    fact.key.toLowerCase().replace(/[ -]/g, "_")
  );
}

function deriveFullNamePart(key: string, value: string): string {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  const lastName = parts.at(-1);
  if (!firstName || !lastName || parts.length < 2) return "";
  return key === "first_name" ? firstName : lastName;
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

    const directCandidates = facts.filter((fact) => fact.key === key);
    const candidates = directCandidates.length > 0
      ? directCandidates
      : (key === "first_name" || key === "last_name")
        ? facts.filter(isApplicantFullNameFact).map((fact) => ({
            ...fact,
            key,
            value: deriveFullNamePart(key, fact.value),
            evidence: [fact.evidence, "Derived from the stored full name."].filter(Boolean).join(" · ")
          })).filter((fact) => Boolean(fact.value))
        : [];
    if (!candidates.length) return { field, canonicalKey: key, value: "", status: "unmapped" };

    const distinctValues = Array.from(new Set(candidates.map((fact) => fact.value.trim())));
    if (distinctValues.length > 1) {
      const evidence = candidates
        .map((fact) => fact.sourceName + ": " + fact.value)
        .join(" | ");
      return {
        field,
        canonicalKey: key,
        value: "",
        sourceName: "Conflicting documents",
        confidence: 0,
        evidence: "Conflict: " + evidence,
        status: "conflict"
      };
    }

    const candidate = candidates.sort((a, b) => b.confidence - a.confidence)[0];
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
