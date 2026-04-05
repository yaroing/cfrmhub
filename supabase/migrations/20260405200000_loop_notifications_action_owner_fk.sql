-- FK action_items.owner_id → profiles pour jointures PostgREST (owner:profiles)
-- + enqueue notification sortante lors de la fermeture de boucle communautaire

ALTER TABLE public.action_items
  DROP CONSTRAINT IF EXISTS action_items_owner_id_fkey;

ALTER TABLE public.action_items
  ADD CONSTRAINT action_items_owner_id_profiles_fkey
  FOREIGN KEY (owner_id) REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.close_feedback_loop(
  p_feedback_id uuid,
  p_response_text text,
  p_channel text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n int;
  v_contact_email text;
  v_contact_phone text;
  v_contact_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'validator')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_response_text IS NULL OR char_length(trim(p_response_text)) < 1 THEN
    RAISE EXCEPTION 'empty response';
  END IF;
  IF p_channel IS NULL OR p_channel NOT IN (
    'email', 'sms', 'whatsapp', 'telegram', 'phone_call', 'visit', 'other'
  ) THEN
    RAISE EXCEPTION 'invalid channel';
  END IF;

  SELECT f.contact_email, f.contact_phone, f.contact_name
  INTO v_contact_email, v_contact_phone, v_contact_name
  FROM public.feedbacks f
  WHERE f.id = p_feedback_id;

  UPDATE public.feedbacks
  SET
    loop_closed_at = now(),
    loop_closed_by = auth.uid(),
    community_response_text = trim(p_response_text),
    community_notified_via = p_channel
  WHERE id = p_feedback_id AND loop_closed_at IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n = 0 THEN
    RAISE EXCEPTION 'not found or already closed';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'loop_closed',
    'feedback',
    p_feedback_id,
    jsonb_build_object('via', p_channel)
  );

  INSERT INTO public.notification_logs (feedback_id, channel, payload, status)
  VALUES (
    p_feedback_id,
    'loop_closure',
    jsonb_build_object(
      'type', 'loop_closure',
      'response_text', trim(p_response_text),
      'notified_via', p_channel,
      'contact_email', v_contact_email,
      'contact_phone', v_contact_phone,
      'contact_name', v_contact_name
    ),
    'pending'
  );
END;
$$;
