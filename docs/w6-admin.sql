-- Proposed W6 API for the existing app-owned W5 schema.
-- Apply only after comparing w6-preflight.sql with the installed schema.
-- No policies, RLS flags, table privileges, auth users, or role flags are changed.
begin;

do $$
begin
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='is_superadmin' and data_type='boolean')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='punnett_images' and column_name='storage_path')
     or not exists(select 1 from information_schema.columns where table_schema='public' and table_name='punnett_generations' and column_name='archived') then
    raise exception 'Verify the installed W5 schema before installing the admin API.';
  end if;
end;
$$;

create or replace function public.punnett_admin_access()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (auth.jwt()->'app_metadata'->>'provider') = 'google'
    and exists(select 1 from public.profiles where id=auth.uid() and is_superadmin is true), false
  );
$$;
revoke all on function public.punnett_admin_access() from public, anon;
grant execute on function public.punnett_admin_access() to authenticated;

create or replace function public.punnett_require_admin()
returns uuid language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.punnett_admin_access() then
    raise exception 'Google superadmin access required.' using errcode='42501';
  end if;
  return auth.uid();
end;
$$;
revoke all on function public.punnett_require_admin() from public, anon;
grant execute on function public.punnett_require_admin() to authenticated;

create index if not exists punnett_votes_caption_idx on public.punnett_caption_votes(caption_id);

