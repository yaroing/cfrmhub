# Migrations Supabase — CFRM Hub

## Fichier principal

- `migrations/20260403120000_init.sql` : création des tables, index, triggers de pré-classification et d’historique, politiques RLS, publication Realtime (si supportée), données initiales (catégories, paramètres de canaux), fonction RPC `submit_public_feedback`.

## Ordre d’application

Appliquer ce script une fois sur une base vide (nouveau projet Supabase). En cas de réexécution partielle, adapter manuellement (idempotence non garantie sur tous les objets).

## Contraintes nommées (PostgREST)

Les requêtes du client React utilisent les noms de clés étrangères :

- `feedbacks_category_id_fkey`
- `feedbacks_category_suggested_id_fkey`

Si PostgreSQL génère d’autres noms sur votre instance, mettez à jour les chaînes `select(...)` dans `web/src/services/feedbackService.ts`.

## Edge Functions

- **`functions/twilio-sms-inbound`** : webhook HTTP POST Twilio (SMS entrant) → insert `feedbacks` (`channel = sms_twilio`). Voir `docs/TWILIO.md` et `config.toml` (`verify_jwt = false`).
- **`functions/telegram-bot-webhook`** : webhook Bot API (POST JSON `Update`) → insert `feedbacks` (`channel = telegram_bot`). Voir `docs/TELEGRAM.md` et `config.toml` (`verify_jwt = false`). **Migrations** : `20260405150000` + `20260405160000` (réparation) — sans elles, le trigger peut forcer `channel = web`.
