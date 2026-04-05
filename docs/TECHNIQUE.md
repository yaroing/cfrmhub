# Documentation technique — CFRM Hub

## Architecture

- **Frontend** : React 19, Vite 8, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite`), React Router 7.
- **Backend** : Supabase (PostgreSQL, Auth, Row Level Security, Realtime).
- **Carte** : Leaflet + react-leaflet (tuiles OpenStreetMap).

Les secrets ne transitent que par variables d’environnement (`web/.env`, jamais commité).

## Modèle de données (résumé)

| Table / objet | Rôle |
|---------------|------|
| `profiles` | Profil applicatif lié à `auth.users`, rôle `admin` \| `validator` \| `observer` \| `field_agent` \| `focal_point`. |
| `categories` | Taxonomie ajustable (slug, libellé, ordre, actif). |
| `feedbacks` | Message unifié : canal (`web`, simulateurs, `phone` / `in_person`, **`sms_twilio`**, **`telegram_bot`**), type, description, catégories (suggérée + retenue), priorité, override, statut, localisation, contacts, métadonnées, doublon ; champs v2 : démographie, **sensible**, **fermeture de boucle**, `first_touched_at`, etc. |
| `focal_points` | Référents sensibles (type, contact, organisation). |
| `action_items` | Actions du plan d’actions (statut, échéance, catégorie). |
| `feedback_action_links` | Liaison N-N feedback ↔ action. |
| `sla_config` | Paramètres SLA (ex. délais par priorité). |
| `feedback_attachments` | Métadonnées de fichiers ; bucket Storage **`feedback-attachments`** (politiques dans migration v2). |
| `feedback_comments` | Commentaires internes (validateurs / admins). |
| `feedback_status_history` | Traçabilité des transitions de statut (trigger `AFTER UPDATE`). |
| `audit_logs` | Journal des actions (ex. soumissions publiques via RPC). |
| `notification_logs` | Notifications internes simulées (ex. priorité critique). |
| `channel_settings` | JSON de configuration des canaux simulés. |

**Ordre d’application** : jusqu’à `20260405160000_repair_telegram_bot_trigger.sql` (voir `README.md` / `INSTALLATION.md`). La migration `05160000` réaligne trigger + contrainte si `05150000` avait été omise (sinon Telegram apparaît comme canal `web`). Sans les trois premières migrations, le frontend v2 et la RPC publique étendue peuvent échouer ; les suivantes ajoutent canaux assistés, **`sms_twilio`** (voir [TWILIO.md](TWILIO.md)), **`telegram_bot`** (voir [TELEGRAM.md](TELEGRAM.md)).

## Sécurité

- **RLS** activée sur toutes les tables listées.
- **Soumission publique** : pas d’`INSERT` direct anonyme sur `feedbacks` ; fonction `submit_public_feedback` en `SECURITY DEFINER` avec validation des énumérations et longueur du texte (canaux web / simulateurs uniquement).
- **SMS Twilio** : insert réservé au backend (Edge Function avec **service_role** + validation de signature Twilio), canal `sms_twilio` ; pas d’exposition de la clé service au frontend.
- **Bot Telegram** : webhook `telegram-bot-webhook`, en-tête `X-Telegram-Bot-Api-Secret-Token` si `secret_token` défini, canal `telegram_bot`, accusé via `sendMessage` (token bot).
- **Triggers** : normalisation / assainissement des lignes anonymes ; pré-classification et accusé après `INSERT` ; détection simple de doublons ; log critique → `notification_logs`.
- **Moindre privilège** : observateur en lecture sur les feedbacks ; **agent terrain** : `SELECT` limité aux fiches qu’il a créées (`created_by`) ; point focal : lecture élargie sans écriture métier sensible hors périmètre défini en RLS.
- **Storage** : chemins typiquement `{feedback_id}/{filename}` ; politiques lecture selon rôle (voir migration Storage).

## RPC exposées (extrait)

- `submit_public_feedback(...)` — paramètres étendus (dont champs démographiques optionnels) → `{ id, receipt_message }`.  
  Droits : `GRANT EXECUTE` à `anon` et `authenticated`.
- `close_feedback_loop`, `app_audit_log`, etc. — voir migration SQL v2.

## Frontend (v2)

- **i18n** : `react-i18next`, fichiers `web/src/i18n/locales/*.json`.
- **Analytique** : Recharts (`AnalyticsPage`).
- **Carte** : données via service dédié (pins allégés), chunk lazy pour Leaflet.

## Extensions prévues

- Vrais connecteurs WhatsApp / Telegram / SMS via Edge Functions + files d’attente.
- Moteur NLP externe pour enrichir `category_suggested_id` sans remplacer la validation humaine.
- Restrictions géographiques par profil (colonne ou table de périmètres + RLS).

## Schéma visuel

Une représentation textuelle des relations principales :

```
auth.users 1 — 1 profiles
categories 1 — * feedbacks (category_id, category_suggested_id)
feedbacks 1 — * feedback_comments
feedbacks 1 — * feedback_status_history
feedbacks 1 — * feedback_attachments
feedbacks N — N action_items (via feedback_action_links)
```

Le fichier SQL de migration fait foi pour les contraintes et index.

## Déploiement

- **Frontend** : build statique (`npm run build`) sur Netlify, Vercel, S3+CloudFront, etc.
- **Supabase** : hébergé ; mettre à jour les URL autorisées (CORS / Auth redirect) pour votre domaine de prod.
