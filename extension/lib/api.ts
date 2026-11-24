import type { CandidateFact, StoredDocument } from "./types";

export const API_BASE = "http://127.0.0.1:8787";

async function readError(response: Response): Promise<string> {
  try {
    const body = await response.json() as { error?: string };
    return body.error || "Local service request failed.";
  } catch {
    return "Local service request failed (" + response.status + ").";
  }
}

export async function extractDocument(document: StoredDocument): Promise<{
  text: string;
  facts: CandidateFact[];
}> {
  const form = new FormData();
  form.append("file", document.file, document.name);
  const response = await fetch(API_BASE + "/api/ocr", {
    method: "POST",
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
  height: number
): Promise<{ blob: Blob; bytes: number; width: number; height: number }> {
  const form = new FormData();
  form.append("file", document.file, document.name);
  form.append("maxKb", String(maxKb));
  form.append("width", String(width));
  form.append("height", String(height));

  const response = await fetch(API_BASE + "/api/prepare-image", {
    method: "POST",
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

export async function requestAiMappings(fields: unknown[], facts: CandidateFact[]) {
  const response = await fetch(API_BASE + "/api/ai/map", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ consent: true, fields, facts })
  });
  if (!response.ok) throw new Error(await readError(response));
  return response.json() as Promise<{ mappings: Array<{ fieldId: string; factKey: string; value: string; confidence: number }> }>;
}

export async function checkApi(): Promise<boolean> {
  try {
    const response = await fetch(API_BASE + "/health", { method: "GET" });
    return response.ok;
  } catch {
    return false;
  }
}
