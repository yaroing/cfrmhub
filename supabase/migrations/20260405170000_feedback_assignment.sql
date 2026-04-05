-- CFRM Hub — assignation des feedbacks au personnel + historique + audit

-- ---------------------------------------------------------------------------
-- Profils : spécialité affichée à l’assignation (ex. thème SGBV, protection)
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS specialty text;

-- ---------------------------------------------------------------------------
-- Feedbacks : responsable courant
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedbacks
  ADD COLUMN IF NOT EXISTS assigned_to uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_feedbacks_assigned_to ON public.feedbacks (assigned_to);

-- ---------------------------------------------------------------------------
-- Historique des changements d’assignation (journal par ticket)
-- ---------------------------------------------------------------------------
CREATE TABLE public.feedback_assignment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.feedbacks (id) ON DELETE CASCADE,
  previous_assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  new_assignee_id uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  assigned_by uuid REFERENCES public.profiles (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feedback_assignment_history_feedback
  ON public.feedback_assignment_history (feedback_id);

CREATE INDEX IF NOT EXISTS idx_feedback_assignment_history_actor
  ON public.feedback_assignment_history (assigned_by);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs (user_id);

-- ---------------------------------------------------------------------------
-- Trigger : horodatage, auteur, ligne d’historique, entrée audit_logs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_log_feedback_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN
    IF NEW.assigned_to IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = NEW.assigned_to
          AND p.role IN ('admin', 'validator', 'observer', 'focal_point')
      ) THEN
        RAISE EXCEPTION 'assignee must be staff (admin, validator, observer, focal_point)';
      END IF;
    END IF;

    NEW.assigned_at := now();
    NEW.assigned_by := auth.uid();

    INSERT INTO public.feedback_assignment_history (feedback_id, previous_assignee_id, new_assignee_id, assigned_by)
    VALUES (NEW.id, OLD.assigned_to, NEW.assigned_to, auth.uid());

    INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
      auth.uid(),
      'feedback_assigned',
      'feedback',
      NEW.id,
      jsonb_build_object(
        'previous_assignee_id', OLD.assigned_to,
        'new_assignee_id', NEW.assigned_to
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_feedback_assignment ON public.feedbacks;
CREATE TRIGGER trg_feedback_assignment
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_log_feedback_assignment();

-- ---------------------------------------------------------------------------
-- RLS : historique d’assignation (lecture staff, pas d’écriture directe client)
-- ---------------------------------------------------------------------------
ALTER TABLE public.feedback_assignment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY feedback_assignment_history_select ON public.feedback_assignment_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedbacks f
      WHERE f.id = feedback_assignment_history.feedback_id
        AND (
          public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point')
          OR (public.profile_role(auth.uid()) = 'field_agent' AND f.created_by = auth.uid())
        )
    )
  );

-- ---------------------------------------------------------------------------
-- Annuaire minimal pour validateurs / admins (liste des profils assignables)
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_staff_directory ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.profile_role(auth.uid()) IN ('admin', 'validator')
    AND role IN ('admin', 'validator', 'observer', 'focal_point')
  );

GRANT SELECT ON public.feedback_assignment_history TO authenticated;
