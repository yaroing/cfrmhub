# Guide : configurer un compte Meta (Facebook) pour WhatsApp Business API

Ce document explique, **côté Meta / Facebook**, comment mettre en place l’**API Cloud WhatsApp** (WhatsApp Business Platform). Pour brancher ensuite votre projet sur CFRM Hub (webhook Supabase, secrets), voir **[WHATSAPP_BUSINESS_API.md](WHATSAPP_BUSINESS_API.md)**.

> **Important** : Meta renomme souvent ses menus (« Meta Business Suite », « Business Manager », « Developer »). Les intitulés ci-dessous correspondent à l’interface courante ; en cas d’écart, cherchez les équivalents « WhatsApp », « API », « Webhooks ».

---

## 1. Ce que vous allez obtenir

À la fin de la configuration, vous devez pouvoir :

- Identifier votre **application** Meta (App ID, **App Secret**).
- Disposer d’un **compte WhatsApp Business** (WABA) lié à l’app.
- Connaître le **Phone number ID** du numéro utilisé pour l’API.
- Générer un **jeton d’accès** permettant d’appeler l’API Graph (envoi / réception selon les droits).
- Enregistrer une **URL de webhook** HTTPS et un **jeton de vérification** pour recevoir les messages entrants.

L’**API Cloud** est hébergée par Meta : pas de serveur WhatsApp à installer chez vous (contrairement à l’ancienne API On-Premise, aujourd’hui dépréciée pour la plupart des nouveaux projets).

---

## 2. Prérequis

1. Un **compte Facebook** personnel (pour vous connecter à Meta).
2. Une **page Facebook** ou, idéalement, un **Meta Business Portfolio** (anciennement Business Manager) pour rattacher l’entreprise, la facturation et les numéros professionnels.
3. Un **numéro de téléphone** non déjà utilisé comme compte WhatsApp **grand public** sur le même usage API (Meta fournit d’abord un **numéro de test** ; le passage en production utilise un numéro dédié « Business »).

---

## 3. Créer ou préparer le compte entreprise Meta

