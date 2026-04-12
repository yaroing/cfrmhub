# Rapport de test complet — preuve fusionnée (RPC + SQL)

**Référence d’exécution :** `exports/kpi_run_1775517202465.json`  
**Date / heure UTC (export RPC) :** 2026-04-06T23:13:20.392Z  
**Instance Supabase :** `idturqbfaeiyugfjdkaa.supabase.co`  
**Complément SQL :** requêtes alignées sur `supabase/tests/kpi_reel_cfrm_hub_test.sql`, exécutées sur la base liée au projet (rôle postgres / MCP), **filtrées sur les 7 `feedback_id`** de cet export pour une preuve **1:1** avec le JSON RPC.

---

## 1. Synthèse exécutive

| Indicateur | Valeur |
|------------|--------|
| **Taux de succès RPC** | **100 %** (7/7) |
| **Test négatif (description trop courte)** | **Conforme** — erreur `description too short` |
| **Volume en base (cette exécution, par UUID)** | **7** fiches présentes |
| **Précision pré-classification** (priorité **et** slug vs attentes du script SQL §3–4 du fichier KPI) | **71,43 %** (5/7 lignes jointes) — écarts sur **T7** (slug observé **`abri`**, attendu **`plainte`** dans la matrice SQL de référence) |
| **Drapeau doublon** (`needs_duplicate_review`) | **1** fiche sur 7 avec `true` (2ᵉ soumission T7) |
| **Notification critique (T1)** | **1** ligne `notification_logs` — canal `internal_sim`, statut `simulated` |
| **Délai médian avant 1ʳᵉ transition de statut** | **NULL** (pas d’historique `feedback_status_history` pour ce lot) |

**Conclusion :** la **réception RPC** et la **validation longueur minimale** sont validées. La **chaîne critique → notification simulée** pour T1 est observée en base. La **détection de doublon** est partiellement visible (un des deux enregistrements T7 est marqué). La **catégorie suggérée pour le scénario doublon (T7)** ne correspond pas au couple attendu par le fichier KPI de référence (`plainte`) : le moteur a classé en **`abri`** — à traiter comme **écart de spécification / évolution des règles** ou mise à jour du jeu d’attentes dans le SQL de test.

---

## 2. Méthodologie

### 2.1 Objectifs

- Vérifier la **fiabilité** de la réception des retours (RPC `submit_public_feedback`, clé anon).
- Mesurer en base la **pré-classification** (priorité, `category_suggested_id`), le **marquage doublon** et les **notifications** pour un lot balisé `[CFRM-HUB-TEST:Tx]`.
- **Fusionner** les preuves : export JSON automatisé + **constats SQL** sur les mêmes identifiants.

### 2.2 Périmètre technique

| Élément | Description |
|---------|-------------|
| **Canal testé (RPC)** | `submit_public_feedback`, équivalent formulaire public. |
| **Marquage** | Préfixe `[CFRM-HUB-TEST:Tx]` dans `description`. |
| **SQL** | Lecture `public.feedbacks`, `public.categories`, `public.notification_logs`, `public.feedback_status_history`. |
| **Documentation** | [docs/TESTS_SUPABASE_REELS.md](../docs/TESTS_SUPABASE_REELS.md), [docs/RAPPORT_TESTS.md](../docs/RAPPORT_TESTS.md). |

### 2.3 Outils et artefacts

1. Script : `web/scripts/real-scenario-tests.mjs` — `npm run test:supabase:scenarios`  
2. Export RPC : `Rapport Tests/exports/kpi_run_1775517202465.json`  
3. Script KPI de référence : `supabase/tests/kpi_reel_cfrm_hub_test.sql` (requêtes reprises ; filtre UUID ajouté pour ce rapport afin d’isoler **cette** campagne)  
4. **Contexte lot global :** une requête sur `description LIKE '%[CFRM-HUB-TEST:%'` sans filtre UUID renvoie actuellement **14** lignes sur l’instance (plusieurs campagnes cumulées) — voir section 10.

### 2.4 Plan de test et critères

| ID | Intention | Critère RPC | Critère base (résumé) |
|----|-----------|-------------|------------------------|
| **T1** | Sécurité / urgence | OK + `feedback_id` | `critical` + slug **securite** ; notification possible |
| **T2** | Besoins de base | idem | `high` + **besoins_de_base** |
| **T3** | Plainte | idem | `medium` + **plainte** |
| **T4** | Information | idem | `medium` + **information** |
| **T5** | Protection | idem | `high` + **protection** |
| **T7** | Doublon | 2× OK | même jour, texte identique → au moins une ligne `needs_duplicate_review = true` |
| **T6** | Négatif | erreur attendue | aucune ligne créée pour `court` |

---

## 3. Environnement (`meta` JSON)

```json
{
  "generated_at": "2026-04-06T23:13:20.392Z",
  "supabase_url_host": "idturqbfaeiyugfjdkaa.supabase.co",
  "service_role_verification": false
}
```

---

## 4. Résultats RPC (`rpc_submissions`)

