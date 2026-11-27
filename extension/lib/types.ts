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
  label?: string;
  value: string;
  confidence: number;
  evidence: string;
  scope?: "general" | "document";
  sourceDocumentId?: string | null;
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
  options?: string[];
  optionValues?: Array<{ label: string; value: string }>;
  autocomplete?: string;
  role?: string;
  nearbyText?: string;
  dataLabel?: string;
  isContentEditable?: boolean;
  frameId?: number;
  domId?: string;
  isFile: boolean;
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
