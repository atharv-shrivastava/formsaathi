-- Keep reusable general profile information separate from facts tied to a specific document.
-- Existing verified document facts are copied before they are removed from profile_facts.

create table if not exists public.document_profile_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  fact_key text not null,
  fact_label text,
  fact_value text not null,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint document_profile_facts_document_owner_fk
    foreign key (document_id, user_id)
    references public.documents (id, user_id)
    on delete cascade,
  constraint document_profile_facts_user_document_key
    unique (user_id, document_id, fact_key)
);

create index if not exists document_profile_facts_user_key_idx
  on public.document_profile_facts (user_id, fact_key, updated_at desc);

create index if not exists document_profile_facts_document_idx
  on public.document_profile_facts (document_id, fact_key);

alter table public.document_profile_facts enable row level security;

drop policy if exists "Users manage their own document profile facts"
  on public.document_profile_facts;

create policy "Users manage their own document profile facts"
  on public.document_profile_facts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

grant select, insert, update, delete
  on public.document_profile_facts to authenticated;

-- Preserve all existing document-sourced values and their original labels.
insert into public.document_profile_facts (
  user_id,
  document_id,
  fact_key,
  fact_label,
  fact_value,
  confidence,
  verified,
  updated_at
)
select
  user_id,
  source_document_id,
  fact_key,
  fact_label,
  fact_value,
  confidence,
  verified,
  updated_at
from public.profile_facts
where source_document_id is not null
on conflict (user_id, document_id, fact_key) do update
set
  fact_label = excluded.fact_label,
  fact_value = excluded.fact_value,
  confidence = excluded.confidence,
  verified = excluded.verified,
  updated_at = greatest(document_profile_facts.updated_at, excluded.updated_at);

-- New application versions only read source_document_id IS NULL from profile_facts.
-- Keep legacy document rows temporarily so already-installed extension versions can
-- continue to read their existing values during the rollout. They are compatibility
-- shadows only; all new document approvals are written to document_profile_facts.
-- Deleting a source document must remove its legacy shadow rather than turning it
-- into a general profile value.
alter table public.profile_facts
  drop constraint if exists profile_facts_source_document_id_fkey;

alter table public.profile_facts
  add constraint profile_facts_source_document_id_fkey
  foreign key (source_document_id)
  references public.documents (id)
  on delete cascade;
