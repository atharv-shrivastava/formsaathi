-- Preserve the document's original field label when a candidate is approved.
ALTER TABLE public.profile_facts
  ADD COLUMN IF NOT EXISTS fact_label text;
