-- CFRM Hub v2 — colonnes, tables métier, fonctions RPC, vue analytique
-- Exécuter après 20260403120000_init.sql

-- ---------------------------------------------------------------------------
-- Catégories i18n + profil agent
-- ---------------------------------------------------------------------------
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS label_en text;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agent_code text;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'validator', 'observer', 'field_agent', 'focal_point'));

-- ---------------------------------------------------------------------------
-- Feedbacks : démographie, fermeture de boucle, sensible, SLA
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS submitter_age_group text CHECK (
    submitter_age_group IS NULL OR
    submitter_age_group IN ('0_17', '18_59', '60_plus', 'mixed', 'prefer_not', 'unknown')
  ),
  ADD COLUMN IF NOT EXISTS submitter_sex text CHECK (
    submitter_sex IS NULL OR
    submitter_sex IN ('female', 'male', 'prefer_not', 'mixed', 'unknown')
  ),
  ADD COLUMN IF NOT EXISTS submitter_diversity text[],
  ADD COLUMN IF NOT EXISTS submitter_language text;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS loop_closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS loop_closed_by uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS community_response_text text CHECK (
    community_response_text IS NULL OR char_length(community_response_text) <= 4000
  ),
  ADD COLUMN IF NOT EXISTS community_notified_via text CHECK (
    community_notified_via IS NULL OR
    community_notified_via IN ('email', 'sms', 'whatsapp', 'telegram', 'phone_call', 'visit', 'other')
  );

CREATE INDEX IF NOT EXISTS idx_feedbacks_loop_closed ON public.feedbacks (loop_closed_at)
  WHERE loop_closed_at IS NOT NULL;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS is_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sensitive_type text CHECK (
    sensitive_type IS NULL OR
    sensitive_type IN ('sgbv', 'child_protection', 'sea', 'misconduct', 'security', 'other_sensitive')
  ),
  ADD COLUMN IF NOT EXISTS sensitive_flagged_by uuid REFERENCES auth.users (id),
  ADD COLUMN IF NOT EXISTS sensitive_flagged_at timestamptz;

ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS first_touched_at timestamptz;

-- ---------------------------------------------------------------------------
-- Points focaux
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.focal_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_title text,
  contact_email text,
  contact_phone text,
  sensitivity_type text NOT NULL CHECK (
    sensitivity_type IN ('sgbv', 'child_protection', 'sea', 'misconduct', 'security', 'other_sensitive')
  ),
  organisation text,
  is_internal boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focal_points ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Action tracker
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  description text CHECK (description IS NULL OR char_length(description) <= 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'deferred')),
  owner_id uuid REFERENCES auth.users (id),
  category_id uuid REFERENCES public.categories (id),
  due_date date,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.feedback_action_links (
  feedback_id uuid NOT NULL REFERENCES public.feedbacks (id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.action_items (id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, action_id)
);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_action_links ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trg_action_items_updated ON public.action_items;
CREATE TRIGGER trg_action_items_updated
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- SLA
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sla_config (
  priority text PRIMARY KEY CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_hours int NOT NULL CHECK (target_hours > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sla_config ENABLE ROW LEVEL SECURITY;

INSERT INTO public.sla_config (priority, target_hours) VALUES
  ('critical', 4), ('high', 24), ('medium', 72), ('low', 168)
ON CONFLICT (priority) DO NOTHING;

CREATE OR REPLACE FUNCTION public.track_first_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.status = 'new' AND NEW.status IS DISTINCT FROM 'new' AND NEW.first_touched_at IS NULL THEN
    NEW.first_touched_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_first_touch ON public.feedbacks;
CREATE TRIGGER trg_first_touch
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.track_first_touch();

-- ---------------------------------------------------------------------------
-- Vue analytique (RLS héritée de feedbacks via lecture standard)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.feedbacks_weekly_counts AS
SELECT
  date_trunc('week', created_at AT TIME ZONE 'UTC') AS week_start,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE feedback_type = 'complaint')::bigint AS complaints,
  COUNT(*) FILTER (WHERE feedback_type = 'alert')::bigint AS alerts,
  COUNT(*) FILTER (WHERE priority IN ('high', 'critical') OR priority_override IN ('high', 'critical'))::bigint AS high_priority
FROM public.feedbacks
GROUP BY 1
ORDER BY 1 DESC;

GRANT SELECT ON public.feedbacks_weekly_counts TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC : audit applicatif (validateurs / admins)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.app_audit_log(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_details jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'validator')
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (auth.uid(), p_action, p_entity_type, p_entity_id, COALESCE(p_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.app_audit_log(text, text, uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_audit_log(text, text, uuid, jsonb) TO authenticated;

-- ---------------------------------------------------------------------------
-- RPC : fermeture de boucle
-- ---------------------------------------------------------------------------
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
END;
$$;

REVOKE ALL ON FUNCTION public.close_feedback_loop(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_feedback_loop(uuid, text, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- Remplacer submit_public_feedback (démographie)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.submit_public_feedback(
  text, text, text, text, text, text, text, double precision, double precision
);

CREATE OR REPLACE FUNCTION public.submit_public_feedback(
  p_channel text,
  p_feedback_type text,
  p_description text,
  p_location_label text DEFAULT NULL,
  p_contact_name text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_contact_email text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL,
  p_submitter_age_group text DEFAULT NULL,
  p_submitter_sex text DEFAULT NULL,
  p_submitter_diversity text[] DEFAULT NULL,
  p_submitter_language text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  rmsg text;
BEGIN
  IF p_channel IS NULL OR p_channel NOT IN ('web', 'sms_sim', 'whatsapp_sim', 'telegram_sim') THEN
    RAISE EXCEPTION 'invalid channel';
  END IF;
  IF p_feedback_type IS NULL OR p_feedback_type NOT IN ('feedback', 'alert', 'complaint', 'suggestion', 'question') THEN
    RAISE EXCEPTION 'invalid feedback type';
  END IF;
  IF p_description IS NULL OR char_length(trim(p_description)) < 10 THEN
    RAISE EXCEPTION 'description too short';
  END IF;

  INSERT INTO public.feedbacks (
    channel, feedback_type, description, location_label,
    contact_name, contact_phone, contact_email, lat, lng,
    submitter_age_group, submitter_sex, submitter_diversity, submitter_language
  ) VALUES (
    p_channel, p_feedback_type, trim(p_description), NULLIF(trim(p_location_label), ''),
    NULLIF(trim(p_contact_name), ''), NULLIF(trim(p_contact_phone), ''), NULLIF(trim(p_contact_email), ''),
    p_lat, p_lng,
    p_submitter_age_group, p_submitter_sex, p_submitter_diversity, NULLIF(trim(p_submitter_language), '')
  ) RETURNING id INTO new_id;

  SELECT receipt_message INTO rmsg FROM public.feedbacks WHERE id = new_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    NULL,
    'public_submit',
    'feedback',
    new_id,
    jsonb_build_object('channel', p_channel, 'type', p_feedback_type)
  );

  RETURN jsonb_build_object('id', new_id, 'receipt_message', COALESCE(rmsg, ''));
END;
$$;

REVOKE ALL ON FUNCTION public.submit_public_feedback(
  text, text, text, text, text, text, text, double precision, double precision,
  text, text, text[], text
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(
  text, text, text, text, text, text, text, double precision, double precision,
  text, text, text[], text
) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_public_feedback(
  text, text, text, text, text, text, text, double precision, double precision,
  text, text, text[], text
) TO authenticated;
