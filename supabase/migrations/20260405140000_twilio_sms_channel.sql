-- Canal SMS réel (Twilio) — alimenté par l’Edge Function `twilio-sms-inbound` (service_role).

ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_channel_check;

ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_channel_check CHECK (
  channel IN (
    'web',
    'sms_sim',
    'sms_twilio',
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
      'web',
      'sms_sim',
      'sms_twilio',
      'whatsapp_sim',
      'telegram_sim',
      'phone',
      'in_person'
    ) THEN
      NEW.channel := 'web';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Idempotence : Twilio peut renvoyer le même webhook plusieurs fois.
CREATE UNIQUE INDEX IF NOT EXISTS idx_feedbacks_twilio_message_sid
  ON public.feedbacks ((metadata ->> 'twilio_message_sid'))
  WHERE channel = 'sms_twilio'
    AND (metadata ->> 'twilio_message_sid') IS NOT NULL
    AND char_length(metadata ->> 'twilio_message_sid') > 0;
