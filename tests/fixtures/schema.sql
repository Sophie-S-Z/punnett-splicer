-- Isolated test fixture for the W3/W4/W5 app-owned contract.
-- Derived from Selection's owner-confirmed migrations. Not a live schema probe.
create role anon; create role authenticated;
create schema auth;
create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid;
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb;
$$;
create table public.profiles(
  id uuid primary key references auth.users(id) on delete cascade,
  first_name text,last_name text,avatar_path text,
  is_superadmin boolean not null default false,is_matrix_admin boolean not null default false,
  updated_at timestamptz not null default now()
);
create table public.punnett_images(
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
  storage_path text unique,mime_type text not null,created_at timestamptz not null default now()
);
create table public.punnett_generations(
  id uuid primary key default gen_random_uuid(),image_id uuid not null unique references public.punnett_images(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,model text not null,status text not null default 'pending',
  created_at timestamptz not null default now(),completed_at timestamptz,archived boolean not null default false
);
create table public.punnett_captions(
  id uuid primary key default gen_random_uuid(),generation_id uuid not null references public.punnett_generations(id) on delete cascade,
  image_id uuid not null references public.punnett_images(id) on delete cascade,
  content text not null check(char_length(btrim(content)) between 1 and 500),created_at timestamptz not null default now()
);
create table public.punnett_caption_votes(
  id uuid primary key default gen_random_uuid(),owner_id uuid not null references auth.users(id) on delete cascade,
  caption_id uuid not null references public.punnett_captions(id) on delete cascade,
  vote smallint not null check(vote in(-1,1)),created_at timestamptz not null default now(),unique(owner_id,caption_id)
);
revoke all on public.profiles,public.punnett_images,public.punnett_generations,public.punnett_captions,public.punnett_caption_votes from public,anon,authenticated;
