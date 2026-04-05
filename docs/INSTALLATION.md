# Guide d’installation — CFRM Hub

## 1. Supabase — migrations dans l’ordre

1. Créez un projet sur [supabase.com](https://supabase.com).
2. Dans *SQL Editor*, exécutez **dans cet ordre** (fichiers du dépôt) :
   1. `supabase/migrations/20260403120000_init.sql`
   2. `supabase/migrations/20260404120000_v2_features.sql`
   3. `supabase/migrations/20260404120001_v2_rls_storage.sql`
   4. `supabase/migrations/20260405120000_assisted_feedback_channels.sql`
   5. `supabase/migrations/20260405140000_twilio_sms_channel.sql` (SMS Twilio — voir [TWILIO.md](TWILIO.md))
   6. `supabase/migrations/20260405150000_telegram_bot_channel.sql` (bot Telegram — voir [TELEGRAM.md](TELEGRAM.md))
   7. `supabase/migrations/20260405160000_repair_telegram_bot_trigger.sql` (réparation si la #6 manquait — Telegram affiché comme « web »)
   8. `supabase/migrations/20260406210000_whatsapp_business_channel.sql` (WhatsApp Business / Meta Cloud API — compte Meta : [GUIDE_COMPTE_META_WHATSAPP_BUSINESS.md](GUIDE_COMPTE_META_WHATSAPP_BUSINESS.md), branchement CFRM : [WHATSAPP_BUSINESS_API.md](WHATSAPP_BUSINESS_API.md))
   9. `supabase/migrations/20260406230000_dashboard_ai_setting.sql` (texte configurable du bloc « Analyse IA » + lecture pour tous les rôles connectés)
3. Vérifiez les messages :
   - Si `ALTER PUBLICATION supabase_realtime ADD TABLE` indique que la table est déjà dans la publication, c’est normal.
4. **Authentication** : activez le fournisseur *Email* (mot de passe).
5. Créez un premier utilisateur (inscription depuis l’app ou création manuelle dans le dashboard).
6. Attribuez le rôle administrateur :

   ```sql
   update public.profiles set role = 'admin' where email = 'vous@exemple.org';
   ```

7. **Realtime** : *Database* → *Replication* → activer `feedbacks` pour `supabase_realtime`.

## 2. Stockage (pièces jointes)

La migration **`20260404120001_v2_rls_storage.sql`** crée le bucket **`feedback-attachments`** et des politiques RLS sur `storage.objects`.  

Après exécution, vérifiez dans *Storage* que le bucket existe. Si vous aviez créé un bucket manuellement auparavant, harmonisez les noms et politiques avec cette migration.

## 3. Application web

```bash
cd web
cp .env.example .env
```

Renseignez :

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Puis :

```bash
npm install
npx playwright install chromium   # optionnel : pour npm run test:e2e
npm run dev
```

## 4. Vérifications automatisées (recommandées)

| Commande | Quand | Objectif |
|----------|--------|----------|
| `npm run test` | Après `npm install` | Tests unitaires / composants (Vitest) |
| `npm run smoke:supabase` | Après migrations + `.env` | Vérifie que la RPC `submit_public_feedback` répond (crée **une** ligne de test dans `feedbacks`) |
| `npm run test:e2e` | Avant démo | Parcours public (accueil, formulaire, validation client) sans dépendre d’une soumission réelle réussie |

## 5. Vérifications manuelles

- Page d’accueil sans erreur.
- Soumission d’un feedback anonyme → confirmation avec référence UUID.
- Connexion avec le compte admin → tableau de bord alimenté.
- Changement de statut sur une fiche → historique mis à jour.

Utilisez aussi **`docs/CHECKLIST.md`** avant une démo ou un pilote.

## 6. Données de démonstration

Utilisez le formulaire public et les trois simulateurs (connecté en validateur ou admin) pour générer des jeux variés. Les catégories par défaut sont insérées par la migration initiale.

Option : exécuter `docs/DEMO_DATA.sql` dans l’éditeur SQL (selon droits) pour injecter quelques fiches types.

## 7. Sauvegardes

Voir **[BACKUP.md](BACKUP.md)** pour les rappels sur la continuité des données Supabase.
