const blockedInputTypes = new Set(["hidden", "password", "file", "checkbox", "radio", "submit", "button", "reset", "image"]);
const stopWords = new Set(["name", "number", "code", "of", "the", "and", "for", "your", "enter", "please", "select", "date", "id", "no", "a", "an"]);
const MAX_FIELDS = 120;
const MAX_CANDIDATES_PER_FIELD = 6;

// Regex signals are deliberately broad retrieval hints, not permission to autofill.
// The model proposes a mapping; the validator still checks the exact retrieved fact.
const semanticPatterns = [
  ["first_name", /\b(first ?name|given ?name)\b|\b(forename|fname)\b/],
  ["last_name", /\b(last ?name|family ?name)\b|\b(surname|lname)\b/],
  ["father_name", /\b(father|fathers|dad|paternal)\b.*\bname\b|\bname\b.*\b(father|fathers|dad)\b/],
  ["mother_name", /\b(mother|mothers|mom|maternal)\b.*\bname\b|\bname\b.*\b(mother|mothers|mom)\b/],
  ["guardian_name", /\b(guardian|parent)\b.*\bname\b|\bname\b.*\b(guardian|parent)\b/],
  ["applicant_name", /\b(applicant|candidate|student|beneficiary)\b.*\bname\b|\bname\b.*\b(applicant|candidate|student|beneficiary)\b/],
  ["date_of_birth", /\b(date of birth|birth date|dob|born on)\b/],
  ["email", /\b(e mail|email)\b/],
  ["phone", /\b(mobile|phone|telephone|contact number|whatsapp)\b/],
  ["postal_code", /\b(pin code|pincode|postal code|zip code|postcode)\b/],
  ["ifsc", /\b(ifsc)\b/],
  ["bank_account", /\b(bank account|account number|account no|a c number)\b/],
  ["annual_income", /\b(annual|yearly|family|household)?\s*income\b/],
  ["percentage", /\b(percentage|percent|aggregate marks|marks obtained|cgpa|sgpa)\b/],
  ["gender", /\b(gender|sex)\b/],
  ["address", /\b(address|residential|permanent|correspondence|street|locality)\b/],
  ["state", /\b(state|province)\b/],
  ["city", /\b(city|town|district headquarters)\b/],
  ["country", /\b(country|nation)\b/],
  ["date", /\b(date|issued on|valid until|expiry date)\b/]
];

const factAliases = {
  applicant_name: ["applicant name", "name of applicant", "student name", "candidate name", "full name"],
  full_name: ["applicant name", "name of applicant", "student name", "candidate name", "full name"],
  father_name: ["father", "father name", "name of father"],
  mother_name: ["mother", "mother name", "name of mother"],
  guardian_name: ["guardian", "guardian name", "name of guardian"],
  date_of_birth: ["date of birth", "birth date", "dob"],
  mobile_number: ["mobile number", "mobile no", "phone number", "contact number", "telephone"],
  phone_number: ["mobile number", "mobile no", "phone number", "contact number", "telephone"],
  email: ["email", "e mail", "email address"],
  email_address: ["email", "e mail", "email address"],
  annual_income: ["annual income", "family income", "annual family income", "income per year"],
  family_income: ["annual income", "family income", "annual family income", "income per year"],
  bank_account_number: ["bank account number", "account number", "account no"],
  ifsc_code: ["ifsc", "ifsc code"],
  postal_code: ["postal code", "pin code", "pincode", "zip code"],
  pincode: ["postal code", "pin code", "pincode", "zip code"],
  percentage: ["percentage", "marks percentage", "aggregate marks", "class 12 percentage"],
  caste_category: ["caste", "category", "social category"],
  gender: ["gender", "sex"],
  address: ["address", "residential address", "permanent address", "correspondence address"]
};

