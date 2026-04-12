# Rapport de test complet — suite étendue (> 60 cas) + KPI run

**Export RPC analysé :** `Rapport Tests/exports/kpi_run_1775518649570.json`  
**Horodatage UTC (`meta.generated_at`) :** 2026-04-06T23:37:15.036Z  
**Instance :** `idturqbfaeiyugfjdkaa.supabase.co`  
**Vérification service role lors du run :** non (`service_role_verification`: false)

---

## 1. Synthèse exécutive

| Indicateur | Valeur |
|------------|--------|
| **Définitions de scénarios** | **67** (`R001`–`R057` + `D01`–`D10`) |
| **Appels RPC positifs réussis** | **77 / 77** (taux **100 %**) |
| **Tests négatifs (refus RPC attendu)** | **5 / 5** conformes |
| **Total d’exécutions de contrôle** | **82** (77 + 5) |
| **Géolocalisation en base** (filtre sur les 77 UUID de cet export) | **68** fiches avec lat **et** lng, **4** lat seul, **4** lng seul, **1** sans coordonnées |
| **Drapeaux doublon** sur ce lot | **10** (`needs_duplicate_review` — une fiche par paire doublon, 2ᵉ soumission) |
| **Canaux observés** (même lot) | web **36**, telegram_sim **14**, sms_sim **14**, whatsapp_sim **13** |
| **Notification critique** (1ʳᵉ alerte du run, `R001`) | **1** entrée dans `notification_logs` pour `feedback_id` `3ce5b261-ecd5-4b68-9e07-c27e537200df` |

**Conclusion :** la RPC **`submit_public_feedback`** accepte et persiste un **volume élevé** de scénarios variés (géolocalisation partielle ou complète, simulateurs de canaux, contacts, démographie). Les **rejets** (texte trop court, canal ou type invalide) se comportent comme spécifié. Les **doublons** déclenchent le marquage attendu sur la série `D01`–`D10`. Pour la **précision de pré-classification** ligne à ligne et la vérification automatique des coords, définir **`SUPABASE_SERVICE_ROLE_KEY`** dans `web/.env` avant `npm run test:supabase:scenarios` (voir `kpi` enrichi dans le JSON).

---

## 2. Méthodologie

### 2.1 Objectifs

- Valider la **robustesse** du point d’entrée public (même chemin que le formulaire) sous **charge fonctionnelle** (> 60 cas).
- Couvrir des **cas de figure** : types de retour, textes longs, **coordonnées GPS** et libellés de lieu, **coordonnées incomplètes** (lat ou lng seul), canaux **`web`** et **simulateurs**, champs **contact** et **démographie**, **doublons** (deux POST identiques).
- Vérifier les **garde-fous** serveur : longueur minimale de la description, liste blanche des **canaux** et des **types** de feedback.
- Produire une **preuve reproductible** : fichier `kpi_run_<timestamp>.json` + requêtes SQL sur les UUID du run.

### 2.2 Artifacts

| Élément | Chemin / commande |
|---------|-------------------|
| Données des scénarios | `web/scripts/real-scenario-data.mjs` |
| Orchestration + export | `web/scripts/real-scenario-tests.mjs` |
| Exécution | `npm run test:supabase:scenarios` (depuis `web/`) |
| Mesures SQL globales / géo / canaux | `supabase/tests/kpi_reel_cfrm_hub_test.sql` (§1–2 et §8–10) |
| Guide | [docs/TESTS_SUPABASE_REELS.md](../docs/TESTS_SUPABASE_REELS.md) |

### 2.3 Marquage des données

Chaque description contient un identifiant extractible :

- `[CFRM-HUB-TEST:Rxxx]` — scénarios généraux ;
- `[CFRM-HUB-TEST:Dxx]` — paires doublon (deux appels RPC avec le **même** texte).

L’ancien jeu **T1–T7** reste documenté dans le SQL (§3–5) pour les bases qui conservent encore ces lignes.

---

## 3. Plan de test (par sous-suite)

