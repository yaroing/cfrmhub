-- Réparation : si la migration 05150000 n’a pas été appliquée, le trigger
-- feedback_before_insert (version post-Twilio) ne connaît pas « telegram_bot »
-- et réécrit channel → 'web' pour les inserts service_role (webhook Telegram).
-- Ce script est idempotent si 05150000 a déjà été exécutée.

ALTER TABLE public.feedbacks DROP CONSTRAINT IF EXISTS feedbacks_channel_check;

ALTER TABLE public.feedbacks ADD CONSTRAINT feedbacks_channel_check CHECK (
  channel IN (
    'web',
    'sms_sim',
    'sms_twilio',
    'whatsapp_sim',
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_feedbacks_telegram_update_id
  ON public.feedbacks ((metadata ->> 'telegram_update_id'))
  WHERE channel = 'telegram_bot'
    AND (metadata ->> 'telegram_update_id') IS NOT NULL
    AND char_length(metadata ->> 'telegram_update_id') > 0;