function normalize(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-IN")
    .replace(/['’]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fieldSearchText(field) {
  return normalize([field.label, field.name, field.placeholder].filter(Boolean).join(" "));
}

function factSearchText(fact) {
  return normalize([
    fact.fact_label,
    String(fact.fact_key || "").replace(/_/g, " ")
  ].filter(Boolean).join(" "));
}

function semanticKind(value) {
  const text = normalize(value);
  if (!text) return null;
  for (const [kind, pattern] of semanticPatterns) {
    if (pattern.test(text)) return kind;
  }
  if (/\b(name|full name)\b/.test(text)) return "generic_name";
  return null;
}

function isNameKind(kind) {
  return ["first_name", "last_name", "father_name", "mother_name", "guardian_name", "applicant_name", "generic_name"].includes(kind);
}

function semanticCompatibility(fieldKind, factKind) {
  if (!fieldKind || !factKind) return true;
  if (fieldKind === factKind) return true;

  // A first/last-name field may use only an explicitly labelled applicant full name.
  if (fieldKind === "first_name" || fieldKind === "last_name") {
    return factKind === "applicant_name" || factKind === "generic_name";
  }
  if (fieldKind === "generic_name") return factKind === "applicant_name" || factKind === "generic_name";
  if (factKind === "generic_name") return fieldKind === "applicant_name";
  if (isNameKind(fieldKind) || isNameKind(factKind)) return false;
  return fieldKind === factKind;
}

const applicantFullNameKeys = new Set([
  "applicant_name", "full_name", "student_name", "candidate_name", "name_of_applicant"
]);

function splitApplicantName(value) {
  const parts = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function isApplicantFullNameFact(fact) {
  const key = String(fact.fact_key || "").toLowerCase().replace(/[ -]/g, "_");
  return applicantFullNameKeys.has(key);
}

function valueForField(fieldKind, fact) {
  if (fieldKind !== "first_name" && fieldKind !== "last_name") return fact.fact_value;
  if (!isApplicantFullNameFact(fact)) return fact.fact_value;
  const parts = splitApplicantName(fact.fact_value);
  if (!parts) return "";
  return fieldKind === "first_name" ? parts.firstName : parts.lastName;
}

function isFeedbackTextarea(field) {
  if (String(field.tagName || "").toLowerCase() !== "textarea") return false;
  const context = [field.label, field.name, field.placeholder].filter(Boolean).join(" ");
  return /\b(feedback|comments?|suggestions?|reviews?|complaints?|remarks?|testimonials?|bug reports?|report a problem|how can we improve|tell us what you think|share your thoughts)\b/i.test(context);
}

function meaningfulTokens(value) {
  return new Set(normalize(value).split(" ").filter((token) =>
    token.length >= 2 && !stopWords.has(token)
  ));
}

function scoreFieldFact(field, fact) {
  const fieldText = fieldSearchText(field);
  const factText = factSearchText(fact);
  if (!fieldText || !factText || !String(fact.fact_value || "").trim()) return null;

  const fieldKind = semanticKind(fieldText);
  const factKind = semanticKind(factText);
  if (!semanticCompatibility(fieldKind, factKind)) return null;

  let score = 0;
  const reasons = [];
  if (fieldKind && factKind && fieldKind === factKind) {
    score = 0.78;
    reasons.push("regex:" + fieldKind);
  } else if ((fieldKind === "generic_name" && factKind === "applicant_name") ||
             (factKind === "generic_name" && fieldKind === "applicant_name")) {
    score = 0.66;
    reasons.push("generic-applicant-name");
  } else if ((fieldKind === "first_name" || fieldKind === "last_name") &&
             (factKind === "applicant_name" || factKind === "generic_name") &&
             isApplicantFullNameFact(fact)) {
    score = 0.84;
    reasons.push("applicant-full-name-component");
  }

  if (fieldText === factText) {
    score = Math.max(score, 1);
    reasons.push("exact-label");
  } else if (fieldText.includes(factText) || factText.includes(fieldText)) {
    const shorter = Math.min(fieldText.length, factText.length);
    if (shorter >= 4) {
      score = Math.max(score, 0.9);
      reasons.push("label-containment");
    }
  }

  const key = String(fact.fact_key || "").trim();
  const aliases = factAliases[key] || [];
  if (aliases.some((alias) => fieldText.includes(normalize(alias)))) {
    score = Math.max(score, 0.94);
    reasons.push("known-alias");
  }

  const fieldTokens = meaningfulTokens(fieldText);
  const factTokens = meaningfulTokens(factText);
  if (fieldTokens.size && factTokens.size) {
    let overlap = 0;
    for (const token of fieldTokens) if (factTokens.has(token)) overlap += 1;
    const lexicalScore = overlap / Math.sqrt(fieldTokens.size * factTokens.size);
    if (lexicalScore > score) {
      score = lexicalScore;
      reasons.push("lexical-overlap");
    }
  }

  return score >= 0.12 ? { score: Math.min(1, score), reasons } : null;
}

/**
 * Lightweight RAG over the signed-in user's approved profile facts.
 * It combines regex semantic hints with lexical label/key retrieval, returning
 * a small ranked evidence set for each detected field.
 */
export function retrieveProfileFactsForFields(fields, facts) {
  return fields.map((field) => {
    const candidates = facts
      .map((fact) => {
        const retrieval = scoreFieldFact(field, fact);
        return retrieval ? {
          factId: String(fact.id),
          factKey: fact.fact_key,
          factLabel: fact.fact_label || null,
          factValue: valueForField(semanticKind(fieldSearchText(field)), fact),
          retrievalScore: Number(retrieval.score.toFixed(3)),
          retrievalReasons: retrieval.reasons,
          sourceDocumentId: fact.source_document_id || null,
          updatedAt: fact.updated_at || null
        } : null;
      })
      .filter((candidate) => candidate && String(candidate.factValue || "").trim())
      .filter(Boolean)
      .sort((a, b) => b.retrievalScore - a.retrievalScore ||
        String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))
      .slice(0, MAX_CANDIDATES_PER_FIELD);

    return { fieldId: field.id, candidates };
  });
}

export function filterRelevantProfileFacts(fields, facts) {
  const retrieved = retrieveProfileFactsForFields(fields, facts);
  const ids = new Set(retrieved.flatMap((item) => item.candidates.map((candidate) => candidate.factId)));
  return facts.filter((fact) => ids.has(String(fact.id)));
}

export function sanitizeDetectedFields(rawFields) {
  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    throw new Error("Scan a form containing visible fields before analysis.");
  }

  const seen = new Set();
  const fields = [];
  for (const raw of rawFields.slice(0, MAX_FIELDS)) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim().slice(0, 120);
    const tagName = String(raw.tagName || "").toLowerCase();
    const inputType = String(raw.inputType || tagName).toLowerCase().slice(0, 40);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id)) continue;
    if (!["input", "textarea", "select"].includes(tagName)) continue;
    if (blockedInputTypes.has(inputType)) continue;
    if (isFeedbackTextarea(raw)) continue;
    seen.add(id);

    const options = Array.isArray(raw.options)
      ? raw.options.filter((value) => typeof value === "string")
        .map((value) => value.trim().slice(0, 100))
        .filter(Boolean).slice(0, 30)
      : [];

    fields.push({
      id,
      label: String(raw.label || "").trim().slice(0, 240) || "Unlabelled field",
      tagName,
      inputType,
      required: raw.required === true,
      placeholder: String(raw.placeholder || "").trim().slice(0, 160),
      name: String(raw.name || "").trim().slice(0, 120),
      options,
      isFile: raw.isFile === true || inputType === "file"
    });
  }

  if (fields.length === 0) {
    throw new Error("No supported visible form controls were found.");
  }
  return fields;
}

