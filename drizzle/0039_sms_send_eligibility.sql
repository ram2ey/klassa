ALTER TABLE public.sms_dispatches ADD COLUMN lease_token uuid;--> statement-breakpoint
-- The worker can revalidate a dispatch without being granted access to pupil,
-- guardian, preference or restriction tables. Only this narrow operation is exposed.
CREATE FUNCTION public.klassa_claim_sms_dispatch(claim_token uuid)
RETURNS TABLE(id uuid, recipient_phone text, message text, invitation_id uuid, lease_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  dispatch public.sms_dispatches%ROWTYPE;
  eligible boolean;
  checked integer := 0;
BEGIN
  IF claim_token IS NULL THEN RAISE EXCEPTION 'A lease token is required'; END IF;
  LOOP
    SELECT d.* INTO dispatch FROM public.sms_dispatches d
      WHERE d.status = 'queued' ORDER BY d.created_at, d.id
      FOR UPDATE SKIP LOCKED LIMIT 1;
    IF NOT FOUND THEN RETURN; END IF;
    IF dispatch.invitation_id IS NOT NULL THEN
      SELECT EXISTS (SELECT 1 FROM public.sms_invitations i
        WHERE i.id = dispatch.invitation_id AND i.organization_id = dispatch.organization_id
          AND i.revoked_at IS NULL AND i.accepted_at IS NULL AND i.expires_at > now()
          AND i.phone_number = dispatch.recipient_phone) INTO eligible;
    ELSE
      SELECT EXISTS (
        SELECT 1 FROM public.guardians g
        JOIN public.student_guardians link ON link.guardian_id = g.id AND link.organization_id = g.organization_id
        JOIN public.students s ON s.id = link.student_id AND s.organization_id = link.organization_id
        JOIN public.organizations o ON o.id = s.organization_id
        WHERE dispatch.purpose = 'announcement' AND g.id = dispatch.guardian_id
          AND s.id = dispatch.student_id AND o.id = dispatch.organization_id
          AND o.suspended_at IS NULL AND s.status = 'active' AND s.processing_restricted_at IS NULL
          AND link.has_legal_responsibility AND g.phone_verified_at IS NOT NULL
          AND dispatch.recipient_phone ~ '^\+233[0-9]{9}$'
          AND dispatch.recipient_phone = CASE
            WHEN regexp_replace(g.phone, '[^0-9+]', '', 'g') LIKE '+%'
              THEN regexp_replace(g.phone, '[^0-9+]', '', 'g')
            WHEN regexp_replace(g.phone, '[^0-9+]', '', 'g') LIKE '233%'
              THEN '+' || regexp_replace(g.phone, '[^0-9+]', '', 'g')
            ELSE '+233' || regexp_replace(regexp_replace(g.phone, '[^0-9+]', '', 'g'), '^0+', '') END
          AND NOT EXISTS (SELECT 1 FROM public.guardian_consents c
            WHERE c.organization_id = o.id AND c.guardian_id = g.id AND NOT c.opt_in_sms_announcements)
          AND NOT EXISTS (SELECT 1 FROM public.court_restrictions r
            WHERE r.organization_id = o.id AND r.student_id = s.id AND r.is_enforced
              AND (r.restricted_guardian_id IS NULL OR r.restricted_guardian_id = g.id)
              AND (r.prohibit_direct_contact OR r.prohibit_disclosure)
              AND r.effective_date <= timezone('UTC', now())::date
              AND (r.expiration_date IS NULL OR r.expiration_date >= timezone('UTC', now())::date))
      ) INTO eligible;
    END IF;
    IF eligible THEN
      UPDATE public.sms_dispatches d SET status = 'processing', attempt_count = attempt_count + 1,
        leased_until = now() + interval '60 seconds', lease_token = claim_token, updated_at = now()
        WHERE d.id = dispatch.id;
      RETURN QUERY SELECT dispatch.id, dispatch.recipient_phone::text, dispatch.message,
        dispatch.invitation_id, claim_token;
      RETURN;
    END IF;
    UPDATE public.sms_dispatches d SET status = 'cancelled',
      error = 'Recipient is no longer eligible; create a new announcement after reviewing contacts',
      leased_until = NULL, lease_token = NULL, updated_at = now() WHERE d.id = dispatch.id;
    checked := checked + 1;
    IF checked >= 100 THEN RETURN; END IF;
  END LOOP;
END;
$$;--> statement-breakpoint
REVOKE ALL ON FUNCTION public.klassa_claim_sms_dispatch(uuid) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.klassa_claim_sms_dispatch(uuid) TO klassa_sms_worker;
