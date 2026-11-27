import type { CandidateFact, DocumentCategory, PortalField, ReviewRow, StoredDocument } from "./types";

const aliases: Record<string, string[]> = {
  first_name: ["first name", "firstname", "given name", "forename", "fname", "applicant first name", "student first name", "candidate first name"],
  last_name: ["last name", "lastname", "surname", "family name", "lname", "applicant last name", "student last name", "candidate last name"],
  applicant_name: ["applicant full name", "full name of applicant", "applicant name", "applicants name", "name of applicant", "candidate full name", "candidate name", "student full name", "student name", "beneficiary name", "full name", "your name", "name"],
  father_name: ["father name", "fathers name", "father's name", "name of father", "father full name", "father"],
  mother_name: ["mother name", "mothers name", "mother's name", "name of mother", "mother full name", "mother"],
  guardian_name: ["guardian name", "guardians name", "guardian's name", "name of guardian", "parent name", "parents name", "parent's name", "guardian"],
  date_of_birth: ["date of birth", "birth date", "birthdate", "dob", "born on"],
  email: ["email address", "e mail address", "email id", "e mail", "email"],
  mobile_number: ["mobile number", "mobile no", "mobile", "phone number", "telephone number", "contact number", "cell phone", "cellphone", "whatsapp number", "phone"],
  address: ["residential address", "permanent address", "correspondence address", "present address", "current address", "communication address", "address"],
  postal_code: ["postal code", "pin code", "pincode", "zip code", "zipcode", "postcode", "pin"],
  district: ["district name", "district"],
  state: ["state name", "state", "province"],
  city: ["city name", "town", "city"],
  country: ["country name", "country", "nation"],
  annual_income: ["annual family income", "family annual income", "yearly income", "annual income", "family income", "household income", "income per annum", "income"],
  percentage: ["class 12 percentage", "12th percentage", "class xii percentage", "aggregate percentage", "marks percentage", "percentage", "aggregate marks", "marks obtained"],
  gender: ["gender", "sex"],
  caste_category: ["caste category", "social category", "reservation category", "category"],
  bank_account_number: ["bank account number", "account number", "account no", "a c number", "a c no"],
  ifsc_code: ["ifsc code", "ifsc"],
  pan_number: ["pan number", "pan no", "permanent account number"],
  aadhaar_number: ["aadhaar number", "aadhar number", "uid number", "uidai number"]
};

const orderedAliases = Object.entries(aliases)
  .flatMap(([key, names]) => names.map((name) => ({ key, name })))
  .sort((a, b) => b.name.length - a.name.length);

const factKeyAliases: Record<string, string> = {
  full_name: "applicant_name",
  applicant_full_name: "applicant_name",
  name_of_applicant: "applicant_name",
  student_name: "applicant_name",
  candidate_name: "applicant_name",
  beneficiary_name: "applicant_name",
  fathers_name: "father_name",
  father_s_name: "father_name",
  mothers_name: "mother_name",
  mother_s_name: "mother_name",
  guardians_name: "guardian_name",
  guardian_s_name: "guardian_name",
  dob: "date_of_birth",
  birthdate: "date_of_birth",
  email_address: "email",
  email_id: "email",
  phone: "mobile_number",
  phone_number: "mobile_number",
  contact_number: "mobile_number",
  mobile: "mobile_number",
  mobile_no: "mobile_number",
  telephone: "mobile_number",
  telephone_number: "mobile_number",
  pin_code: "postal_code",
  pincode: "postal_code",
  zip_code: "postal_code",
  postcode: "postal_code",
  family_income: "annual_income",
  annual_family_income: "annual_income",
  household_income: "annual_income",
  account_number: "bank_account_number",
  account_no: "bank_account_number",
  ifsc: "ifsc_code",
  class_12_percentage: "percentage",
  twelfth_percentage: "percentage",
  category: "caste_category"
};

