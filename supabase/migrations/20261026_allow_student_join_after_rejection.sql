-- Only modify reapplication logic; retain authorization, idempotency and 15 minute expiration.
CREATE OR REPLACE FUNCTION public.connect_submit_join(p_class uuid, p_auth_user uuid, p_first text, p_initial text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_existing public.connect_join_requests%rowtype;
  v_first text := btrim(p_first);
  v_initial text := upper(btrim(p_initial));
  v_code text;
  v_id uuid;
  v_i integer;
  v_random bytea;
begin
  if p_auth_user is null or p_class is null then
    raise exception 'invalid_identity';
  end if;
  if char_length(v_first) not between 1 and 40
     or char_length(v_initial) <> 1
     or v_first !~ '^[[:alpha:]][[:alpha:] ''-]*$'
     or v_initial !~ '^[[:alpha:]]$' then
    raise exception 'invalid_name';
  end if;
  if not exists(select 1 from public.connect_classes where id=p_class) then
    raise exception 'class_unavailable';
  end if;
  -- Identity AND anonymous status are verified by connect-api with
  -- Supabase Auth getUser(token). Never grant service_role access to auth.users.
  if exists(select 1 from public.connect_devices
     where auth_user_id=p_auth_user and state='approved') then
    raise exception 'device_already_approved';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_auth_user::text),74017);
  if exists(select 1 from public.connect_join_requests
     where auth_user_id=p_auth_user and class_id<>p_class
       and state='pending' and expires_at>now()) then
    raise exception 'other_class_pending';
  end if;
  select * into v_existing from public.connect_join_requests
    where class_id=p_class and auth_user_id=p_auth_user for update;
  if found then
    if v_existing.state='approved' then raise exception 'already_registered'; end if;
    -- Rejected requests may be submitted again, with a new code and expiry.
    if v_existing.state='pending' and v_existing.expires_at>now() then
      return jsonb_build_object('id',v_existing.id,'code',v_existing.verify_code,
        'expires_at',v_existing.expires_at,'state','pending');
    end if;
  end if;
  for v_i in 1..12 loop
    v_random := extensions.gen_random_bytes(2);
    v_code := lpad(((get_byte(v_random,0)*256+get_byte(v_random,1))%10000)::text,4,'0');
    begin
      if v_existing.id is not null then
        update public.connect_join_requests
        set first_name=v_first,last_initial=v_initial,verify_code=v_code,
            state='pending',created_at=now(),expires_at=now()+interval '15 minutes',
            reviewed_by=null,reviewed_at=null,student_id=null
        where id=v_existing.id returning id into v_id;
      else
        insert into public.connect_join_requests
         (class_id,auth_user_id,first_name,last_initial,verify_code,expires_at)
        values(p_class,p_auth_user,v_first,v_initial,v_code,now()+interval '15 minutes')
        returning id into v_id;
      end if;
      return jsonb_build_object('id',v_id,'code',v_code,
          'expires_at',now()+interval '15 minutes','state','pending');
    exception when unique_violation then
      if v_i=12 then raise exception 'please_retry'; end if;
    end;
  end loop;
  raise exception 'please_retry';
end $function$

