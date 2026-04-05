-- CFRM Hub v2 — politiques RLS révisées (rôles focal_point, field_agent) + stockage

-- ---------------------------------------------------------------------------
-- Feedbacks : remplacer les politiques existantes
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS feedbacks_auth_select ON public.feedbacks;
DROP POLICY IF EXISTS feedbacks_admin_update ON public.feedbacks;
DROP POLICY IF EXISTS feedbacks_validator_update ON public.feedbacks;
DROP POLICY IF EXISTS feedbacks_admin_delete ON public.feedbacks;
DROP POLICY IF EXISTS feedbacks_auth_insert ON public.feedbacks;

CREATE POLICY feedbacks_select ON public.feedbacks FOR SELECT TO authenticated
  USING (
    public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point')
    OR (
      public.profile_role(auth.uid()) = 'field_agent'
      AND created_by = auth.uid()
    )
  );

CREATE POLICY feedbacks_insert_staff ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY feedbacks_insert_field_agent ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) = 'field_agent');

CREATE POLICY feedbacks_update_admin ON public.feedbacks FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

CREATE POLICY feedbacks_update_validator ON public.feedbacks FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) = 'validator')
  WITH CHECK (public.profile_role(auth.uid()) = 'validator');

CREATE POLICY feedbacks_admin_delete ON public.feedbacks FOR DELETE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- Commentaires & historique : point focal
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS comments_select ON public.feedback_comments;
CREATE POLICY comments_select ON public.feedback_comments FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

DROP POLICY IF EXISTS history_select ON public.feedback_status_history;
CREATE POLICY history_select ON public.feedback_status_history FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

-- ---------------------------------------------------------------------------
-- Pièces jointes : upload anonyme récent
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS att_anon_insert ON public.feedback_attachments;
CREATE POLICY att_anon_insert ON public.feedback_attachments FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.feedbacks f
      WHERE f.id = feedback_id
        AND f.created_at > now() - interval '3 hours'
    )
  );

-- Lecture pour observateurs / validateurs / admins (inchangé logique, élargir focal)
DROP POLICY IF EXISTS att_auth_all ON public.feedback_attachments;
CREATE POLICY att_auth_select ON public.feedback_attachments FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

CREATE POLICY att_auth_insert ON public.feedback_attachments FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY att_auth_update ON public.feedback_attachments FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'))
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY att_auth_delete ON public.feedback_attachments FOR DELETE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- Focal points
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS focal_points_read ON public.focal_points;
DROP POLICY IF EXISTS focal_points_admin ON public.focal_points;

CREATE POLICY focal_points_read ON public.focal_points FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'focal_point'));

CREATE POLICY focal_points_admin ON public.focal_points FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS action_read ON public.action_items;
DROP POLICY IF EXISTS action_mutate ON public.action_items;
DROP POLICY IF EXISTS action_update ON public.action_items;
DROP POLICY IF EXISTS action_delete ON public.action_items;
DROP POLICY IF EXISTS action_link_read ON public.feedback_action_links;
DROP POLICY IF EXISTS action_link_mutate ON public.feedback_action_links;
DROP POLICY IF EXISTS action_link_delete ON public.feedback_action_links;

CREATE POLICY action_read ON public.action_items FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

CREATE POLICY action_mutate ON public.action_items FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY action_update ON public.action_items FOR UPDATE TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'))
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY action_delete ON public.action_items FOR DELETE TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin');

CREATE POLICY action_link_read ON public.feedback_action_links FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

CREATE POLICY action_link_mutate ON public.feedback_action_links FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY action_link_delete ON public.feedback_action_links FOR DELETE TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'));

-- ---------------------------------------------------------------------------
-- SLA config
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS sla_read ON public.sla_config;
DROP POLICY IF EXISTS sla_admin ON public.sla_config;

CREATE POLICY sla_read ON public.sla_config FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point'));

CREATE POLICY sla_admin ON public.sla_config FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- ---------------------------------------------------------------------------
-- Bucket stockage (privé, 10 Mo, types restreints)
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'feedback-attachments',
  'feedback-attachments',
  false,
  10485760,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS storage_feedback_anon_insert ON storage.objects;
CREATE POLICY storage_feedback_anon_insert ON storage.objects FOR INSERT TO anon
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND EXISTS (
      SELECT 1 FROM public.feedbacks f
      WHERE f.id::text = (storage.foldername(name))[1]
        AND f.created_at > now() - interval '3 hours'
    )
  );

DROP POLICY IF EXISTS storage_feedback_auth_read ON storage.objects;
CREATE POLICY storage_feedback_auth_read ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'feedback-attachments'
    AND public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point')
  );

DROP POLICY IF EXISTS storage_feedback_auth_write ON storage.objects;
CREATE POLICY storage_feedback_auth_write ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'feedback-attachments'
    AND public.profile_role(auth.uid()) IN ('admin', 'validator')
  );

DROP POLICY IF EXISTS storage_feedback_auth_update ON storage.objects;
CREATE POLICY storage_feedback_auth_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'feedback-attachments' AND public.profile_role(auth.uid()) IN ('admin', 'validator'));

DROP POLICY IF EXISTS storage_feedback_admin_delete ON storage.objects;
CREATE POLICY storage_feedback_admin_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'feedback-attachments' AND public.profile_role(auth.uid()) = 'admin');
