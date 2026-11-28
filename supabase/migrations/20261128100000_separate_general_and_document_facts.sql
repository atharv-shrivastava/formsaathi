-- Remove legacy copies of document-specific values from the reusable profile.
-- The approved source rows remain in extracted_facts, linked to their original documents.
-- Only delete a profile copy when the exact source document, key and value still exist.
DELETE FROM public.profile_facts AS pf
WHERE pf.source_document_id IS NOT NULL
  AND pf.fact_key IN (
    'aadhaar_number', 'pan_number', 'passport_number',
    'certificate_number', 'document_number', 'roll_number',
    'registration_number', 'enrolment_number', 'issue_date',
    'expiry_date', 'passing_year', 'percentage', 'cgpa', 'sgpa',
    'marks_obtained', 'total_marks', 'board_name', 'school_name'
  )
  AND EXISTS (
    SELECT 1
    FROM public.extracted_facts AS ef
    WHERE ef.user_id = pf.user_id
      AND ef.document_id = pf.source_document_id
      AND ef.fact_key = pf.fact_key
      AND ef.fact_value = pf.fact_value
      AND ef.review_status = 'approved'
  );
