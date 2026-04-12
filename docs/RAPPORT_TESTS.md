# Rapport de tests — CFRM Hub

## Tests réels Supabase (scénarios + KPI SQL)

Voir **[TESTS_SUPABASE_REELS.md](TESTS_SUPABASE_REELS.md)** : `npm run test:supabase:scenarios` (soumissions RPC marquées `[CFRM-HUB-TEST]`) et fichier `supabase/tests/kpi_reel_cfrm_hub_test.sql` pour mesures / exports.

## Environnement

- Tests automatisés **Vitest** + **Testing Library** (jsdom) : `npm run test` depuis `web/`.
- Tests **E2E** **Playwright** (parcours public, sans assertion sur persistance réelle du formulaire complet) : `npm run test:e2e` depuis `web/` (démarre Vite sur le port 5173 si besoin).
- **Smoke Supabase** : `npm run smoke:supabase` — appelle la RPC `submit_public_feedback` avec la clé **anon** (nécessite migrations **init + v2_features** au minimum ; crée une ligne dans `feedbacks`).
- Les tests d’intégration **complets** avec politiques RLS scénarisées ne sont pas tous automatisés ; une partie reste **manuelle** (voir checklist).

## Synthèse (`npm run test`)

| Domaine | Fichier / remarque |
|---------|---------------------|
| Pré-classification (mots-clés) | `classification.test.ts` |
| Permissions par rôle | `permissions.test.ts` |
| Formulaire public (validation + soumission mockée) | `PublicFeedbackPage.test.tsx` |
| Thème clair / sombre | `useTheme.test.tsx` |

**Résultat typique** : **14 tests**, **4 fichiers** — à confirmer avec `npm run test` (sortie Vitest).

## Synthèse (`npm run test:e2e`)

| Scénario | Description |
|----------|-------------|
| Accueil | Titre, chargement |
| Navigation | Lien vers `/feedback` |
| Validation client | Description trop courte → message d’erreur accessible (`role="alert"`) |

**Prérequis** : `npx playwright install chromium` au moins une fois.

## Smoke backend (`npm run smoke:supabase`)

- Vérifie la connectivité et l’existence de la RPC avec la signature **v2** (paramètres démographiques optionnels).
- **Effet de bord** : insertion d’une ligne réelle dans `public.feedbacks` (texte identifiable comme smoke test).

Variables : `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` via `web/.env` et Node 20+ (`--env-file`).

## Scénarios instrumentés (`npm run test:supabase:scenarios`)

- Suite **étendue** : **67** scénarios, **77** appels RPC positifs (dont doublons), **5** cas négatifs ; géolocalisation, canaux simulateurs, démographie ; export JSON sous `Rapport Tests/exports/`.
- Optionnel : `SUPABASE_SERVICE_ROLE_KEY` dans `web/.env` pour vérification auto (classification, géoloc, notification sur première fiche critique, doublons).

## Plan de test manuel (scénarios démo)

1. **Soumission** : formulaire public avec texte d’urgence → priorité critique attendue côté serveur ; accusé affiché.
2. **Tableau de bord** : la ligne apparaît ; filtre par statut *Nouveau* ; Realtime : second onglet / autre navigateur soumet → liste rafraîchie.
3. **Traitement** : connecté validateur → ouvrir fiche → passer à *En validation* puis *Validé* → vérifier historique.
4. **Commentaire interne** : ajouter une note → visible dans la liste des commentaires.
5. **Classification** : corriger catégorie et priorité (override) → priorité effective mise à jour dans la liste.
6. **Notification simulée** : soumettre une alerte critique → entrée correspondante dans `notification_logs` (vue SQL ou future UI).
7. **Doublons** : deux messages quasi identiques le même jour → indicateur *Doublon ?* sur la fiche.
8. **Rôles** : compte observateur → pas d’enregistrement sur la fiche ; pas d’accès menu admin.
9. **Admin** : changer le rôle d’un utilisateur ; désactiver une catégorie ; consulter l’audit.
10. **Export** : CSV téléchargé (admin ou validateur).

## KPI (mesure indicative en démo)

- **Taux de réception** : nombre de `feedbacks` créés / période (requête SQL ou indicateur dashboard).
- **Délai de traitement** : différence `created_at` → premier passage à *En cours* ou *Clos* (à extraire de `feedback_status_history` en requête avancée).
- **Précision de classification** : comparaison manuelle catégorie suggérée vs catégorie validée.
- **Qualité du suivi** : ratio de fiches avec au moins un commentaire interne avant clôture.

Pour des **requêtes prêtes à l’emploi** sur le lot de test `[CFRM-HUB-TEST]`, utiliser `supabase/tests/kpi_reel_cfrm_hub_test.sql` (voir [TESTS_SUPABASE_REELS.md](TESTS_SUPABASE_REELS.md)).

## Limites connues

- Pas de parcours E2E **connecté** (login + dashboard + changement de statut) dans le dépôt — à ajouter si besoin CI (compte de test dédié).
- Les tests du workflow complet avec RLS restent partiellement **manuels** ou couverts par le smoke + recette terrain.
