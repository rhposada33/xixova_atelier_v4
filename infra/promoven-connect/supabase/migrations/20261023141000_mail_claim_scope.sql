create or replace function public.connect_mail_claim(p_worker uuid,p_lease_seconds integer default 30,p_max_attempts integer default 5) returns jsonb language plpgsql security definer set search_path='' as $$
declare r private.mail_outbox; recipient_row public.broker_invitations;
begin
 if p_worker is null or p_lease_seconds not between 15 and 120 or p_max_attempts not between 1 and 10 then raise exception using errcode='22023',message='invalid_claim';end if;
 update private.mail_outbox o set state='cancelled',last_code='invitation_inactive',lease_id=null,lease_until=null,updated_at=now()
 from public.broker_invitations i where o.invitation_id=i.id and o.state in ('pending','retry','processing') and (i.status<>'pending' or i.expires_at<=now() or not exists(select 1 from public.organizations g where g.id=i.organization_id and g.status='active'));
 update private.mail_outbox set state='failed',last_code='attempts_exhausted',updated_at=now() where (state in ('pending','retry') or (state='processing' and lease_until<=now() and dispatch_at is null)) and attempts>=max_attempts;
 select * into r from private.mail_outbox o where (o.state in ('pending','retry') and next_attempt_at<=now() and attempts<max_attempts)
 or (o.state='processing' and lease_until<=now()) order by o.created_at,o.id for update skip locked limit 1;
 if not found then return null;end if;
 update private.mail_outbox set state='processing',attempts=attempts+case when dispatch_at is null then 1 else 0 end,max_attempts=p_max_attempts,
 lease_id=gen_random_uuid(),worker_id=p_worker,lease_until=now()+make_interval(secs=>p_lease_seconds),updated_at=now() where id=r.id returning * into r;
 select * into recipient_row from public.broker_invitations where id=r.invitation_id;
 return to_jsonb(r)||jsonb_build_object('recipient',recipient_row.invited_email,'token_hash',recipient_row.token_hash,'expires_at',recipient_row.expires_at);
end$$;
notify pgrst,'reload schema';
