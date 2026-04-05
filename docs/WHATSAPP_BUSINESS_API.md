# WhatsApp Business — API Cloud Meta (Facebook)

Ce document décrit la configuration du canal **WhatsApp Business** dans CFRM Hub : réception des messages via l’[API Cloud de WhatsApp](https://developers.facebook.com/docs/whatsapp/cloud-api), création de fiches `feedbacks` avec `channel = 'whatsapp_business'`, et envoi d’un accusé de réponse texte.

**Configurer le compte Meta / Facebook (Business Suite, app Developer, tokens, webhook côté Meta)** : voir le guide pas à pas **[GUIDE_COMPTE_META_WHATSAPP_BUSINESS.md](GUIDE_COMPTE_META_WHATSAPP_BUSINESS.md)**.

## Prérequis

1. Migration **`20260406210000_whatsapp_business_channel.sql`** appliquée sur le projet Supabase.
2. Un **compte Meta Business** et une **application** dans [Meta for Developers](https://developers.facebook.com/) (voir le guide ci-dessus si besoin).
3. Produit **WhatsApp** ajouté à l’app, avec un **numéro de test** ou un numéro professionnel vérifié.
4. [Supabase CLI](https://supabase.com/docs/guides/cli) pour déployer la fonction Edge.

## 1. Déployer l’Edge Function

```bash
supabase login
supabase link --project-ref <VOTRE_PROJECT_REF>
supabase functions deploy whatsapp-business-webhook
```

Le fichier `supabase/config.toml` désactive la vérification JWT pour cette fonction (`verify_jwt = false`), afin que Meta puisse appeler l’URL sans en-tête `Authorization` Supabase.

**URL du webhook** (à enregistrer dans la console Meta) :

`https://<project-ref>.supabase.co/functions/v1/whatsapp-business-webhook`

## 2. Secrets Supabase (Edge Functions)

Dans *Project Settings → Edge Functions → Secrets* (ou `supabase secrets set`) :

| Secret | Rôle |
|--------|------|
| `WHATSAPP_VERIFY_TOKEN` | Chaîne que **vous choisissez** ; la même valeur doit être saisie comme *Verify token* lors de la configuration du webhook dans Meta. |
| `WHATSAPP_APP_SECRET` | **App Secret** de l’application Meta (paramètres de l’app → *App secret*). Sert à valider l’en-tête `X-Hub-Signature-256` sur les POST. **Fortement recommandé.** |
| `WHATSAPP_ACCESS_TOKEN` | Jeton d’accès permettant d’appeler l’API Graph pour **envoyer** les réponses texte (accusés de réception). Utilisez un jeton **longue durée** associé à un utilisateur système avec les permissions WhatsApp adaptées. |
| `WHATSAPP_PHONE_NUMBER_ID` | Identifiant du numéro WhatsApp (**Phone number ID** affiché dans la section WhatsApp → API Setup). |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **service_role** du projet (comme pour Telegram / Twilio). |
| `SUPABASE_URL` | Optionnel si le host de la requête est `*.supabase.co`. |

Ne commitez jamais ces valeurs dans le dépôt.

## 3. Configurer le webhook dans Meta

1. **Meta for Developers** → votre application → **WhatsApp** → **Configuration**.
2. Dans *Webhook*, cliquez sur **Edit** / **Configure**.
3. **Callback URL** : l’URL Supabase ci-dessus.
4. **Verify token** : exactement la valeur de `WHATSAPP_VERIFY_TOKEN`.
5. Après vérification (requête GET `hub.mode=subscribe`…), souscrivez au champ **`messages`** pour le compte WhatsApp Business concerné.

Meta envoie un **GET** pour la vérification, puis des **POST** JSON pour les événements.

## 4. Activer l’ingestion côté CFRM Hub

Dans l’application web, connecté en **admin** : **Administration → Canaux**.

- Carte **WhatsApp Business** : cliquez sur **Activer l’ingestion** lorsque les secrets sont en place et le webhook vérifié.

Tant que `enabled` est à `false` dans `channel_settings.whatsapp_business`, la fonction répond `200` à Meta mais **ne crée pas** de fiches (utile pendant les tests d’infrastructure).

## 5. Comportement métier

- Seuls les messages **texte** (`type: "text"`) sont pris en charge ; longueur min. 10 caractères, max. 8000 (aligné sur le formulaire public).
- **Idempotence** : l’identifiant WhatsApp du message (`wamid…`) est stocké dans `metadata.wa_message_id` ; un doublon ne recrée pas de fiche.
- **Réponse utilisateur** : après insertion, un message texte est renvoyé via l’API Graph si `WHATSAPP_ACCESS_TOKEN` et `WHATSAPP_PHONE_NUMBER_ID` sont définis (contenu : `receipt_message` généré côté base ou message par défaut).
- Numéro expéditeur : stocké dans `contact_phone` (chiffres).

## 6. Filtres et libellés

Le canal apparaît dans le tableau de bord et les listes comme **WhatsApp Business (Meta)** (`channel.whatsapp_business` en i18n).

## 7. Dépannage

| Symptôme | Piste |
|----------|--------|
| Vérification webhook échoue | Vérifier que `WHATSAPP_VERIFY_TOKEN` correspond au champ Meta ; URL HTTPS exacte ; fonction déployée. |
| POST 403 | Signature : vérifier `WHATSAPP_APP_SECRET` et le corps brut de la requête (pas de re-parse JSON avant vérif). |
| Aucune fiche créée | Vérifier **Activer l’ingestion** dans l’admin ; logs de la fonction Edge dans Supabase. |
| Pas de réponse WhatsApp | Vérifier le jeton Graph, le `phone_number_id`, et les permissions d’envoi de messages. |

## Références officielles

- [WhatsApp Cloud API — Get Started](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhooks — WhatsApp](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Sending messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)
