# Checklist finale — prêt à l’emploi (prototype CFRM Hub)

Utilisez cette liste avant une démo ou un pilote.

## Infrastructure

- [ ] Projet Supabase créé.
- [ ] Migrations SQL appliquées **dans l’ordre** : `20260403120000_init.sql` → `20260404120000_v2_features.sql` → `20260404120001_v2_rls_storage.sql` → `20260405120000_assisted_feedback_channels.sql` → `20260405140000_twilio_sms_channel.sql` (si Twilio) → `20260405150000_telegram_bot_channel.sql` (si Telegram) → `20260405160000_repair_telegram_bot_trigger.sql` (idempotent ; utile si la migration Telegram avait été oubliée).
- [ ] Bucket `feedback-attachments` présent (créé par la migration v2 storage) si vous utilisez les pièces jointes.
- [ ] Realtime activé sur `public.feedbacks`.
- [ ] Au moins un compte `admin` en base (`profiles.role`).
- [ ] Fichier `web/.env` renseigné (URL + clé anon).
- [ ] `npm run build` réussi (`web/`).
- [ ] `npm run test` réussi.
- [ ] `npm run smoke:supabase` réussi (optionnel mais recommandé — crée une ligne test).
- [ ] `npm run test:e2e` réussi (après `npx playwright install chromium`).

## Fonctionnel

- [ ] Accueil public responsive, liens *Connexion* et *Soumettre un feedback*.
- [ ] Formulaire public : validation champs, message d’erreur, confirmation avec référence.
- [ ] Connexion / déconnexion.
- [ ] Liste dashboard + filtres + recherche.
- [ ] Détail fiche : statut, catégorie, priorité, commentaires (selon rôle).
- [ ] Historique des statuts cohérent avec les modifications.
- [ ] Simulateurs SMS / WhatsApp / Telegram (utilisateur connecté).
- [ ] Export CSV (validateur / admin).
- [ ] Admin : utilisateurs, catégories, canaux, audit, points focaux (admin seul).
- [ ] Thème clair / sombre opérationnel.

## Sécurité & gouvernance

- [ ] Routes `/app/*` inaccessibles sans session (redirection login).
- [ ] Routes `/app/admin/*` inaccessibles sans rôle admin.
- [ ] Aucune clé secrète dans le dépôt Git.

## Communication

- [ ] README et guides lus par l’équipe pilote.
- [ ] Responsable identifié pour la montée de version (schéma + front).
- [ ] [BACKUP.md](BACKUP.md) pris en compte pour la continuité des données si pilote prolongé.
