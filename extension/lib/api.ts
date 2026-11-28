import type { CandidateFact, ScanResult, StoredDocument } from "./types";

// All packaged-extension requests use the authenticated hosted FormSaathi API.
// Do not point the published extension at a developer's loopback address.
export const API_BASE = "https://formsaathi-ocr-api.onrender.com";
export const FORM_ANALYSIS_API_BASE = API_BASE;

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || "FormSaathi service request failed.";
  } catch {
    return "FormSaathi service request failed (" + response.status + ").";
  }
}

export interface FormAnalysisMapping {
  fieldId: string;
  factId: string;
  factKey: string;
  value: string;
  confidence: number;
  sourceDocumentId: string | null;
  sourceType?: "general" | "document";
  updatedAt: string | null;
}

export interface FormAnalysisResponse {
  mappings: FormAnalysisMapping[];
  aiUsed: boolean;
  fieldCount: number;
  matchedCount?: number;
  model?: string;
  note: string;
}

export async function extractDocument(document: StoredDocument, accessToken: string): Promise<{
  text: string;
  facts: CandidateFact[];
}> {
  if (!accessToken) throw new Error("Connect your FormSaathi account before processing a document.");
  const form = new FormData();
  form.append("file", document.file, document.name);
  const response = await fetch(API_BASE + "/api/ocr", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: form
  });
  if (!response.ok) throw new Error(await readError(response));
  const result = await response.json() as { text: string; facts: CandidateFact[] };
  return { text: result.text, facts: result.facts || [] };
}

export async function prepareImage(
  document: StoredDocument,
  maxKb: number,
  width: number,
  height: number,
  accessToken: string
): Promise<{ blob: Blob; bytes: number; width: number; height: number }> {
  if (!accessToken) throw new Error("Connect your FormSaathi account before preparing an image.");
  const form = new FormData();
  form.append("file", document.file, document.name);
  form.append("maxKb", String(maxKb));
  form.append("width", String(width));
  form.append("height", String(height));

  const response = await fetch(API_BASE + "/api/prepare-image", {
    method: "POST",
    headers: { Authorization: "Bearer " + accessToken },
    body: form
  });
  if (!response.ok) throw new Error(await readError(response));

  return {
    blob: await response.blob(),
    bytes: Number(response.headers.get("X-Output-Bytes") || 0),
    width: Number(response.headers.get("X-Output-Width") || width),
    height: Number(response.headers.get("X-Output-Height") || height)
  };
}

export async function requestFormAnalysis(
  scan: ScanResult,
  accessToken: string
): Promise<FormAnalysisResponse> {
  if (!accessToken) throw new Error("Connect your FormSaathi account before using AI form analysis.");

  const response = await fetch(FORM_ANALYSIS_API_BASE + "/api/forms/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + accessToken
    },
    body: JSON.stringify({
      consent: true,
      pageTitle: scan.title.slice(0, 160),
      // Deliberately send field descriptors only. Never send what the applicant typed.
      fields: scan.fields
    })
  });

  if (!response.ok) throw new Error(await readError(response));
  return await response.json() as FormAnalysisResponse;
}

export async function checkApi(): Promise<boolean> {
  try {
    const response = await fetch(API_BASE + "/health", {
      method: "GET",
      signal: AbortSignal.timeout(8000)
    });
    return response.ok;
  } catch {
    return false;
  }
}
