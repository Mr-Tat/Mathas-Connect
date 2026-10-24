-- PREPARATION UNIQUEMENT : ne pas appliquer à la production.
-- Exécuter d'abord sur une base PostgreSQL fictive et isolée.
-- La fonction Edge authentifie l'appelant; RPC sous service_role, non exposée aux clients.
create schema if not exists connect_internal;
revoke all on schema connect_internal from public, anon, authenticated;

create table if not exists connect_internal.restore_previews (
 token_hash text primary key check (token_hash ~ '^[0-9a-f]{64}$'),
 actor_id uuid not null, class_id uuid not null, student_id uuid not null,
 app_key text not null,
 revision bigint not null check (revision >= 0),
 reset_epoch bigint not null check (reset_epoch >= 0),
 backup_reset_epoch bigint not null check (backup_reset_epoch >= 0),
 recover_past_reset boolean not null,
 backup_sha text not null check (backup_sha ~ '^[0-9a-f]{64}$'),
 after_state jsonb not null check (jsonb_typeof(after_state)='object'),
 created_at timestamptz not null default now(),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 check(expires_at <= created_at + interval '5 minutes')
);
create table if not exists connect_internal.restore_audit (
 id bigint generated always as identity primary key,
 actor_id uuid not null, class_id uuid not null, student_id uuid not null,
 app_key text not null, preview_token_hash text not null unique,
 original_exists boolean not null, original_state jsonb,
 original_revision bigint not null, original_reset_epoch bigint not null,
 restored_state_hash text not null, restored_revision bigint not null,
 restored_at timestamptz not null default now(), undone_at timestamptz,
 undo_actor_id uuid,
 check(original_exists or original_state is null)
);
revoke all on all tables in schema connect_internal from public, anon, authenticated;
-- Les tables du schema prive ne sont pas exposées par la Data API.
-- Pas de GRANT sur les tables vers anon/authenticated.

create or replace function public.connect_restore_prepare_v1(
 p_token_hash text,p_actor uuid,p_class uuid,p_student uuid,p_app text,
 p_revision bigint,p_epoch bigint,p_backup_epoch bigint,p_recover boolean,
 p_backup_sha text,p_after jsonb
) returns void language plpgsql security definer set search_path=''
as $$
declare s public.connect_states%rowtype;
begin
 if p_token_hash !~ '^[0-9a-f]{64}$' or p_backup_sha !~ '^[0-9a-f]{64}$'
    or p_after is null or pg_catalog.jsonb_typeof(p_after)<>'object'
 then raise exception 'invalid_input'; end if;
 if p_app<>'addition-ecrite-simple' then raise exception 'invalid_app'; end if;
 if not exists(select 1 from public.connect_class_permissions
   where class_id=p_class and teacher_id=p_actor and can_manage=true)
 or not exists(select 1 from public.connect_enrollments
   where class_id=p_class and student_id=p_student and left_at is null)
 then raise exception 'forbidden'; end if;
 -- Ne pas fonder la sécurité sur une seule vérification Edge.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student::text||':'||p_app,0));
 select revision,reset_epoch into s from public.connect_states
   where student_id=p_student and app_key=p_app for update;
 if coalesce(s.revision,0)<>p_revision or coalesce(s.reset_epoch,0)<>p_epoch
 then raise exception 'revision_conflict'; end if;
 if p_backup_epoch>p_epoch and s.student_id is not null
 then raise exception 'backup_newer_epoch'; end if;
 if p_backup_epoch<>p_epoch and s.student_id is not null and not p_recover
 then raise exception 'previous_reset_requires_confirmation'; end if;
 insert into connect_internal.restore_previews
 (token_hash,actor_id,class_id,student_id,app_key,revision,reset_epoch,
  backup_reset_epoch,recover_past_reset,backup_sha,after_state,expires_at)
 values (p_token_hash,p_actor,p_class,p_student,p_app,p_revision,p_epoch,
  p_backup_epoch,p_recover,p_backup_sha,p_after,now()+interval '5 minutes');
end $$;

create or replace function public.connect_restore_apply_v1(
 p_token_hash text,p_actor uuid,p_class uuid,p_student uuid,p_app text,
 p_backup_sha text,p_confirmation text
) returns table(audit_id bigint,new_revision bigint)
 language plpgsql security definer set search_path=''
as $$
declare p connect_internal.restore_previews%rowtype;
 s public.connect_states%rowtype; v_exists boolean;
 v_rev bigint;v_epoch bigint;v_audit bigint;
