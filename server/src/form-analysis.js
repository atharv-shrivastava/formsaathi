const blockedInputTypes = new Set(["hidden", "password", "file", "checkbox", "radio", "submit", "button", "reset", "image"]);
const stopWords = new Set(["name", "number", "code", "of", "the", "and", "for", "your", "enter", "please", "select", "date", "id"]);

const factAliases = {
  applicant_name: ["applicant name", "name of applicant", "student name", "candidate name", "full name"],
  full_name: ["applicant name", "name of applicant", "student name", "candidate name", "full name"],
  father_name: ["father", "father name", "name of father", "guardian name"],
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
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function fieldSearchText(field) {
  return normalize([field.label, field.name, field.placeholder].filter(Boolean).join(" "));
}

function matchesFactToField(field, fact) {
  const fieldText = fieldSearchText(field);
  const key = String(fact.fact_key || "").trim();
  const normalizedKey = normalize(key.replace(/_/g, " "));
  const factLabel = normalize(fact.fact_label || "");
  const aliases = factAliases[key] || [];
  if (!fieldText || !key) return false;
  if (["applicant_name", "full_name"].includes(key) && fieldText === "name") return true;
  if (aliases.some((alias) => fieldText.includes(normalize(alias)))) return true;
  if (factLabel && (fieldText === factLabel || fieldText.includes(factLabel) || factLabel.includes(fieldText))) return true;
  if (normalizedKey && (fieldText === normalizedKey || fieldText.includes(normalizedKey))) return true;

  const fieldTokens = new Set(fieldText.split(" "));
  const keyTokens = key.split("_")
    .map(normalize)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  const labelTokens = factLabel.split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  const tokens = labelTokens.length ? labelTokens : keyTokens;
  return tokens.length > 0 && tokens.every((token) => fieldTokens.has(token));
}

export function sanitizeDetectedFields(rawFields) {
  if (!Array.isArray(rawFields) || rawFields.length === 0) {
    throw new Error("Scan a form containing visible fields before analysis.");
  }

  const seen = new Set();
  const fields = [];
  for (const raw of rawFields.slice(0, 80)) {
    if (!raw || typeof raw !== "object") continue;
    const id = String(raw.id || "").trim().slice(0, 120);
    const tagName = String(raw.tagName || "").toLowerCase();
    const inputType = String(raw.inputType || tagName).toLowerCase().slice(0, 40);
    if (!id || !/^[a-zA-Z0-9_-]+$/.test(id) || seen.has(id)) continue;
    if (!["input", "textarea", "select"].includes(tagName)) continue;
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

export function filterRelevantProfileFacts(fields, facts) {
  const searchableFields = fields.map(fieldSearchText).filter(Boolean);
  return facts.filter((fact) => {
    const key = String(fact.fact_key || "").trim();
    if (!key || !String(fact.fact_value || "").trim()) return false;
    return fields.some((field) => matchesFactToField(field, fact));
  }).slice(0, 80);
}

export function validateAiMappings(rawMappings, fields, facts) {
  if (!Array.isArray(rawMappings)) return [];
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const factsByKey = new Map(facts.map((fact) => [fact.fact_key, fact]));
  const bestByField = new Map();

  for (const raw of rawMappings.slice(0, 120)) {
    if (!raw || typeof raw !== "object") continue;
    const field = fieldsById.get(String(raw.fieldId || ""));
    const fact = factsByKey.get(String(raw.factKey || ""));
    const confidence = Number(raw.confidence);
    if (!field || !fact || field.isFile || blockedInputTypes.has(field.inputType)) continue;
    if (!matchesFactToField(field, fact)) continue;
    if (!Number.isFinite(confidence) || confidence < 0.70 || confidence > 1) continue;
    if (!String(fact.fact_value || "").trim()) continue;

    if (field.tagName === "select" && field.options.length > 0) {
      const exactOption = field.options.some((option) =>
        normalize(option) === normalize(fact.fact_value)
      );
      if (!exactOption) continue;
    }

    const candidate = {
      fieldId: field.id,
      factId: fact.id,
      factKey: fact.fact_key,
      value: fact.fact_value,
      confidence,
      sourceDocumentId: fact.source_document_id || null,
      updatedAt: fact.updated_at || null
    };
    const current = bestByField.get(field.id);
    if (!current || candidate.confidence > current.confidence) bestByField.set(field.id, candidate);
  }

  return Array.from(bestByField.values());
}
