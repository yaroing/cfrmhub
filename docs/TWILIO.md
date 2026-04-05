# SMS entrant via Twilio — CFRM Hub

Les SMS reçus sur votre numéro Twilio créent un enregistrement `feedbacks` avec le canal **`sms_twilio`**, le numéro expéditeur en `contact_phone`, et des métadonnées Twilio dans `metadata` (`twilio_message_sid`, etc.).

## Prérequis

1. Migrations SQL appliquées jusqu’à **`20260405140000_twilio_sms_channel.sql`** (contrainte `channel` + index d’idempotence sur `MessageSid`).
2. Compte [Twilio](https://www.twilio.com) avec un numéro capable de recevoir des SMS.
3. [Supabase CLI](https://supabase.com/docs/guides/cli) (optionnel mais recommandé pour déployer la fonction).

## 1. Déployer l’Edge Function

Depuis la racine du dépôt :

```bash
supabase login
supabase link --project-ref <VOTRE_PROJECT_REF>
supabase functions deploy twilio-sms-inbound
```

Le fichier `supabase/config.toml` désactive la vérification JWT pour cette fonction (`verify_jwt = false`), car Twilio n’envoie pas de jeton Supabase.

## 2. Secrets Supabase

Dans le dashboard : **Project Settings → Edge Functions → Secrets** (ou `supabase secrets set`), définir :

| Secret | Description |
|--------|-------------|
| `SUPABASE_URL` | URL du projet (`https://<ref>.supabase.co`), **sans** slash final. Souvent déjà présent pour les fonctions. |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé **service_role** (ne jamais l’exposer au navigateur). **Obligatoire** dans *Project Settings → Edge Functions → Secrets* (copier depuis *Settings → API → service_role secret*). Sans elle, Twilio reçoit un SMS d’erreur explicite (plus de `500` côté fonction pour ce cas). |
| `TWILIO_AUTH_TOKEN` | **Auth Token** du compte Twilio (Console → Account → API keys & tokens). Copier-coller sans espace ni retour ligne. |
| `TWILIO_WEBHOOK_URL` | *(Optionnel)* URL **exacte** affichée dans la console Twilio pour « A message comes in ». Si absent, la fonction essaie aussi `SUPABASE_URL` + `/functions/v1/twilio-sms-inbound` et l’URL déduite des en-têtes `Host` / `X-Forwarded-Host`. |

Dans la console Twilio, l’URL du webhook doit en pratique être :

`https://<ref>.supabase.co/functions/v1/twilio-sms-inbound`

(même `ref` que dans `SUPABASE_URL`).

## 2 bis. Ouvrir l’URL dans le navigateur

Un **GET** sur la fonction répond désormais **200** avec un court texte d’aide (plus de **405** dans la console). Seul un **POST** Twilio crée un feedback ; le 405 ne concernait pas un dysfonctionnement du webhook.

## 3. Configurer le webhook chez Twilio

1. **Phone Numbers → Active numbers → [votre numéro] → Messaging configuration**.
2. **A message comes in** : méthode **HTTP POST**, URL = l’URL ci-dessus (identique à celle utilisée pour la signature).
3. Enregistrer.

## 4. Comportement

- **Signature** : en-tête `X-Twilio-Signature` vérifiée avec `TWILIO_AUTH_TOKEN` et une ou plusieurs **URL candidates** (secret optionnel + dérivation depuis `SUPABASE_URL` + requête). Rejet **403** si aucune ne correspond.
- **Longueur** : même règles que le formulaire web (10–8000 caractères) ; sinon réponse SMS d’erreur en TwiML.
- **Accusé** : TwiML `<Message>` avec le `receipt_message` généré par les triggers (tronqué pour le SMS).
- **Idempotence** : même `MessageSid` → pas de doublon (index unique + contrôle avant insert).
- **Audit** : ligne `audit_logs` avec `action = 'twilio_sms_inbound'`.

## 5. Dépannage

- **403 Forbidden** (la fonction s’exécute ~quelques centaines de ms) : échec de la **signature Twilio**. Vérifier dans l’ordre :
  1. **`TWILIO_AUTH_TOKEN`** : bien celui du **même** compte Twilio que le numéro / le `AccountSid` des requêtes (pas une sous-clé API si Twilio exige le Primary Auth Token pour la validation — en général le token principal du compte).
  2. **URL** dans Twilio = `https://<ref>.supabase.co/functions/v1/twilio-sms-inbound` sans query string, **https**, pas de slash en trop en fin (ou l’inverse : si Twilio a un slash final, aligner `TWILIO_WEBHOOK_URL` ou laisser la fonction tester les variantes après redéploiement).
  3. Redéployer la fonction après mise à jour du code (validation multi-URL + `trim()` sur le token).
- **403 immédiat** (< ~50 ms) : possible **JWT** encore exigé sur la fonction — vérifier dans le dashboard Supabase que la fonction **`twilio-sms-inbound`** a **Verify JWT** désactivé, ou que `supabase/config.toml` est pris en compte au déploiement.
- **500** (rare) : souvent échec de **démarrage** du worker (ex. import). La fonction utilise désormais `npm:@supabase/supabase-js` pour limiter ce cas. Redéployez avec la dernière version du dépôt.
- **403** : signature Twilio invalide (token ou URL webhook).
- **SMS d’erreur** (réponse **200** TwiML) : configuration (`TWILIO_AUTH_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`) ou erreur SQL (ex. migration **`sms_twilio`** non appliquée) — lire le texte du SMS et les **logs** de la fonction (`insert:` + code PostgreSQL).

Les SMS **sortants** (notifications, fermeture de boucle) ne sont pas implémentés ici ; ils pourront s’appuyer sur l’API REST Twilio séparément.