| Scénario | Tentative | Statut | `feedback_id` |
|----------|-----------|--------|---------------|
| T1 | 1 | OK | `ae34de13-501a-4714-9a55-79cb8ca62120` |
| T2 | 1 | OK | `63e54f01-2191-4183-ad78-9bc7ce15917d` |
| T3 | 1 | OK | `676a2b80-2fa6-46a4-8a41-553c8f3c7f5e` |
| T4 | 1 | OK | `d7ed013b-5084-4a92-a844-13b3677fed4d` |
| T5 | 1 | OK | `02db4ce6-f1cc-46a7-a812-a11f1dc81a47` |
| T7 | 1 | OK | `da78fc29-e064-4260-992f-86163638146b` |
| T7 | 2 | OK | `39af738d-20d6-4578-a46c-759a7072f029` |

---

## 5. Test négatif (`negative_test`)

| Champ | Valeur |
|--------|--------|
| Description | `court` |
| Interprétation `ok: true` | le cas négatif est **validé** (la RPC a renvoyé une erreur) |
| Message | `description too short` |

---

## 6. KPI de l’export JSON (`kpi`)

| Champ | Valeur |
|--------|--------|
| `reception_rate_rpc` | 1 |
| `rpc_attempts` | 7 |
| `rpc_success` | 7 |
| `negative_validation_ok` | true |

---

## 7. Vérification détaillée dans l’export (`verification`)

Vide dans le JSON d’origine (pas de clé service au moment du run). **La section 8 remplace cette lacune** par les constats SQL.

---

## 8. Résultats SQL — lot strictement aligné sur cet export (7 UUID)

### 8.1 Synthèse volumes et drapeau doublon

| Métrique | Valeur |
|----------|--------|
| `nb_feedbacks_run` | 7 |
| `nb_critical` | 1 |
| `nb_high` | 2 |
| `nb_medium` | 4 |
| `nb_low` | 0 |
| `nb_flag_doublon` | 1 |

### 8.2 Pré-classification ligne à ligne (jointure avec la matrice d’attentes du fichier `kpi_reel_cfrm_hub_test.sql`)

| Tag | `feedback_id` | Priorité attendue | Slug attendu | Priorité observée | Slug observé | `classification_ok` | `needs_duplicate_review` |
|-----|---------------|-------------------|--------------|-------------------|--------------|---------------------|---------------------------|
| T1 | ae34de13-… | critical | securite | critical | securite | **true** | false |
| T2 | 63e54f01-… | high | besoins_de_base | high | besoins_de_base | **true** | false |
| T3 | 676a2b80-… | medium | plainte | medium | plainte | **true** | false |
| T4 | d7ed013b-… | medium | information | medium | information | **true** | false |
| T5 | 02db4ce6-… | high | protection | high | protection | **true** | false |
| T7 | da78fc29-… | medium | plainte | medium | abri | **false** | false |
| T7 | 39af738d-… | medium | plainte | medium | abri | **false** | **true** |

### 8.3 Agrégat précision (même logique que la requête §4 du fichier SQL)

| `lignes_evaluees` | `classifications_correctes` | `precision_pct` |
|-------------------|------------------------------|-----------------|
| 7 | 5 | **71,43** |

### 8.4 Notification liée à la fiche T1 (`ae34de13-…`)

| `id` | `feedback_id` | `channel` | `status` | `created_at` (UTC) |
|------|---------------|-----------|----------|---------------------|
| 2be4f38c-ade9-49e4-b0db-46e38bc39d30 | ae34de13-… | internal_sim | simulated | 2026-04-06 23:13:21.172906+00 |

### 8.5 Délai médian avant première transition de statut

| `delai_mediane_minutes_premiere_transition` |
|---------------------------------------------|
| **NULL** |

---

## 9. Lot global marqué `[CFRM-HUB-TEST:` (sans filtre UUID)

Indicateur utile pour la **hygiène des données de test** : sur l’instance actuelle, le filtre `description LIKE '%[CFRM-HUB-TEST:%'` retourne **14** fiches, **2** critiques, **8** en medium, **8** avec `needs_duplicate_review = true`, etc. Ce **n’est pas** exclusivement le run `1775517202465` — pour toute exigence d’audit **par campagne**, utiliser la liste d’UUID de l’export ou une balise de run dédiée.

---

## 10. Annexe — requête type « même campagne que le JSON »

Pour reproduire les sections 8.1–8.3, restreindre les `id` aux sept UUID de la section 4 (comme dans l’exécution effectuée pour ce rapport). Le fichier `supabase/tests/kpi_reel_cfrm_hub_test.sql` utilise par défaut un filtre **LIKE** sur la description ; adaptez avec `WHERE f.id IN (...)` si vous devez isoler une exécution précise.

---

## 11. Traçabilité

| Document | Rôle |
|----------|------|
| `Rapport Tests/exports/kpi_run_1775517202465.json` | Preuve RPC + KPI partiels côté script |
| `supabase/tests/kpi_reel_cfrm_hub_test.sql` | Définition des requêtes KPI et matrice d’attentes |
| Ce rapport | Méthodologie, plan, résultats RPC **et** constats SQL sur les mêmes UUID |

---

*Rapport fusionné (RPC + SQL) pour la campagne `kpi_run_1775517202465.json` — CFRM Hub.*