begin
 if p_confirmation<>'RESTAURER' then raise exception 'confirmation_required'; end if;
 select * into p from connect_internal.restore_previews
   where token_hash=p_token_hash for update;
 if not found or p.consumed_at is not null or p.expires_at<=now()
 then raise exception 'preview_expired_or_consumed'; end if;
 if p.actor_id<>p_actor or p.class_id<>p_class or p.student_id<>p_student
    or p.app_key<>p_app or p.backup_sha<>p_backup_sha
 then raise exception 'preview_mismatch'; end if;
 if not exists(select 1 from public.connect_class_permissions
    where class_id=p_class and teacher_id=p_actor and can_manage=true)
 or not exists(select 1 from public.connect_enrollments
    where class_id=p_class and student_id=p_student and left_at is null)
 then raise exception 'forbidden'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_student::text||':'||p_app,0));
 select * into s from public.connect_states
   where student_id=p_student and app_key=p_app for update;
 v_exists=found;
 v_rev=case when v_exists then s.revision else 0 end;
 v_epoch=case when v_exists then s.reset_epoch else 0 end;
 if v_rev<>p.revision or v_epoch<>p.reset_epoch
 then raise exception 'revision_conflict'; end if;
 if v_exists and p.backup_reset_epoch<>v_epoch and not p.recover_past_reset
 then raise exception 'previous_reset_requires_confirmation'; end if;
 insert into connect_internal.restore_audit
 (actor_id,class_id,student_id,app_key,preview_token_hash,original_exists,
  original_state,original_revision,original_reset_epoch,restored_state_hash,restored_revision)
 values (p_actor,p_class,p_student,p_app,p_token_hash,v_exists,
   case when v_exists then s.state_data else null end,v_rev,v_epoch,
   pg_catalog.md5(p.after_state::text),v_rev+1)
 returning id into v_audit;
 if v_exists then
  update public.connect_states
    set state_data=p.after_state,revision=v_rev+1,updated_at=now(),schema_version=1
    where student_id=p_student and app_key=p_app;
 else
  insert into public.connect_states
    (student_id,app_key,revision,reset_epoch,state_data,updated_at,schema_version)
  values(p_student,p_app,1,0,p.after_state,now(),1);
 end if;
 update connect_internal.restore_previews set consumed_at=now() where token_hash=p_token_hash;
 audit_id:=v_audit;new_revision:=v_rev+1;return next;
end $$;

create or replace function public.connect_restore_undo_v1(
 p_audit bigint,p_actor uuid,p_expected_revision bigint,p_expected_epoch bigint,
 p_confirmation text
) returns bigint language plpgsql security definer set search_path=''
as $$
declare a connect_internal.restore_audit%rowtype;s public.connect_states%rowtype;
begin
 if p_confirmation<>'ANNULER RESTAURATION' then raise exception 'confirmation_required'; end if;
 select * into a from connect_internal.restore_audit where id=p_audit for update;
 if not found then raise exception 'restore_not_found'; end if;
 if a.undone_at is not null then raise exception 'already_undone'; end if;
 if not exists(select 1 from public.connect_class_permissions
    where class_id=a.class_id and teacher_id=p_actor and can_manage=true)
 or not exists(select 1 from public.connect_enrollments
    where class_id=a.class_id and student_id=a.student_id and left_at is null)
 then raise exception 'forbidden'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(a.student_id::text||':'||a.app_key,0));
 select * into s from public.connect_states
    where student_id=a.student_id and app_key=a.app_key for update;
 if not found or s.revision<>a.restored_revision or s.revision<>p_expected_revision
    or s.reset_epoch<>a.original_reset_epoch or s.reset_epoch<>p_expected_epoch
    or pg_catalog.md5(s.state_data::text)<>a.restored_state_hash
 then raise exception 'state_changed_since_restore'; end if;
 -- Révision toujours croissante, même quand la ligne n'existait pas avant.
 update public.connect_states
    set state_data=case when a.original_exists then a.original_state else '{}'::jsonb end,
        revision=s.revision+1,updated_at=now(),schema_version=1
    where student_id=a.student_id and app_key=a.app_key;
 update connect_internal.restore_audit
    set undone_at=now(),undo_actor_id=p_actor where id=p_audit;
 return s.revision+1;
end $$;
revoke all on function public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,bigint,boolean,text,jsonb) from public,anon,authenticated;
revoke all on function public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,text) from public,anon,authenticated;
revoke all on function public.connect_restore_undo_v1(bigint,uuid,bigint,bigint,text) from public,anon,authenticated;
grant execute on function public.connect_restore_prepare_v1(text,uuid,uuid,uuid,text,bigint,bigint,bigint,boolean,text,jsonb) to service_role;
grant execute on function public.connect_restore_apply_v1(text,uuid,uuid,uuid,text,text,text) to service_role;
grant execute on function public.connect_restore_undo_v1(bigint,uuid,bigint,bigint,text) to service_role;
-- ATTENTION : rôle service_role peut fournir actor_id ; Edge DOIT récupérer actor_id
-- depuis auth.getUser(JWT) et ne jamais utiliser celui reçu du navigateur.
-- Ne pas appliquer tant que tests PostgreSQL isolés et protections Edge ne sont pas validés.
