-- W7 app-owned schema. No course schema is inferred. No policy or RLS changes.
-- Private tables are reachable only through the existing verified-admin boundary.
begin;
create schema if not exists punnett_private;
alter table public.punnett_images add column title text not null default '' check(length(title)<=200),
 add column alt_text text not null default '' check(length(alt_text)<=1000), add column revision integer not null default 1;

create table punnett_private.w7_providers (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(btrim(name)) between 1 and 100),
 notes text not null default '' check(length(notes)<=2000), created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_models (
 id uuid primary key default gen_random_uuid(), provider_id uuid not null references punnett_private.w7_providers(id),
 name text not null unique check(length(btrim(name)) between 1 and 100), notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_chains (
 id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 150),
 fingerprint text not null unique, created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_steps (
 id uuid primary key default gen_random_uuid(), chain_id uuid not null references punnett_private.w7_chains(id),
 position integer not null check(position>0), prompt text not null, model_id uuid not null references punnett_private.w7_models(id),
 created_at timestamptz not null default now(), revision integer not null default 1, unique(chain_id,position)
);
create table punnett_private.w7_mix (
 id uuid primary key default gen_random_uuid(), chain_id uuid not null unique references punnett_private.w7_chains(id),
 weight numeric not null default 0 check(weight>=0 and weight<=10000),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_terms (
 id uuid primary key default gen_random_uuid(), term text not null unique check(length(btrim(term)) between 1 and 200),
 definition text not null check(length(btrim(definition)) between 1 and 4000),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_examples (
 id uuid primary key default gen_random_uuid(), image_id uuid not null references public.punnett_images(id),
 caption text not null check(length(btrim(caption)) between 1 and 500), notes text not null default '' check(length(notes)<=2000),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_domains (
 id uuid primary key default gen_random_uuid(), domain text not null unique check(domain=lower(domain) and length(domain)<=253 and domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$'),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_emails (
 id uuid primary key default gen_random_uuid(), email text not null unique check(email=lower(email) and length(email)<=254 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
 created_at timestamptz not null default now(), revision integer not null default 1
);
create table punnett_private.w7_responses (
 id uuid primary key default gen_random_uuid(), generation_id uuid not null unique references public.punnett_generations(id),
 chain_id uuid not null references punnett_private.w7_chains(id), status text not null, output jsonb,
 provenance text not null, created_at timestamptz not null, revision integer not null default 1
);
revoke all on punnett_private.w7_providers,punnett_private.w7_models,punnett_private.w7_chains,punnett_private.w7_steps,
 punnett_private.w7_mix,punnett_private.w7_terms,punnett_private.w7_examples,punnett_private.w7_domains,
 punnett_private.w7_emails,punnett_private.w7_responses from public,anon,authenticated;
create index on punnett_private.w7_models(provider_id);
create index on punnett_private.w7_steps(model_id);
create index on punnett_private.w7_examples(image_id);
create index on punnett_private.w7_responses(chain_id);

-- Preserve actual model, exact prompt, and validated saved output; never invent a raw response.
create function punnett_private.w7_capture(gid uuid, source text) returns void
language plpgsql security definer set search_path='' as $$
declare g public.punnett_generations%rowtype; pid uuid; mid uuid; cid uuid;
begin
 select * into strict g from public.punnett_generations where id=gid;
 insert into punnett_private.w7_providers(name,notes) values('Google Gemini','Observed provider in the existing generation integration. Credentials remain in server environment settings.')
 on conflict(name) do update set name=excluded.name returning id into pid;
 insert into punnett_private.w7_models(provider_id,name) values(pid,g.model)
 on conflict(name) do update set name=excluded.name returning id into mid;
 insert into punnett_private.w7_chains(name,fingerprint,created_at)
 values('Recorded prompt '||substr(md5(g.prompt||':'||g.model),1,12),md5(g.prompt||':'||g.model),g.created_at)
 on conflict(fingerprint) do update set fingerprint=excluded.fingerprint returning id into cid;
 insert into punnett_private.w7_steps(chain_id,position,prompt,model_id,created_at) values(cid,1,g.prompt,mid,g.created_at) on conflict(chain_id,position) do nothing;
 insert into punnett_private.w7_mix(chain_id) values(cid) on conflict(chain_id) do nothing;
 insert into punnett_private.w7_responses(generation_id,chain_id,status,output,provenance,created_at)
 values(g.id,cid,g.status,case when g.status='completed' then (select jsonb_agg(content order by created_at,id) from public.punnett_captions where generation_id=g.id) end,
 source,g.created_at)
 on conflict(generation_id) do update set status=excluded.status,output=excluded.output,provenance=excluded.provenance,revision=w7_responses.revision+1;
end;
$$;
revoke all on function punnett_private.w7_capture(uuid,text) from public,anon,authenticated;
create function punnett_private.w7_generation_changed() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform punnett_private.w7_capture(new.id,'Saved validated captions; raw provider response is not retained.');
 return new;
end;
$$;
revoke all on function punnett_private.w7_generation_changed() from public,anon,authenticated;
create trigger w7_generation_observation after insert or update of status on public.punnett_generations
for each row execute function punnett_private.w7_generation_changed();
select punnett_private.w7_capture(id,'Historical snapshot of saved captions; raw response and failure reason were not retained.') from public.punnett_generations;

-- Fixed entity allowlist. Unknown names can never become SQL identifiers.
create function punnett_private.w7_relation(kind text) returns text language plpgsql immutable set search_path='' as $$
begin
 return case kind when 'chains' then 'w7_chains' when 'steps' then 'w7_steps' when 'mix' then 'w7_mix'
 when 'terms' then 'w7_terms' when 'examples' then 'w7_examples' when 'models' then 'w7_models'
 when 'providers' then 'w7_providers' when 'responses' then 'w7_responses' when 'domains' then 'w7_domains' when 'emails' then 'w7_emails' else null end;
end;
$$;
revoke all on function punnett_private.w7_relation(text) from public,anon,authenticated;

-- SETOF enables PostgREST range() and count: exact without direct table grants.
create function public.punnett_admin_records(kind_input text, search_input text default '', sort_input text default 'newest', chain_input uuid default null)
returns table(id text, record jsonb) language plpgsql stable security definer set search_path='' as $$
declare rel text; base text; ordering text;
begin
 perform public.punnett_require_admin();
 if search_input is null or length(search_input)>200 or sort_input is null or sort_input not in('newest','oldest','name') then raise exception 'Invalid search.' using errcode='22023'; end if;
 rel:=punnett_private.w7_relation(kind_input);
 if kind_input='requests' then
  base:='select g.id,g.image_id,g.owner_id,g.prompt,g.model,g.status,g.created_at,g.completed_at,g.archived,1 as revision,r.chain_id from public.punnett_generations g left join punnett_private.w7_responses r on r.generation_id=g.id';
 elsif kind_input='images' then
  base:='select i.*,i.id as image_id,g.archived,g.status from public.punnett_images i join public.punnett_generations g on g.image_id=i.id';
 elsif rel is null then raise exception 'Unknown entity.' using errcode='22023';
 else base:=format('select * from punnett_private.%I',rel); end if;
 ordering:=case sort_input when 'oldest' then 'q.created_at asc,q.id asc' when 'name' then 'coalesce(to_jsonb(q)->>''name'',to_jsonb(q)->>''term'',to_jsonb(q)->>''domain'',to_jsonb(q)->>''email'',q.id::text) asc,q.id asc' else 'q.created_at desc,q.id desc' end;
 return query execute 'select q.id::text,to_jsonb(q) from ('||base||') q where to_jsonb(q)::text ilike $1 and ($2 is null or coalesce(to_jsonb(q)->>''chain_id'',q.id::text)=$2::text) order by '||ordering
 using '%'||search_input||'%',chain_input;
end;
$$;
revoke all on function public.punnett_admin_records(text,text,text,uuid) from public,anon;
grant execute on function public.punnett_admin_records(text,text,text,uuid) to authenticated;

create function public.punnett_admin_mutate(kind_input text, operation_input text, id_input uuid default null, revision_input integer default null, payload_input jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare rel text; allowed text[]; cols text; result uuid;
begin
 perform public.punnett_require_admin();
 rel:=punnett_private.w7_relation(kind_input);
 allowed:=case kind_input when 'terms' then array['term','definition'] when 'examples' then array['image_id','caption','notes']
 when 'models' then array['provider_id','name','notes'] when 'providers' then array['name','notes']
 when 'domains' then array['domain'] when 'emails' then array['email'] when 'mix' then array['weight'] else null end;
 if allowed is null or operation_input is null or operation_input not in('create','update','delete')
 or (kind_input='mix' and operation_input<>'update') then raise exception 'Operation not permitted.' using errcode='42501'; end if;
 if payload_input is null or jsonb_typeof(payload_input)<>'object' or octet_length(payload_input::text)>16000 then raise exception 'Invalid fields.' using errcode='22023'; end if;
 if exists(select 1 from jsonb_object_keys(payload_input) k where not(k=any(allowed))) then raise exception 'Unknown fields.' using errcode='22023'; end if;
 if operation_input<>'create' and (id_input is null or revision_input is null or revision_input<1) then raise exception 'Record and revision required.' using errcode='22023'; end if;
 if operation_input='delete' then
  execute format('delete from punnett_private.%I where id=$1 and revision=$2 returning id',rel) into result using id_input,revision_input;
 else
  if payload_input='{}'::jsonb then raise exception 'Fields required.' using errcode='22023'; end if;
  select string_agg(format('%I',k),',') into cols from jsonb_object_keys(payload_input) k;
  if operation_input='create' then
   execute format('insert into punnett_private.%1$I(%2$s) select %2$s from jsonb_populate_record(null::punnett_private.%1$I,$1) returning id',rel,cols) into result using payload_input;
  else
   execute format('update punnett_private.%1$I set (%2$s)=(select %2$s from jsonb_populate_record(null::punnett_private.%1$I,$1)),revision=revision+1 where id=$2 and revision=$3 returning id',rel,cols) into result using payload_input,id_input,revision_input;
  end if;
 end if;
 if result is null then raise exception 'Record changed. Reload before saving.' using errcode='40001'; end if;
 return result;
end;
$$;
revoke all on function public.punnett_admin_mutate(text,text,uuid,integer,jsonb) from public,anon;
grant execute on function public.punnett_admin_mutate(text,text,uuid,integer,jsonb) to authenticated;

create function public.punnett_admin_edit_image(id_input uuid, revision_input integer, title_input text, alt_input text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.punnett_require_admin();
 if title_input is null or length(title_input)>200 or alt_input is null or length(alt_input)>1000 then raise exception 'Invalid image details.' using errcode='22023'; end if;
 update public.punnett_images set title=btrim(title_input),alt_text=btrim(alt_input),revision=revision+1 where id=id_input and revision=revision_input;
 if not found then raise exception 'Image changed. Reload before saving.' using errcode='40001'; end if;
end;
$$;
revoke all on function public.punnett_admin_edit_image(uuid,integer,text,text) from public,anon;
grant execute on function public.punnett_admin_edit_image(uuid,integer,text,text) to authenticated;
notify pgrst,'reload schema';
commit;