| Sous-suite (`suite`) | Nombre de scénarios | Appels RPC | Focus |
|---------------------|---------------------|------------|--------|
| `classification_geo` | 15 | 15 | Priorité / catégorie (vocabulaire métier) + **geo** + contact rotatif |
| `types_mixtes_demo` | 12 | 12 | suggestion, question, complaint, alert, feedback + **démographie** + geo partielle |
| `contact_geo` | 8 | 8 | Nom, téléphone, email + **GPS** |
| `geo_only` | 10 | 10 | Stocker **lat/lng** avec texte neutre ; vérif coords si service role |
| `channels_sim` | 6 | 6 | Rotation **web / sms_sim / whatsapp_sim / telegram_sim** |
| `volume_boost` | 6 | 6 | Alertes / besoins / plaintes / info / protection / suggestion |
| `duplicate_pair` | 10 | **20** | Même description en **2** appels ; attendre **au moins un** `needs_duplicate_review` par paire |
| **Négatifs N01–N05** | 5 | 5 | Échecs attendus (message d’erreur RPC) |

---

## 4. Résultats — extrait `kpi` (export JSON)

Champs issus de `kpi_run_1775518649570.json` :

| Champ | Valeur |
|--------|--------|
| `reception_rate_rpc` | 1 |
| `rpc_attempts` | 77 |
| `rpc_success` | 77 |
| `negative_tests_passed` | 5 |
| `negative_tests_total` | 5 |
| `verification` | `[]` (vide sans clé service) |
| `geo_verification` | `[]` (vide sans clé service) |

**Note JSON :** avec `SUPABASE_SERVICE_ROLE_KEY`, le script remplit classification, géoloc, notification sur la première fiche **critique**, et agrégats de paires doublon.

---

## 5. Tests négatifs (résumé)

| ID | Attendu (sous-chaîne) | Erreur observée |
|----|------------------------|-----------------|
| N01 | `description too short` | conforme |
| N02 | `invalid channel` | conforme |
| N03 | `invalid feedback type` | conforme |
| N04 | `description too short` (9 caractères) | conforme |
| N05 | `description too short` (espaces) | conforme |

---

## 6. Corroboration SQL — **uniquement** les 77 `feedback_id` de `kpi_run_1775518649570.json`

Requêtes exécutées sur la base du projet (rôle postgres) après le run :

### 6.1 Géolocalisation et doublons

| `nb` | `avec_deux_coords` | `lat_seulement` | `lng_seulement` | `sans_coords` | `flag_doublon` |
|------|--------------------|-----------------|---------------|---------------|----------------|
| 77 | 68 | 4 | 4 | 1 | 10 |

### 6.2 Répartition par canal

| Canal | Nb |
|-------|-----|
| web | 36 |
| telegram_sim | 14 |
| sms_sim | 14 |
| whatsapp_sim | 13 |

### 6.3 Notification (alerte `R001`)

Pour `feedback_id` `3ce5b261-ecd5-4b68-9e07-c27e537200df` : **1** ligne dans `notification_logs`.

---

## 7. Liste des identifiants créés (RPC)

Les **77** couples `(scenario_id, feedback_id)` sont dans le tableau `rpc_submissions` du fichier JSON (champs utiles : `suite`, `channel`, `lat`, `lng`, `location_label`). Pour un audit complet des UUID, ouvrir :

`Rapport Tests/exports/kpi_run_1775518649570.json`

---

## 8. Suites recommandées

1. Réexécuter la campagne avec **`SUPABASE_SERVICE_ROLE_KEY`** pour obtenir `verification`, `geo_verification` et KPI de précision dans le même JSON.
2. Lancer **`supabase/tests/kpi_reel_cfrm_hub_test.sql`** (§8–10) pour des agrégats sur tout le lot `[CFRM-HUB-TEST` (peut inclure d’anciennes campagnes).
3. Nettoyage : blocs `DELETE` commentés en fin de fichier SQL, après sauvegarde.

---

## 9. Traçabilité

| Document | Rôle |
|----------|------|
| `exports/kpi_run_1775518649570.json` | Preuve machine du run du 2026-04-06 (suite étendue) |
| Ce rapport | Méthodologie, plan, résultats agrégés + SQL ciblé UUID |
| `RAPPORT_TEST_COMPLET_KPI_RUN_1775517202465.md` | Rapport historique (ancienne campagne courte T1–T7 + SQL) |

---

*CFRM Hub — rapport suite étendue intégrant `kpi_run_1775518649570.json`.*