export function validateAiMappings(rawMappings, fields, retrievedFacts) {
  if (!Array.isArray(rawMappings)) return [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const retrievalByField = new Map((retrievedFacts || []).map((item) => [
    item.fieldId,
    new Map((item.candidates || []).map((candidate) => [String(candidate.factId), candidate]))
  ]));
  const bestByField = new Map();

  for (const raw of rawMappings.slice(0, 240)) {
    if (!raw || typeof raw !== "object") continue;
    const field = fieldsById.get(String(raw.fieldId || ""));
    const candidateId = String(raw.factId || "");
    const candidate = retrievalByField.get(field?.id)?.get(candidateId);
    const confidence = Number(raw.confidence);
    if (!field || !candidate || field.isFile || blockedInputTypes.has(field.inputType)) continue;
    if (!Number.isFinite(confidence) || confidence < 0.72 || confidence > 1) continue;
    if (!String(candidate.factValue || "").trim()) continue;

    const fieldKind = semanticKind(fieldSearchText(field));
    const factKind = semanticKind([candidate.factLabel, candidate.factKey].filter(Boolean).join(" "));
    if (!semanticCompatibility(fieldKind, factKind)) continue;

    if (field.tagName === "select" && field.options.length > 0) {
      const exactOption = field.options.some((option) =>
        normalize(option) === normalize(candidate.factValue)
      );
      if (!exactOption) continue;
    }

    const result = {
      fieldId: field.id,
      factId: candidate.factId,
      factKey: candidate.factKey,
      value: candidate.factValue,
      confidence,
      sourceDocumentId: candidate.sourceDocumentId || null,
      updatedAt: candidate.updatedAt || null
    };
    const current = bestByField.get(field.id);
    if (!current || result.confidence > current.confidence) bestByField.set(field.id, result);
  }

  return Array.from(bestByField.values());
}
