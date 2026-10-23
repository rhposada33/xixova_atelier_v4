create or replace function public.connect_privacy_prepare(p_request uuid,p_actor uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.connect_privacy_requests;l public.leads;
begin
 select * into r from public.connect_privacy_requests where id=p_request;
 perform pg_advisory_xact_lock(hashtextextended(r.lead_id::text,31));
 select * into l from public.leads where id=r.lead_id for update;
 select * into r from public.connect_privacy_requests where id=p_request for update;
 if r.phase='completed' then return jsonb_build_object('completed',true);end if;
 perform set_config('request.jwt.claim.sub',p_actor::text,true);
 if r.id is null or r.requested_by is distinct from p_actor or r.decided_by=p_actor or not private.is_org_admin(r.organization_id) or r.phase not in ('approved','prepared') then raise exception using errcode='42501',message='independent_approval_required';end if;
 if not exists(select 1 from public.organization_members m join public.profiles p on p.user_id=m.user_id where m.organization_id=r.organization_id and m.user_id=r.decided_by and m.active and m.role='organization_admin' and p.active) then raise exception using errcode='42501',message='reviewer_no_longer_authorized';end if;
 if exists(select 1 from public.connect_privacy_requests where lead_id=l.id and purpose='export' and decision='exported') then raise exception using errcode='55000',message='untracked_export_review_required';end if;
 if exists(select 1 from public.connect_privacy_requests where lead_id=l.id and decision='hold') then raise exception using errcode='42501',message='legal_hold';end if;
 if not exists(select 1 from private.privacy_fixtures where lead_id=l.id) then raise exception using errcode='55000',message='synthetic_fixture_required';end if;
 if private.contact_hash(l.contact_channel,l.contact_value) is null then raise exception using errcode='55000',message='ledger_key_required';end if;
 if l.version<>r.expected_version then raise exception using errcode='PT409',message='preview_stale';end if;
 if exists(select 1 from public.leads x where x.id<>l.id and x.organization_id=l.organization_id and private.contact_hash(x.contact_channel,x.contact_value)=private.contact_hash(l.contact_channel,l.contact_value)) then raise exception using errcode='55000',message='related_subject_review_required';end if;
 -- Identity accounts are a different lifecycle; never erase them through a buyer request.
 if l.contact_channel='email' and exists(select 1 from auth.users where lower(email)=lower(l.contact_value)) then raise exception using errcode='55000',message='identity_account_review_required';end if;
 update public.connect_privacy_requests set phase='prepared',executed_by=p_actor where id=r.id;
 perform 1 from public.broker_invitations where id in(select m.invitation_id from private.mail_outbox m join private.privacy_resources x on x.mail_id=m.id where x.lead_id=l.id) order by id for update;
 perform 1 from private.mail_outbox where id in(select mail_id from private.privacy_resources where lead_id=l.id) order by id for update;
 -- Cancel only explicitly inventoried synthetic mail; dispatch/accepted mail cannot be recalled.
 if exists(select 1 from private.privacy_resources x join private.mail_outbox m on m.id=x.mail_id where x.lead_id=l.id and (m.dispatch_at is not null or m.state='sent' or m.attempts>0)) then raise exception using errcode='55000',message='external_mail_copy_review_required';end if;
 update public.broker_invitations set status='cancelled',version=version+1 where id in(select m.invitation_id from private.mail_outbox m join private.privacy_resources x on x.mail_id=m.id where x.lead_id=l.id) and status='pending';
 return jsonb_build_object('completed',false,'id',r.id,'leadId',l.id,'organizationId',l.organization_id,'contactHash',private.contact_hash(l.contact_channel,l.contact_value),'actor',r.requested_by,
 'resources',coalesce((select jsonb_agg(jsonb_build_object('id',id,'kind',kind,'bucket',bucket,'path',path)) from private.privacy_resources where lead_id=l.id and kind<>'mail'),'[]'));
end$$;
