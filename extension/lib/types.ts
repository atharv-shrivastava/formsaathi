export type DocumentCategory =
  | "identity"
  | "address"
  | "income"
  | "education"
  | "bank"
  | "photo"
  | "signature"
  | "other";

export interface CandidateFact {
  key: string;
  value: string;
  confidence: number;
  evidence: string;
  sourceType?: "general" | "document";
}

export interface StoredDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  mimeType: string;
  size: number;
  addedAt: number;
  file: Blob;
  cachedText?: string;
  cachedFacts?: CandidateFact[];
  cachedAt?: number;
}

export interface PortalField {
  id: string;
  label: string;
  tagName: string;
  inputType: string;
  required: boolean;
  placeholder?: string;
  name?: string;
  autoComplete?: string;
  options?: string[];
  isFile: boolean;
  isContentEditable?: boolean;
  frameId?: number;
}

export interface ScanResult {
  title: string;
  url: string;
  fields: PortalField[];
}

export interface ReviewRow {
  field: PortalField;
  canonicalKey: string | null;
  value: string;
  sourceName?: string;
  sourceId?: string;
  confidence?: number;
  evidence?: string;
  status: "unmapped" | "needs-review" | "filled" | "conflict";
}
