# Tests réels Supabase — scénarios et KPI mesurables

Ce guide remplace les **KPI simulés** du rapport d’atelier par des **mesures** sur votre instance : soumissions via la RPC réelle, puis requêtes SQL (et export JSON automatique si la clé service est disponible).

## Prérequis

- Migrations CFRM Hub appliquées sur le projet (au minimum **init** + **v2_features**).
- Fichier `web/.env` avec `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`.

## 1. Exécuter la suite étendue (soumissions réelles)

Depuis le dossier `web/` :

```bash
npm run test:supabase:scenarios
```

Le script appelle `submit_public_feedback` avec la **signature complète v2** (optionnel : `p_location_label`, `p_lat`, `p_lng`, coordonnées, contacts, démographie).

### Contenu de la suite (ordre de grandeur)

| Catégorie | Détail |
|-----------|--------|
| **Définitions de scénarios** | **67** (identifiants `R001`… + `D01`–`D10`) |
| **Appels RPC positifs** | **77** (10 scénarios doublon = 2 appels chacun) |
| **Tests négatifs** | **5** (description trop courte, canal ou type invalide) |
| **Marqueurs** | `[CFRM-HUB-TEST:Rxxx]`, `[CFRM-HUB-TEST:Dxx]` dans `description` |

Cas couverts : **classification** (alerte, plainte, question, suggestion, etc.), **géolocalisation** (France et international, lat/lng partiels ou complets), **canaux** `web`, `sms_sim`, `whatsapp_sim`, `telegram_sim`, **contacts** et **champs démographiques**, **doublons** (même texte, deux soumissions).

**Résultat :**

- Sortie console (succès / échec par scénario et par négatif).
- Fichier JSON : `Rapport Tests/exports/kpi_run_<timestamp>.json`.

### Vérification automatique des KPI (optionnel)

Ajoutez dans `web/.env` ( **ne jamais committer** ) :

```env
SUPABASE_SERVICE_ROLE_KEY=<clé service role du projet>
```

Avec cette variable, le script remplit notamment `verification` (priorité + slug attendus), `geo_verification` (coords attendues vs stockées), comptage **notification** pour la **première** fiche **critique** du run, et **doublons** (paires `Dxx` avec au moins un `needs_duplicate_review`).

Sans cette clé, les soumissions restent réelles (anon) ; les mesures détaillées se font via le SQL ci-dessous.

## 2. Mesures SQL / exports (SQL Editor)

Ouvrez `supabase/tests/kpi_reel_cfrm_hub_test.sql`, copiez-collez dans **Supabase → SQL → New query**, exécutez.

Vous obtenez notamment :

- volumes et répartition par priorité / catégorie suggérée ;
- tableau **précision** pour l’ancien jeu **T1–T7** (si encore présent en base) ;
- **pourcentage de précision** agrégé sur ce jeu ;
- lignes `notification_logs` pour T1 ;
- **délai médian** avant première entrée d’historique de statut ;
- **§8–10** : géolocalisation, canaux, volumes par marqueur **R** / **D**.

**Export CSV :** dans *Table Editor* → `feedbacks`, filtre sur la colonne `description` contenant `[CFRM-HUB-TEST`, puis export ; ou utilisez une commande `COPY` (voir commentaire en fin de fichier SQL).

## 3. Mettre à jour le rapport documentaire

Après exécution, joignez le fichier `kpi_run_*.json` comme **annexe mesurée** et mettez à jour le rapport complet :  
`Rapport Tests/RAPPORT_TEST_COMPLET_SUITE_ETENDUE.md`.

## 4. Nettoyage des données de test

En bas de `kpi_reel_cfrm_hub_test.sql`, section commentée `DELETE` — à décommenter avec précaution (ordre : dépendances puis `feedbacks`).

## Voir aussi

- [RAPPORT_TESTS.md](RAPPORT_TESTS.md) — tests Vitest / Playwright / smoke.
- [INSTALLATION.md](INSTALLATION.md) — ordre des migrations.