function normalizeText(value: string | undefined): string {
  return String(value || "")
    .normalize("NFKC")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function exactOrPhraseMatch(text: string, phrase: string): boolean {
  return text === phrase || (" " + text + " ").includes(" " + phrase + " ");
}

export function canonicalFieldKey(field: PortalField): string | null {
  const autocomplete = normalizeText(field.autocomplete);
  const autocompleteMap: Record<string, string> = {
    name: "applicant_name",
    "given name": "first_name",
    "family name": "last_name",
    "additional name": "applicant_name",
    email: "email",
    "tel": "mobile_number",
    "tel national": "mobile_number",
    "postal code": "postal_code",
    "address line 1": "address",
    "street address": "address",
    "address level 1": "state",
    "address level 2": "city",
    country: "country"
  };
  if (autocomplete && autocompleteMap[autocomplete]) return autocompleteMap[autocomplete];

  const label = normalizeText(field.label);
  const roleContext = normalizeText([field.label, field.name, field.placeholder, field.nearbyText].join(" "));
  // Avoid treating a parent's first/last name as the applicant's name parts.
  const parentRole = /\b(father|mother|guardian|parent)\b/.test(roleContext);
  const searchable = normalizeText([
    field.label,
    field.name,
    field.placeholder,
    field.autocomplete,
    field.role,
    field.dataLabel,
    field.nearbyText
  ].filter(Boolean).join(" "));

  for (const alias of orderedAliases) {
    if (parentRole && (alias.key === "first_name" || alias.key === "last_name")) continue;
    if (alias.name === "name") {
      if (label === "name" || autocomplete === "name") return alias.key;
    } else if (exactOrPhraseMatch(searchable, alias.name)) {
      return alias.key;
    }
  }
  return null;
}

function canonicalFactKey(fact: CandidateFact): string {
  const key = normalizeText(fact.key).replace(/ /g, "_");
  if (factKeyAliases[key]) return factKeyAliases[key];
  if (Object.prototype.hasOwnProperty.call(aliases, key)) return key;

  const label = normalizeText((fact as CandidateFact & { label?: string }).label);
  for (const alias of orderedAliases) {
    if (alias.name !== "name" && exactOrPhraseMatch(label, alias.name)) return alias.key;
  }
  return key;
}

export function categoryForKey(key: string | null): DocumentCategory | null {
  if (!key) return null;
  if (["applicant_name", "father_name", "mother_name", "guardian_name", "date_of_birth", "first_name", "last_name", "aadhaar_number", "pan_number"].includes(key)) return "identity";
  if (["address", "postal_code", "district", "state", "city", "country"].includes(key)) return "address";
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
  // When a portal uses unusual labels, don't silently skip the local vault.
  // The side panel still asks the user before uploading any uncached documents.
  if (categories.size === 0) return documents;
  return documents.filter((document) => categories.has(document.category));
}

function isApplicantFullNameFact(fact: CandidateFact): boolean {
  return ["applicant_name", "full_name", "student_name", "candidate_name", "applicant_full_name", "name_of_applicant"].includes(
    normalizeText(fact.key).replace(/ /g, "_")
  );
}

function deriveFullNamePart(key: string, value: string): string {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0];
  const lastName = parts.at(-1);
  if (!firstName || !lastName || parts.length < 2) return "";
  return key === "first_name" ? firstName : lastName;
}

function isGeneralFact(fact: CandidateFact & { sourceId: string; sourceName: string }): boolean {
  return fact.scope === "general" || fact.sourceDocumentId === null;
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

    let candidates = facts.filter((fact) => canonicalFactKey(fact) === key);
    if (candidates.length === 0 && (key === "first_name" || key === "last_name")) {
      candidates = facts.filter(isApplicantFullNameFact).map((fact) => ({
        ...fact,
        key,
        value: deriveFullNamePart(key, fact.value),
        evidence: [fact.evidence, "Derived from the stored full name."].filter(Boolean).join(" · ")
      })).filter((fact) => Boolean(fact.value));
    }
    if (!candidates.length) return { field, canonicalKey: key, value: "", status: "unmapped" };

    // General profile values are the default. Document facts are fallbacks, not overwrites.
    const generalCandidates = candidates.filter(isGeneralFact);
    if (generalCandidates.length > 0) candidates = generalCandidates;

    const distinctValues = Array.from(new Set(candidates.map((fact) => fact.value.trim())));
    if (distinctValues.length > 1) {
      const evidence = candidates
        .map((fact) => fact.sourceName + ": " + fact.value)
        .join(" | ");
      return {
        field,
        canonicalKey: key,
        value: "",
        sourceName: "Conflicting source values",
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
