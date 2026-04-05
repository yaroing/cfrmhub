-- Canal WhatsApp Business (Meta Cloud API) — feedbacks + déduplication par wamid.

ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_channel_check;

ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_channel_check CHECK (
  channel IN (
    'web',
    'sms_sim',
    'sms_twilio',
    'whatsapp_sim',
    'whatsapp_business',
    'telegram_sim',
    'telegram_bot',
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
      'whatsapp_business',
      'telegram_sim',
      'telegram_bot',
      'phone',
      'in_person'
    ) THEN
      NEW.channel := 'web';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedbacks_whatsapp_wamid
  ON public.feedbacks ((metadata ->> 'wa_message_id'))
  WHERE channel = 'whatsapp_business'
    AND (metadata ->> 'wa_message_id') IS NOT NULL
    AND char_length(metadata ->> 'wa_message_id') > 0;

INSERT INTO public.channel_settings (key, value)
VALUES (
  'whatsapp_business',
  '{"enabled": false, "integration": "meta_cloud_api"}'::jsonb
)
ON CONFLICT (key) DO NOTHING;
