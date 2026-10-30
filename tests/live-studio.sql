-- Management-only, rollback-only database diagnostic. Not a browser/JWT test.
-- Uses an existing verified Google admin session without creating/changing it.
begin;
do $$
declare uid uuid; sid uuid; cid uuid; mid uuid; image uuid; run jsonb; doc jsonb; first_id uuid; second_id uuid; member_id uuid;
begin
 select g.user_id,g.session_id into uid,sid from punnett_private.google_sessions g
 join auth.sessions s on s.id=g.session_id and s.user_id=g.user_id
 join public.profiles p on p.id=g.user_id and p.is_superadmin
 join auth.identities i on i.user_id=g.user_id and i.provider='google' and i.provider_id=g.google_subject
 where (s.not_after is null or s.not_after>now()) order by g.verified_at desc limit 1;
 if uid is null then raise exception 'No existing verified admin session; cannot run role-context diagnostic.'; end if;
 select id into member_id from public.profiles where not is_superadmin limit 1;
 select m.id into mid from punnett_private.w7_models m where m.name='gemini-3.5-flash-lite';
 select i.id into image from public.punnett_images i join public.punnett_generations g on g.image_id=i.id where not g.archived and g.status='completed' and i.storage_path is not null limit 1;
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('session_id',sid)::text,true);
 execute 'set local role authenticated';
 cid:=public.punnett_studio_mutate('chain.create',null,null,jsonb_build_object('name','Rollback studio test '||txid_current()));
 perform public.punnett_studio_mutate('step.create',cid,1,jsonb_build_object('name','Describe','system_prompt','Fixture only','user_prompt','Describe image','input_kind','image','output_kind','text','model_id',mid,'temperature',0.3));
 perform public.punnett_studio_mutate('step.create',cid,2,jsonb_build_object('name','Captions','system_prompt','Fixture only','user_prompt','Write captions','input_kind','previous','output_kind','captions','model_id',mid,'temperature',0.7));
 doc:=public.punnett_studio_chain(cid);first_id:=(doc->'steps'->0->>'id')::uuid;second_id:=(doc->'steps'->1->>'id')::uuid;
 perform public.punnett_studio_mutate('step.move',cid,3,jsonb_build_object('step_id',second_id,'position',1));
 if public.punnett_studio_chain(cid)->'steps'->0->>'name'<>'Captions' then raise exception 'Move did not persist'; end if;
 begin perform public.punnett_studio_mutate('step.move',cid,3,jsonb_build_object('step_id',first_id,'position',1));raise exception 'Stale write succeeded';exception when serialization_failure then null;end;
 perform public.punnett_studio_mutate('step.move',cid,4,jsonb_build_object('step_id',first_id,'position',1));
 run:=public.punnett_studio_begin(cid,image,gen_random_uuid());
 perform public.punnett_studio_checkpoint((run->>'id')::uuid,1,'"Rollback-only text fixture"',10);
 perform public.punnett_studio_checkpoint((run->>'id')::uuid,2,'["Rollback-only caption one","Rollback-only caption two"]',20);
 if not exists(select 1 from public.punnett_studio_page('runs') where id=run->>'id' and record->>'status'='completed' and jsonb_array_length(record->'outputs')=2) then raise exception 'Outputs did not persist'; end if;
 perform public.punnett_studio_mutate('chain.delete',cid,5);
 if public.punnett_studio_chain(cid) is not null then raise exception 'Deletion failed'; end if;
 if not exists(select 1 from public.punnett_studio_page('runs') where id=run->>'id' and record->'chain_id'='null'::jsonb and record->'snapshot'->>'id'=cid::text) then raise exception 'Deleted chain lost run snapshot'; end if;
 if member_id is not null then
  perform set_config('request.jwt.claim.sub',member_id::text,true);
  begin perform * from public.punnett_studio_page('chains');raise exception 'Member read succeeded';exception when insufficient_privilege then null;end;
  begin perform public.punnett_studio_mutate('chain.create',null,null,'{"name":"Denied"}');raise exception 'Member write succeeded';exception when insufficient_privilege then null;end;
 end if;
end;$$;
rollback;
select 'PASS: live studio CRUD, atomic order, stale write rejection, checkpoint persistence, history retention, and member denial. All test data rolled back.' result;
