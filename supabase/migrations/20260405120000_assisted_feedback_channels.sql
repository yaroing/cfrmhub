-- Canaux pour saisie assistée (téléphone / en présence) par un utilisateur authentifié.
-- Le formulaire public (RPC submit_public_feedback) n’accepte toujours que web + simulateurs.

ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_channel_check;

ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_channel_check CHECK (
  channel IN (
    'web',
    'sms_sim',
    'whatsapp_sim',
    'telegram_sim',
    'phone',
    'in_person'
  )
);

CREATE OR REPLACE FUNCTION public.feedback_before_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.normalized_desc := lower(trim(NEW.description));
  IF auth.uid() IS NULL THEN
    NEW.status := 'new';
    NEW.category_id := NULL;
    NEW.priority_override := NULL;
    NEW.created_by := NULL;
    IF NEW.channel IS NULL OR NEW.channel NOT IN (
      'web', 'sms_sim', 'whatsapp_sim', 'telegram_sim', 'phone', 'in_person'
    ) THEN
      NEW.channel := 'web';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
