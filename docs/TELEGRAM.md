# Bot Telegram — CFRM Hub

Les messages texte envoyés au bot créent un enregistrement `feedbacks` avec le canal **`telegram_bot`**, le pseudo ou prénom dans `contact_name`, et des métadonnées (`telegram_update_id`, `telegram_chat_id`, etc.) pour l’idempotence et le suivi.

## Prérequis

1. Migrations jusqu’à **`20260405150000_telegram_bot_channel.sql`**.
2. Un bot créé avec [@BotFather](https://t.me/BotFather) sur Telegram (vous recevez un **token** `123456:ABC...`).
3. [Supabase CLI](https://supabase.com/docs/guides/cli) pour déployer la fonction (recommandé).

## 1. Déployer l’Edge Function

```bash
supabase login
supabase link --project-ref <VOTRE_PROJECT_REF>
supabase functions deploy telegram-bot-webhook
```

`supabase/config.toml` désactive la vérification JWT pour cette fonction (`verify_jwt = false`).

## 2. Secrets Supabase

*Project Settings → Edge Functions → Secrets* (ou `supabase secrets set`) :

| Secret | Description |
|--------|-------------|
| `TELEGRAM_BOT_TOKEN` | Token fourni par BotFather (`123456:ABC-DEF...`). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **service_role** du projet (comme pour Twilio). |
| `TELEGRAM_WEBHOOK_SECRET` | **Recommandé** : chaîne aléatoire (1–256 caractères, `A-Za-z0-9_-`) ; la même valeur sera passée à `setWebhook` comme `secret_token`. |
| `SUPABASE_URL` | Optionnel si le host de la requête est `*.supabase.co`. |

Ne commitez jamais le **token** du bot dans le dépôt ni ne le collez dans un canal public. Si le token a fuité, utilisez BotFather (**/revoke** ou recréer le bot) pour en obtenir un nouveau.

## 3. Enregistrer le webhook auprès de Telegram

Remplacez `<TOKEN>`, `<URL>` et `<SECRET>` :

**URL du webhook** (HTTPS obligatoire) :

`https://<ref>.supabase.co/functions/v1/telegram-bot-webhook`

Exemple avec `curl` (**Linux / macOS / Git Bash**) — une seule commande ou une ligne par `\` :

```bash
curl -sS -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<ref>.supabase.co/functions/v1/telegram-bot-webhook" \
  -d "secret_token=<SECRET>"
```

### Windows PowerShell

Dans PowerShell, `curl` pointe souvent vers `Invoke-WebRequest` (syntaxe différente). Utilisez **`curl.exe`** (vrai cURL, livré avec Windows 10/11) sur **une seule ligne**, ou des **backticks** `` ` `` (pas des `\`) pour couper la ligne :

```powershell
curl.exe -sS -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" -d "url=https://<ref>.supabase.co/functions/v1/telegram-bot-webhook" -d "secret_token=<SECRET>"
```

Avec retours à la ligne PowerShell :

```powershell
curl.exe -sS -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" `
  -d "url=https://<ref>.supabase.co/functions/v1/telegram-bot-webhook" `
  -d "secret_token=<SECRET>"
```

Alternative sans `curl.exe` (corps **form-urlencoded**, comme l’API Telegram) :

```powershell
$u = "https://api.telegram.org/bot<TOKEN>/setWebhook"
$b = "url=https://<ref>.supabase.co/functions/v1/telegram-bot-webhook&secret_token=<SECRET>"
Invoke-RestMethod -Method Post -Uri $u -Body $b -ContentType "application/x-www-form-urlencoded"
```

- `secret_token` doit être **identique** au secret `TELEGRAM_WEBHOOK_SECRET` dans Supabase.
- Sans `secret_token`, la fonction accepte les POST sans en-tête secret (**non recommandé** en production).

Vérifier :

```bash
curl -sS "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Sous PowerShell : `curl.exe -sS "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"`

## 4. Comportement

- **GET** sur l’URL : texte d’aide (pas d’update Telegram).
- **POST** : corps JSON `Update` ; seuls les messages **texte** (ou texte édité) sont traités.
- **`/start`** et **`/help`** : message d’accueil, pas de création de feedback.
- Longueur du texte : **10–8000** caractères (aligné sur le formulaire web).
- **Idempotence** : même `update_id` → pas de doublon (index unique + contrôle avant insert).
- **Réponse utilisateur** : `sendMessage` avec le `receipt_message` généré par les triggers (tronqué si besoin).
- **Audit** : `audit_logs` avec `action = 'telegram_bot_inbound'`.

Les pièces jointes seules (sans texte) reçoivent une invite à envoyer un message texte ; pas d’upload Storage depuis ce webhook (évolution possible).

## 5. Dépannage

### Canal affiché « Formulaire web » pour un message Telegram

L’Edge Function envoie bien `channel: telegram_bot`, mais le trigger **`feedback_before_insert`** (avant `INSERT`) réécrit le canal en **`web`** lorsque `auth.uid()` est nul (service_role) **et** que `telegram_bot` n’est **pas** dans la liste autorisée du trigger. Cela arrive si la migration **`20260405150000_telegram_bot_channel.sql`** n’a pas été exécutée sur la base (état courant après Twilio seulement).

**Correctif** : exécuter dans le *SQL Editor* la migration **`20260405150000_telegram_bot_channel.sql`**, ou la suivante **`20260405160000_repair_telegram_bot_trigger.sql`** (équivalent idempotent + index), ou `supabase db push` jusqu’à inclure ces fichiers.

**Vérification** :

```sql
SELECT channel, metadata->>'telegram_update_id' AS tg_update, metadata->>'source' AS src
FROM public.feedbacks
WHERE metadata ? 'telegram_update_id'
ORDER BY created_at DESC
LIMIT 10;
```

Si `channel` = `web` alors que `telegram_update_id` est renseigné, le trigger était obsolète.

**Corriger les lignes déjà enregistrées en `web`** (après migration du trigger) :

```sql
UPDATE public.feedbacks
SET channel = 'telegram_bot'
WHERE channel = 'web'
  AND metadata->>'source' = 'telegram_bot'
  AND metadata->>'telegram_update_id' IS NOT NULL;
```

---

- **403** : `TELEGRAM_WEBHOOK_SECRET` défini côté Supabase mais absent ou différent dans l’en-tête `X-Telegram-Bot-Api-Secret-Token` (ou `setWebhook` sans le bon `secret_token`).
- **Pas de réponse dans Telegram** : vérifier `TELEGRAM_BOT_TOKEN` et les logs de la fonction ; erreurs d’API Telegram sont journalisées (`Telegram API sendMessage ...`).
- **Insert refusé** : migration **`telegram_bot`** non appliquée ou contrainte `channel` ; consulter les logs (`insert:`).

Pour **retirer** le webhook :

```bash
curl -sS -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
```

PowerShell : `curl.exe -sS -X POST "https://api.telegram.org/bot<TOKEN>/deleteWebhook"`