create or replace function public.punnett_admin_page(
  kind_input text, offset_input integer default 0, limit_input integer default 25,
  search_input text default '', sort_input text default 'newest', archived_input boolean default false
) returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare base_query text; result jsonb; total bigint; ordering text;
begin
  perform public.punnett_require_admin();
  if offset_input is null or offset_input not between 0 and 1000000
    or limit_input is null or limit_input not between 1 and 200
    or search_input is null or char_length(search_input)>200
    or sort_input is null or sort_input not in ('newest','oldest')
    or archived_input is null then
    raise exception 'Invalid page request.' using errcode='22023';
  end if;
  ordering := case when sort_input='oldest' then 'created_at asc, id asc' else 'created_at desc, id desc' end;
  case kind_input
    when 'users' then base_query := 'select id, first_name, last_name, is_superadmin, is_matrix_admin, updated_at as created_at
      from public.profiles where concat_ws('' '',first_name,last_name,id::text) ilike $1';
    when 'media' then base_query := format('select i.id, i.id as image_id, i.owner_id, i.created_at,
      g.status, g.model, g.prompt, g.archived,
      (select count(*) from public.punnett_captions c where c.image_id=i.id) as caption_count,
      coalesce((select jsonb_agg(jsonb_build_object(''id'',c.id,''content'',c.content) order by c.created_at,c.id)
        from public.punnett_captions c where c.image_id=i.id),''[]''::jsonb) as captions
      from public.punnett_images i join public.punnett_generations g on g.image_id=i.id
      where g.archived=%L and (concat_ws('' '',i.id::text,g.model,g.status) ilike $1
        or exists(select 1 from public.punnett_captions c where c.image_id=i.id and c.content ilike $1))', archived_input);
    when 'captions' then base_query := format('select c.id,c.image_id,c.content,c.created_at,g.model,
      (select count(*) from public.punnett_caption_votes v where v.caption_id=c.id and v.vote=1) as up,
      (select count(*) from public.punnett_caption_votes v where v.caption_id=c.id and v.vote=-1) as down
      from public.punnett_captions c join public.punnett_generations g on g.id=c.generation_id
      where g.archived=%L and g.status=''completed'' and concat_ws('' '',c.content,c.id::text) ilike $1', archived_input);
    when 'ratings' then base_query := format('select v.id,v.owner_id,v.caption_id,v.vote,v.created_at,c.image_id,c.content
      from public.punnett_caption_votes v join public.punnett_captions c on c.id=v.caption_id
      join public.punnett_generations g on g.id=c.generation_id
      where g.archived=%L and g.status=''completed'' and concat_ws('' '',c.content,v.owner_id::text) ilike $1', archived_input);
    else raise exception 'Unknown entity.' using errcode='22023';
  end case;
  execute 'select count(*) from ('||base_query||') q' into total using '%'||search_input||'%';
  execute 'select coalesce(jsonb_agg(to_jsonb(q)),''[]''::jsonb) from ('||base_query||' order by '||ordering||' limit $2 offset $3) q'
    into result using '%'||search_input||'%',limit_input,offset_input;
  return jsonb_build_object('rows',result,'total',total,'offset',offset_input,'limit',limit_input);
end;
$$;
revoke all on function public.punnett_admin_page(text,integer,integer,text,text,boolean) from public,anon;
grant execute on function public.punnett_admin_page(text,integer,integer,text,text,boolean) to authenticated;

create or replace function public.punnett_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  perform public.punnett_require_admin();
  with active as (select * from public.punnett_generations where not archived),
    captions as (select c.* from public.punnett_captions c join active g on g.id=c.generation_id where g.status='completed'),
    votes as (select v.* from public.punnett_caption_votes v join captions c on c.id=v.caption_id),
    ranked as (select c.id,c.image_id,c.content,count(v.id) as ratings,
      count(v.id) filter(where v.vote=1) as up, count(v.id) filter(where v.vote=-1) as down
      from captions c left join votes v on v.caption_id=c.id group by c.id,c.image_id,c.content)
  select jsonb_build_object(
    'asOf',now(),'timezone','UTC','minVotes',5,
    'users',(select count(*) from public.profiles),
    'media',(select count(*) from active),
    'captions',(select count(*) from captions),
    'ratings',(select count(*) from votes),
    'recentRatings',(select count(*) from votes where created_at>=now()-interval '7 days'),
    'completed',(select count(*) from active where status='completed'),
    'failed',(select count(*) from active where status='failed'),
    'pending',(select count(*) from active where status='pending'),
    'unrated',(select count(*) from ranked where ratings=0),
    'qualified',(select count(*) from ranked where ratings>=5),
    'trend',(select jsonb_agg(jsonb_build_object('day',d.day::date,'count',
      (select count(*) from votes where (created_at at time zone 'UTC')::date=d.day::date)) order by d.day)
      from generate_series((now() at time zone 'UTC')::date-13,(now() at time zone 'UTC')::date,interval '1 day') d(day)),
    'leaders',coalesce((select jsonb_agg(to_jsonb(q)) from (select *,up::numeric/ratings as win_rate from ranked
      where ratings>=5 order by up::numeric/ratings desc,ratings desc,id limit 10) q),'[]'::jsonb)
  ) into result;
  return result;
end;
$$;
revoke all on function public.punnett_admin_overview() from public,anon;
grant execute on function public.punnett_admin_overview() to authenticated;

create or replace function public.punnett_admin_edit_caption(id_input uuid, content_input text, expected_input text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.punnett_require_admin();
  if content_input is null or char_length(btrim(content_input)) not between 1 and 500 then
    raise exception 'Caption must contain 1 to 500 characters.' using errcode='22023';
  end if;
  update public.punnett_captions set content=btrim(content_input) where id=id_input and content=expected_input;
  if not found then raise exception 'Caption changed. Reload before editing.' using errcode='40001'; end if;
end;
$$;
revoke all on function public.punnett_admin_edit_caption(uuid,text,text) from public,anon;
grant execute on function public.punnett_admin_edit_caption(uuid,text,text) to authenticated;

create or replace function public.punnett_admin_archive_media(id_input uuid, archived_input boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.punnett_require_admin();
  if archived_input is null then raise exception 'Choose an archive state.' using errcode='22023'; end if;
  update public.punnett_generations set archived=archived_input where image_id=id_input;
  if not found then raise exception 'Media no longer exists.' using errcode='22023'; end if;
end;
$$;
revoke all on function public.punnett_admin_archive_media(uuid,boolean) from public,anon;
grant execute on function public.punnett_admin_archive_media(uuid,boolean) to authenticated;

create or replace function public.punnett_admin_image_path(id_input uuid)
returns text language plpgsql stable security definer set search_path = '' as $$
declare result text;
begin
  perform public.punnett_require_admin();
  select storage_path into result from public.punnett_images where id=id_input;
  return result;
end;
$$;
revoke all on function public.punnett_admin_image_path(uuid) from public,anon;
grant execute on function public.punnett_admin_image_path(uuid) to authenticated;

notify pgrst,'reload schema';
commit;
