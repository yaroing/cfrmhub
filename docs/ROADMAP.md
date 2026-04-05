# Feuille de route — CFRM Hub

## État actuel (prototype)

- **v0 / prototype** : application web + schéma Supabase documenté, soumission publique (RPC), tableau de bord, rôles, simulateurs multicanaux (SMS / WhatsApp / Telegram **simulés**), administration, extensions v2 (actions, SLA, sensibilité, pièces jointes, analytique, i18n partielle).

## Court terme (stabilisation démo / pilote léger)

- Finaliser la recette : `docs/CHECKLIST.md` + `npm run smoke:supabase` + `npm run test:e2e` sur environnement de test.
- Aligner documentation et migrations après chaque évolution SQL.
- Compléter i18n (écrans admin, simulateurs — en cours ou à poursuivre).

## Moyen terme (produit)

- **Connecteurs réels** : files d’attente + Edge Functions (ou services externes) pour SMS, WhatsApp Business API, Telegram Bot — en conservant le même modèle `feedbacks.channel`.
- **Notifications** : canaux sortants (e-mail, SMS) traçables et configurables par organisation.
- **Rapports** : exports enrichis, tableaux de bord sectoriels, indicateurs de délai issus de `feedback_status_history`.

## Long terme

- Gouvernance multi-organisations (si besoin), périmètres géographiques par profil, intégration NLP optionnelle pour suggestion de catégorie.

Les priorités doivent être **validées** avec les équipes terrain et la conformité (protection des données, consentement).
