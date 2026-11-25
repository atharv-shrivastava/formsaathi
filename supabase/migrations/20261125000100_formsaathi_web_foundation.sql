-- FormSaathi web foundation.
-- Run in the Supabase SQL Editor for the project used by this deployment.
-- All user-owned tables use RLS; the document bucket is private.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  preferred_language text not null default 'en'
    check (preferred_language in ('en', 'hi')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  category text not null
    check (category in ('identity', 'address', 'income', 'education', 'bank', 'photo', 'signature', 'other')),
  mime_type text not null
    check (mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  storage_path text not null unique,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'extracted', 'failed')),
  created_at timestamptz not null default now(),
  unique (id, user_id),
  check (storage_path like user_id::text || '/%')
);

create table if not exists public.extracted_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid not null,
  fact_key text not null,
  fact_value text not null,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  evidence text,
  review_status text not null default 'pending'
    check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  constraint extracted_facts_document_owner_fk
    foreign key (document_id, user_id)
    references public.documents (id, user_id)
    on delete cascade
);

create table if not exists public.profile_facts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  fact_key text not null,
  fact_value text not null,
  source_document_id uuid references public.documents (id) on delete set null,
  confidence numeric(4,3) check (confidence >= 0 and confidence <= 1),
  verified boolean not null default false,
  updated_at timestamptz not null default now(),
  unique (user_id, fact_key)
);

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  portal_url text,
  status text not null default 'not_started'
    check (status in ('not_started', 'in_progress', 'ready_to_submit', 'submitted')),
  created_at timestamptz not null default now()
);

create index if not exists documents_user_created_idx
  on public.documents (user_id, created_at desc);
create index if not exists extracted_facts_user_review_idx
  on public.extracted_facts (user_id, review_status, created_at desc);
create index if not exists profile_facts_user_idx
  on public.profile_facts (user_id, fact_key);
create index if not exists applications_user_created_idx
  on public.applications (user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.extracted_facts enable row level security;
alter table public.profile_facts enable row level security;
alter table public.applications enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Users manage their own documents" on public.documents;
create policy "Users manage their own documents"
  on public.documents for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own extracted facts" on public.extracted_facts;
create policy "Users manage their own extracted facts"
  on public.extracted_facts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own profile facts" on public.profile_facts;
create policy "Users manage their own profile facts"
  on public.profile_facts for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "Users manage their own applications" on public.applications;
create policy "Users manage their own applications"
  on public.applications for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Explicit grants make the tables available to the authenticated Data API role.
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant select, insert, update, delete on public.extracted_facts to authenticated;
grant select, insert, update, delete on public.profile_facts to authenticated;
grant select, insert, update, delete on public.applications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'formsaathi-documents',
  'formsaathi-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  name = excluded.name,
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users read their own FormSaathi documents" on storage.objects;
create policy "Users read their own FormSaathi documents"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'formsaathi-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users upload their own FormSaathi documents" on storage.objects;
create policy "Users upload their own FormSaathi documents"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'formsaathi-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users update their own FormSaathi documents" on storage.objects;
create policy "Users update their own FormSaathi documents"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'formsaathi-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'formsaathi-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "Users delete their own FormSaathi documents" on storage.objects;
create policy "Users delete their own FormSaathi documents"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'formsaathi-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
