-- Preserve the document classification and original field labels returned by broad extraction.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS document_type text;

ALTER TABLE public.extracted_facts
  ADD COLUMN IF NOT EXISTS fact_label text;
