export type DocumentCategory =
  | "identity"
  | "address"
  | "income"
  | "education"
  | "bank"
  | "photo"
  | "signature"
  | "other";

export type DocumentStatus = "uploaded" | "extracted" | "failed";
export type FactReviewStatus = "pending" | "approved" | "rejected";

export interface UserDocument {
  id: string;
  user_id: string;
  filename: string;
  category: DocumentCategory;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  status: DocumentStatus;
  created_at: string;
}

export interface ExtractedFact {
  id: string;
  user_id: string;
  document_id: string;
  fact_key: string;
  fact_value: string;
  confidence: number | null;
  evidence: string | null;
  review_status: FactReviewStatus;
  created_at: string;
}

export interface ProfileFact {
  id: string;
  user_id: string;
  fact_key: string;
  fact_value: string;
  source_document_id: string | null;
  confidence: number | null;
  verified: boolean;
  updated_at: string;
}

export interface TrackedApplication {
  id: string;
  user_id: string;
  title: string;
  portal_url: string | null;
  status: "not_started" | "in_progress" | "ready_to_submit" | "submitted";
  created_at: string;
}