1. Allez sur [business.facebook.com](https://business.facebook.com/) (Meta Business Suite).
2. Créez un **portfolio d’entreprise** si vous n’en avez pas, ou ouvrez celui de votre organisation.
3. Vérifiez les **informations de l’entreprise** : elles seront demandées pour passer du mode test à un déploiement avec numéro réel et volume plus important.

Sans portfolio, vous pouvez quand même démarrer en **développeur** avec un numéro de test ; pour la production, Meta exige en général une entreprise identifiée.

---

## 4. Créer une application « Developer »

1. Ouvrez [developers.facebook.com](https://developers.facebook.com/) et connectez-vous.
2. **Mes applications** → **Créer une application**.
3. Choisissez un cas d’usage adapté (souvent **Entreprise** ou **Autre** selon les options proposées), puis un nom d’app et une adresse e-mail de contact.
4. Une fois l’app créée, notez :
   - **Identifiant de l’application** (App ID) — visible en haut du tableau de bord ou dans **Paramètres de l’application → De base**.
   - **Clé secrète de l’application** (App Secret) — **Paramètres de l’application → De base** → *Afficher* la clé secrète. **Ne la partagez pas et ne la commitez pas** ; elle sert notamment à vérifier les webhooks (`X-Hub-Signature-256`).

---

## 5. Ajouter le produit « WhatsApp »

1. Dans le tableau de bord de l’application : **Ajouter un produit** (ou **Configurer** sur la carte WhatsApp).
2. Sélectionnez **WhatsApp** puis suivez l’assistant pour lier un **compte WhatsApp Business** à l’application.
3. Allez dans le menu **WhatsApp** (dans la barre latérale de l’app Developer).

Vous y trouverez typiquement :

- **API Setup** (ou **Démarrage rapide**) : numéro de test, **Phone number ID**, **WhatsApp Business Account ID** (WABA ID), et un **jeton temporaire** pour les appels API.
- Des exemples de requêtes `curl` vers `graph.facebook.com`.

**À noter** : le jeton affiché dans l’interface est souvent **court terme** (quelques heures). Pour la production, prévoyez un **jeton longue durée** ou un **utilisateur système** (voir section 8).

---

## 6. Numéro de test vs numéro de production

### Mode test (développement)

- Meta fournit un **numéro de test** et vous pouvez **ajouter jusqu’à cinq numéros** de téléphone « testeurs » dans la console (section dédiée aux destinataires de test).
- Seuls ces numéros peuvent recevoir des messages sortants depuis l’API tant que l’app n’est pas en mode production complète.
- Idéal pour valider webhooks, format des payloads et intégration (ex. CFRM Hub).

### Mode production

- Vous **enregistrez un numéro professionnel** (ou migrez un numéro) selon les règles Meta : vérification de l’entreprise, modèles de messages (*templates*) pour certaines conversations, respect des [politiques WhatsApp Business](https://www.whatsapp.com/legal/business-policy/).
- La **facturation** des conversations peut s’appliquer selon la catégorie (marketing, utilitaire, service, etc.) — consultez la documentation tarifaire Meta à jour.

---

## 7. Identifiants à copier dans un gestionnaire de secrets

Gardez ces valeurs **hors du dépôt Git** (coffre-fort d’équipe, secrets Supabase, variables d’environnement serveur) :

| Élément | Où le trouver (indicatif) |
|--------|---------------------------|
| **App ID** | Paramètres de l’application → De base |
| **App Secret** | Idem (ne jamais l’exposer publiquement) |
| **Phone number ID** | WhatsApp → API Setup (identifiant du numéro utilisé pour l’API) |
| **WhatsApp Business Account ID (WABA)** | Souvent sur la même page ; utile pour le support et certaines API |
| **Jeton d’accès** | Généré dans l’interface (temporaire) ou via utilisateur système / longue durée |

Pour CFRM Hub, le mapping vers les secrets Edge est décrit dans [WHATSAPP_BUSINESS_API.md](WHATSAPP_BUSINESS_API.md).

---

## 8. Jetons d’accès : temporaire, longue durée, utilisateur système

### Jeton temporaire (interface Developer)

- Pratique pour un premier `curl` ou un test Postman.
- Expire rapidement : **ne pas** l’utiliser seul en production.

### Jeton longue durée

- À générer selon la procédure Meta (échange à partir d’un jeton court, avec l’App ID et le App Secret).
- Durée de vie prolongée mais **à renouveler** ; documentez la procédure de rotation.

### Utilisateur système (recommandé en production)

- Dans **Meta Business Suite** / **Business Manager** : paramètres entreprise → **Utilisateurs** → **Utilisateurs système**.
- Créez un utilisateur système, attribuez-lui les **actifs** nécessaires (l’application, le compte WhatsApp Business) et les **permissions** WhatsApp (ex. gestion des messages).
- Générez un **jeton** pour cet utilisateur avec les bonnes portées ; stockez-le comme secret.

Les écrans exacts évoluent ; la référence officielle : [documentation Meta — accès et tokens](https://developers.facebook.com/docs/whatsapp/business-management-api/get-started).

---

## 9. Configurer le webhook (réception des messages)

1. Dans l’app Developer : **WhatsApp** → **Configuration** (parfois sous-section *Webhooks*).
2. **URL du callback** : une URL **HTTPS** publique (ex. votre fonction Supabase `.../functions/v1/whatsapp-business-webhook` — voir le guide CFRM Hub).
3. **Jeton de vérification** (*Verify token*) : une **chaîne que vous inventez** (ex. longue chaîne aléatoire). La même valeur doit être configurée côté serveur qui répond au GET de vérification.
4. Après validation du callback, **abonnez-vous** au champ **`messages`** (et aux autres champs utiles selon votre besoin).

Meta effectue d’abord une requête **GET** (`hub.mode`, `hub.verify_token`, `hub.challenge`) ; votre serveur doit renvoyer le `hub.challenge` si le token correspond. Les notifications arrivent ensuite en **POST** avec un corps JSON ; la signature `X-Hub-Signature-256` permet de vérifier l’authenticité avec le **App Secret**.

---

## 10. Tester l’envoi et la réception

1. **Réception** : envoyez un message **texte** depuis un numéro autorisé (test ou production) vers le numéro WhatsApp Business ; vérifiez que votre webhook reçoit un POST et que votre backend le traite.
2. **Envoi** : utilisez l’API Graph `POST /{phone-number-id}/messages` avec l’en-tête `Authorization: Bearer <token>` et un corps JSON conforme (type `text`, `template`, etc.). Pour les utilisateurs hors fenêtre de service client, Meta impose souvent des **modèles** (*message templates*) pré-approuvés.

---

## 11. Bonnes pratiques sécurité et conformité

- **Ne jamais** committer App Secret, jetons, ou verify token dans Git.
- **Révoquer et régénérer** tout secret exposé (fuite dans un ticket, une capture d’écran, un dépôt public).
- Respecter la **politique commerciale WhatsApp** et les règles sur le **consentement** des utilisateurs (opt-in lorsque requis).
- Journaliser côté serveur les erreurs API **sans** logger les jetons ni les corps complets contenant des données personnelles inutiles.

---

## 12. Ressources officielles Meta

- [WhatsApp Cloud API — Vue d’ensemble](https://developers.facebook.com/docs/whatsapp/cloud-api/overview)
- [Premiers pas — Cloud API](https://developers.facebook.com/docs/whatsapp/cloud-api/get-started)
- [Webhooks](https://developers.facebook.com/docs/graph-api/webhooks/getting-started)
- [Envoi de messages](https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-messages)

---

## 13. Lien avec CFRM Hub

Une fois le compte Meta et le webhook configurés, enchaînez avec **[WHATSAPP_BUSINESS_API.md](WHATSAPP_BUSINESS_API.md)** : déploiement de la fonction Edge, secrets `WHATSAPP_*`, et activation de l’ingestion dans **Administration → Canaux**.
