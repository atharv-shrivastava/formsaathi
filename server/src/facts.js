const personNameKeys = new Set(["applicant_name", "father_name", "mother_name", "guardian_name"]);
const salutationPrefix = /^(?:(?:mr|mrs|ms|miss|dr|prof(?:essor)?|shri|sri|smt|shrimat[iy]|kumari|master)\.?\s+)+/i;

function cleanCandidateValue(key, rawValue) {
  const compact = String(rawValue || "").trim().replace(/\s{2,}/g, " ");
  return personNameKeys.has(key)
    ? compact.replace(salutationPrefix, "").trim()
    : compact;
}

const patterns = [
  {
    key: "applicant_name",
    confidence: 0.52,
    expression: /^(?:(?:applicant|candidate|student|full)\s*name|name\s+of\s+(?:applicant|candidate|student)|name)\s*[:\-]\s*(.{2,90})$/i
  },
  {
    key: "father_name",
    confidence: 0.62,
    expression: /^(?:father(?:'s)?|father s)\s*name\s*[:\-]\s*(.{2,90})$/i
  },
  {
    key: "mother_name",
    confidence: 0.62,
    expression: /^(?:mother(?:'s)?|mother s)\s*name\s*[:\-]\s*(.{2,90})$/i
  },
  {
    key: "guardian_name",
    confidence: 0.58,
    expression: /^(?:guardian|parent(?:'s)?|parent s)\s*name\s*[:\-]\s*(.{2,90})$/i
  },
  {
    key: "date_of_birth",
    confidence: 0.7,
    expression: /^(?:date\s*of\s*birth|dob|birth\s*date)\s*[:\-]\s*(\d{1,2}[\/.-]\d{1,2}[\/.-]\d{2,4})$/i
  },
  {
    key: "annual_income",
    confidence: 0.68,
    expression: /^(?:annual(?:\s+family)?\s+income|family\s+income|income)\s*[:\-]\s*(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d{1,2})?)/i
  },
  {
    key: "percentage",
    confidence: 0.65,
    expression: /^(?:(?:class\s*12|12th|aggregate|marks?)\s*)?percentage\s*[:\-]\s*(\d{1,3}(?:\.\d{1,2})?)\s*%?/i
  },
  {
    key: "bank_account_number",
    confidence: 0.62,
    expression: /^(?:bank\s+)?(?:account|a\/c)\s*(?:number|no\.?)\s*[:\-]\s*([0-9]{6,20})$/i
  },
  {
    key: "ifsc_code",
    confidence: 0.78,
    expression: /^(?:ifsc(?:\s+code)?)\s*[:\-]\s*([A-Z]{4}0[A-Z0-9]{6})$/i
  }
];

export function extractCandidateFacts(text) {
  const facts = [];
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern.expression);
      if (!match) continue;
      const value = cleanCandidateValue(pattern.key, match[1]);
      if (value.length < 2) continue;
      facts.push({
        key: pattern.key,
        value,
        confidence: pattern.confidence,
        evidence: line.slice(0, 180)
      });
    }
  }
  return facts;
}
