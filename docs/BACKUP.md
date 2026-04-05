# Sauvegardes et continuité — Supabase (CFRM Hub)

Ce document complète l’installation pour un **pilote** ou une **mise en production** légère.

## Ce que Supabase gère

- Base PostgreSQL (données métier, auth, stockage des métadonnées).
- Fichiers binaires (bucket `feedback-attachments` si activé).
- Configuration Auth, RLS, Edge Functions éventuelles.

## Recommandations

1. **Plans payants** : sur les projets Pro, activer les **sauvegardes automatiques** (PITR / point-in-time recovery) selon l’offre Supabase.
2. **Export ponctuel** : depuis le dashboard — *Database* → sauvegardes / export SQL selon la version de l’interface.
3. **Schéma versionné** : les fichiers dans `supabase/migrations/` sont la **source de vérité** du modèle ; les conserver dans Git.
4. **Secrets** : ne jamais committer `.env` ; documenter les variables dans `.env.example` uniquement avec des placeholders.

## En cas de restauration

- Recréer un projet Supabase ou une base vierge.
- Réappliquer les migrations dans l’**ordre** documenté dans `README.md` / `INSTALLATION.md`.
- Réimporter les données (dump SQL ou outil d’import) si disponible.
- Recréer le bucket Storage et les politiques si vous utilisez les pièces jointes.

## Responsabilité

La politique de sauvegarde exacte dépend du **contrat** avec votre hébergeur (Supabase cloud ou self-hosted). Ce prototype ne fournit pas d’automatisation de backup hors ce que la plateforme propose.
