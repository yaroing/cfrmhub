# Prompt d'Implémentation — CFRM Hub v2.0

> **Contexte** : Tu travailles sur le projet **CFRM Hub**, une plateforme web multicanale de gestion de feedback communautaire pour ONG humanitaires. Le code existant (v1.0) est en React 19 + Vite + TypeScript + Tailwind CSS v4, avec Supabase comme backend (PostgreSQL, Auth, RLS, Realtime). Le dossier `web/src` contient les pages, composants, services, hooks et types. Le schéma SQL se trouve dans `supabase/migrations/`.
>
> Ton objectif est d'implémenter les fonctionnalités manquantes identifiées dans le Document Additionnel de Conception, en respectant scrupuleusement les conventions du code existant et les bonnes pratiques humanitaires définies par le guide IFRC Feedback Kit.

---

## Règles générales à respecter

- Toujours utiliser **TypeScript strict** — pas de `any` implicite, typer toutes les nouvelles entités dans `src/types/index.ts`
- Chaque nouvelle table SQL doit avoir **RLS activé dès la migration**, avec des politiques adaptées aux rôles `admin`, `validator`, `observer`, `field_agent`, `focal_point`
- Toute action sensible (modification de statut, accès aux feedbacks sensibles, fermeture de boucle) doit être **tracée dans `audit_logs`**
- Ne jamais stocker de secrets côté client — utiliser les variables d'environnement `VITE_*`
- Les migrations SQL sont versionnées : créer un fichier `supabase/migrations/202604XX_v2_<feature>.sql` par fonctionnalité
- Respecter le pattern de service existant (`src/services/`) : une fonction exportée par opération métier, utilisant le client Supabase
- Les nouvelles pages sont ajoutées dans `src/pages/` et enregistrées dans `src/App.tsx`
- Les permissions sont centralisées dans `src/utils/permissions.ts`

---

## Module 1 — Fermeture de la Boucle (Closing the Loop)

### Objectif
Permettre aux équipes de notifier les soumetteurs que leur feedback a été traité, et de documenter cette clôture dans le système.

### Migration SQL à créer : `202604XX_v2_loop_closure.sql`

```sql
-- Ajouter les colonnes de fermeture de boucle à feedbacks
ALTER TABLE public.feedbacks
  ADD COLUMN loop_closed_at timestamptz,
  ADD COLUMN loop_closed_by uuid REFERENCES auth.users(id),
  ADD COLUMN community_response_text text CHECK (char_length(community_response_text) <= 4000),
  ADD COLUMN community_notified_via text CHECK (
    community_notified_via IS NULL OR
    community_notified_via IN ('email', 'sms', 'whatsapp', 'telegram', 'phone_call', 'visit', 'other')
  );

CREATE INDEX idx_feedbacks_loop_closed ON public.feedbacks (loop_closed_at)
  WHERE loop_closed_at IS NOT NULL;
```

### Types TypeScript à ajouter (`src/types/index.ts`)

```typescript
export type NotificationChannel = 'email' | 'sms' | 'whatsapp' | 'telegram' | 'phone_call' | 'visit' | 'other'

// Ajouter dans FeedbackRow :
loop_closed_at: string | null
loop_closed_by: string | null
community_response_text: string | null
community_notified_via: NotificationChannel | null

// Ajouter dans STATUS_LABELS :
export const NOTIF_CHANNEL_LABELS: Record<NotificationChannel, string> = {
  email: 'E-mail',
  sms: 'SMS',
  whatsapp: 'WhatsApp',
  telegram: 'Telegram',
  phone_call: 'Appel téléphonique',
  visit: 'Visite terrain',
  other: 'Autre',
}
```

### Service à ajouter (`src/services/feedbackService.ts`)

```typescript
export async function closeLoop(
  feedbackId: string,
  params: {
    community_response_text: string
    community_notified_via: NotificationChannel
  }
): Promise<void>
// Mettre à jour loop_closed_at = now(), loop_closed_by = auth.uid()
// Logger dans audit_logs avec action 'loop_closed'
```

### UI à implémenter

**Dans `FeedbackDetailPage.tsx`** : ajouter une section « Fermeture de boucle » visible uniquement si `canEditFeedback(role)` et que `loop_closed_at` est null. Elle contient :
- Un `<TextArea>` pour `community_response_text` (obligatoire)
- Un `<select>` pour `community_notified_via`
- Un bouton « Fermer la boucle » qui appelle `closeLoop()`
- Une fois fermée, afficher un bandeau vert « Boucle fermée le [date] via [canal] »

**Dans `DashboardPage.tsx`** : ajouter un KPI « Boucle fermée » (nombre de feedbacks avec `loop_closed_at IS NOT NULL`) et un filtre booléen « Boucle fermée / Non fermée ».

---

## Module 2 — Gestion des Feedbacks Sensibles

### Objectif
Créer un circuit protégé pour les feedbacks impliquant des risques de protection (SGBV, enfants, SEA, sécurité, inconduite).

### Migration SQL : `202604XX_v2_sensitive_feedback.sql`

```sql
-- Types de sensibilité
ALTER TABLE public.feedbacks
  ADD COLUMN is_sensitive boolean NOT NULL DEFAULT false,
  ADD COLUMN sensitive_type text CHECK (
    sensitive_type IS NULL OR
    sensitive_type IN ('sgbv', 'child_protection', 'sea', 'misconduct', 'security', 'other_sensitive')
  ),
  ADD COLUMN sensitive_flagged_by uuid REFERENCES auth.users(id),
  ADD COLUMN sensitive_flagged_at timestamptz;

-- Table des points focaux
CREATE TABLE public.focal_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_title text,
  contact_email text,
  contact_phone text,
  sensitivity_type text NOT NULL CHECK (sensitivity_type IN ('sgbv', 'child_protection', 'sea', 'misconduct', 'security', 'other_sensitive')),
  organisation text,
  is_internal boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.focal_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY focal_points_read ON public.focal_points FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'focal_point'));
CREATE POLICY focal_points_admin ON public.focal_points FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) = 'admin')
  WITH CHECK (public.profile_role(auth.uid()) = 'admin');

-- Nouveau rôle focal_point dans profiles
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'validator', 'observer', 'field_agent', 'focal_point'));

-- Politique RLS renforcée : masquer la description aux observers sur les feedbacks sensibles
-- (géré côté application + vérification serveur)
```

### Types TypeScript

```typescript
export type SensitiveType = 'sgbv' | 'child_protection' | 'sea' | 'misconduct' | 'security' | 'other_sensitive'
export type UserRole = 'admin' | 'validator' | 'observer' | 'field_agent' | 'focal_point'

export const SENSITIVE_TYPE_LABELS: Record<SensitiveType, string> = {
  sgbv: 'Violence sexuelle et basée sur le genre (SGBV)',
  child_protection: 'Protection de l\'enfant',
  sea: 'Abus sexuels par le personnel (SEA)',
  misconduct: 'Inconduite / abus de pouvoir',
  security: 'Incident sécuritaire',
  other_sensitive: 'Autre (sensible)',
}

export type FocalPoint = {
  id: string
  name: string
  role_title: string | null
  contact_email: string | null
  contact_phone: string | null
  sensitivity_type: SensitiveType
  organisation: string | null
  is_internal: boolean
  notes: string | null
  created_at: string
}
```

### Permissions à mettre à jour (`src/utils/permissions.ts`)

```typescript
export function canViewSensitive(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'focal_point'
}
export function canFlagSensitive(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator'
}
```

### UI à implémenter

**Dans `FeedbackDetailPage.tsx`** :
- Si `is_sensitive && !canViewSensitive(role)` : remplacer description et contacts par `[Contenu masqué — feedback sensible]`
- Bouton « Signaler comme sensible » (visible si `canFlagSensitive(role)`) ouvrant une modale avec sélection du type
- Section « Points focaux suggérés » affichant les `focal_points` correspondant au `sensitive_type`

**Nouvelle page `src/pages/admin/AdminFocalPointsPage.tsx`** : CRUD des points focaux (admin uniquement), avec colonnes : Nom, Type, Organisation, Interne/Externe, Contact.

**Dans `DashboardPage.tsx`** : badge rouge « Sensible » sur les lignes concernées, KPI « Feedbacks sensibles non traités ».

---

## Module 3 — Suivi des Actions (Action Tracker)

### Objectif
Permettre de créer des plans d'action liés aux tendances observées et de suivre leur avancement.

### Migration SQL : `202604XX_v2_action_tracker.sql`

```sql
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  description text CHECK (char_length(description) <= 4000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'deferred')),
  owner_id uuid REFERENCES auth.users(id),
  category_id uuid REFERENCES public.categories(id),
  due_date date,
  notes text,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.feedback_action_links (
  feedback_id uuid NOT NULL REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  action_id uuid NOT NULL REFERENCES public.action_items(id) ON DELETE CASCADE,
  PRIMARY KEY (feedback_id, action_id)
);

ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback_action_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY action_read ON public.action_items FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer'));
CREATE POLICY action_mutate ON public.action_items FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'))
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE POLICY action_link_read ON public.feedback_action_links FOR SELECT TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer'));
CREATE POLICY action_link_mutate ON public.feedback_action_links FOR ALL TO authenticated
  USING (public.profile_role(auth.uid()) IN ('admin', 'validator'))
  WITH CHECK (public.profile_role(auth.uid()) IN ('admin', 'validator'));

CREATE TRIGGER trg_action_items_updated
  BEFORE UPDATE ON public.action_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

### Types TypeScript

```typescript
export type ActionStatus = 'open' | 'in_progress' | 'done' | 'deferred'

export type ActionItem = {
  id: string
  title: string
  description: string | null
  status: ActionStatus
  owner_id: string | null
  category_id: string | null
  due_date: string | null
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  category?: Category | null
  linked_feedbacks_count?: number
}

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: 'Ouvert',
  in_progress: 'En cours',
  done: 'Terminé',
  deferred: 'Reporté',
}
```

### Nouvelles pages à créer

**`src/pages/ActionTrackerPage.tsx`** : liste des actions avec filtres (statut, catégorie, responsable, date limite), KPIs (ouvertes / en retard / terminées ce mois), bouton « Nouvelle action » ouvrant une modale.

**`src/pages/ActionDetailPage.tsx`** : fiche détaillée d'une action avec liste des feedbacks liés, historique, champ de notes et changement de statut.

**Route à ajouter dans `App.tsx`** :
```tsx
<Route path="actions" element={<ActionTrackerPage />} />
<Route path="actions/:id" element={<ActionDetailPage />} />
```

**Dans `FeedbackDetailPage.tsx`** : section « Actions liées » affichant les actions attachées à ce feedback, avec bouton « Lier à une action existante » et « Créer une nouvelle action ».

---

## Module 4 — Données Démographiques (SAH)

### Objectif
Collecter optionnellement les données démographiques conformément à l'Outil 5 du guide IFRC (sexe, âge, diversité, langue).

### Migration SQL : `202604XX_v2_demographics.sql`

```sql
ALTER TABLE public.feedbacks
  ADD COLUMN submitter_age_group text CHECK (
    submitter_age_group IS NULL OR
    submitter_age_group IN ('0_17', '18_59', '60_plus', 'mixed', 'prefer_not', 'unknown')
  ),
  ADD COLUMN submitter_sex text CHECK (
    submitter_sex IS NULL OR
    submitter_sex IN ('female', 'male', 'prefer_not', 'mixed', 'unknown')
  ),
  ADD COLUMN submitter_diversity text[], -- ex: ['disability', 'ethnic_minority']
  ADD COLUMN submitter_language text;
```

### Constantes TypeScript

```typescript
export const AGE_GROUP_LABELS = {
  '0_17': '0–17 ans',
  '18_59': '18–59 ans',
  '60_plus': '60 ans et plus',
  'mixed': 'Groupe mixte',
  'prefer_not': 'Préfère ne pas indiquer',
  'unknown': 'Inconnu',
}
export const SEX_LABELS = {
  female: 'Femme', male: 'Homme',
  prefer_not: 'Préfère ne pas indiquer',
  mixed: 'Groupe mixte', unknown: 'Inconnu',
}
export const DIVERSITY_OPTIONS = [
  { value: 'disability', label: 'Situation de handicap' },
  { value: 'ethnic_minority', label: 'Minorité ethnique ou religieuse' },
  { value: 'pregnant_lactating', label: 'Femme enceinte ou allaitante' },
  { value: 'prefer_not', label: 'Préfère ne pas indiquer' },
]
```

### UI à implémenter

**Dans `PublicFeedbackPage.tsx`** : ajouter une section repliable « À propos de vous (facultatif) » en bas du formulaire, précédée d'un texte d'information sur la confidentialité. Les champs sont tous optionnels avec l'option « Préfère ne pas indiquer ».

**Dans `FeedbackDetailPage.tsx`** : afficher les données démographiques dans la section « Description » si elles sont renseignées.

**Dans `DashboardPage.tsx`** : ajouter un filtre par `submitter_sex` et `submitter_age_group`.

---

## Module 5 — Pièces Jointes (Attachments)

### Objectif
Activer le module d'upload de fichiers, déjà prévu dans le schéma SQL (`feedback_attachments`) mais non implémenté dans l'interface.

### Configuration Supabase Storage

Créer un bucket `feedback-attachments` avec :
- Accès : privé (signed URLs uniquement)
- Taille max par fichier : 10 Mo
- Types MIME autorisés : `image/*`, `application/pdf`, `audio/*`

### Migration SQL : `202604XX_v2_attachments_rls.sql`

```sql
-- Ajouter les politiques RLS manquantes sur feedback_attachments
-- (la table existe déjà, seules les politiques Storage sont à ajouter)
-- Vérifier que les signed URLs expirent après 1 heure
```

### Service à créer (`src/services/attachmentService.ts`)

```typescript
export async function uploadAttachment(
  feedbackId: string,
  file: File
): Promise<{ id: string; signedUrl: string }>

export async function fetchAttachments(
  feedbackId: string
): Promise<{ id: string; file_name: string; mime_type: string; signedUrl: string }[]>

export async function deleteAttachment(attachmentId: string, storagePath: string): Promise<void>
```

### UI à implémenter

**Dans `PublicFeedbackPage.tsx`** : remplacer la note de placeholder par un vrai composant `<FileUpload>` acceptant jusqu'à 3 fichiers, avec prévisualisation des images et liste des fichiers sélectionnés.

**Dans `FeedbackDetailPage.tsx`** : section « Pièces jointes » avec galerie d'images inline (miniatures cliquables), liens de téléchargement pour les PDF et suppression par les admins.

---

## Module 6 — Nouveau Rôle Agent de Terrain (`field_agent`)

### Objectif
Ajouter un rôle dédié aux collecteurs terrain, avec accès restreint et interface optimisée.

### Migration SQL : `202604XX_v2_field_agent_role.sql`

```sql
-- Mise à jour de la contrainte de rôle (voir Module 2)
-- Nouvelles politiques RLS pour field_agent :
-- - Peut insérer des feedbacks (comme authenticated)
-- - Ne peut pas lire la liste complète, seulement ses propres soumissions
-- - Pas d'accès aux commentaires, historique, audit, ni administration

CREATE POLICY feedbacks_field_agent_insert ON public.feedbacks FOR INSERT TO authenticated
  WITH CHECK (public.profile_role(auth.uid()) = 'field_agent');

CREATE POLICY feedbacks_field_agent_select ON public.feedbacks FOR SELECT TO authenticated
  USING (
    public.profile_role(auth.uid()) IN ('admin', 'validator', 'observer', 'focal_point')
    OR (public.profile_role(auth.uid()) = 'field_agent' AND created_by = auth.uid())
  );
```

### Permissions à mettre à jour

```typescript
export function canSubmitFeedback(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'field_agent'
}
export function canViewAllFeedbacks(role: UserRole | null): boolean {
  return role === 'admin' || role === 'validator' || role === 'observer' || role === 'focal_point'
}
```

### UI à implémenter

**Nouvelle page `src/pages/FieldSubmitPage.tsx`** : formulaire de saisie terrain enrichi, incluant les champs démographiques obligatoires (avec options « Préfère ne pas indiquer »), le code agent (pré-rempli depuis le profil), et un mode de saisie rapide pour soumettre plusieurs feedbacks en séquence.

**Redirection post-connexion** : si `role === 'field_agent'`, rediriger vers `/app/field` au lieu de `/app`.

---

## Module 7 — Amélioration du Tableau de Bord Analytique

### Objectif
Ajouter des graphiques de tendances et des indicateurs de performance à la page de tableau de bord.

### Dépendances à installer

```bash
npm install recharts date-fns
# recharts est déjà disponible dans l'environnement d'artefacts mais
# doit être installé pour le projet cfrm-hub
```

### Nouvelles vues SQL (ou RPC) à créer

```sql
-- Vue : feedbacks agrégés par semaine
CREATE OR REPLACE VIEW public.feedbacks_weekly_counts AS
SELECT
  date_trunc('week', created_at) AS week_start,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE feedback_type = 'complaint') AS complaints,
  COUNT(*) FILTER (WHERE feedback_type = 'alert') AS alerts,
  COUNT(*) FILTER (WHERE priority IN ('high', 'critical')) AS high_priority
FROM public.feedbacks
GROUP BY week_start
ORDER BY week_start DESC;

-- RLS sur la vue
GRANT SELECT ON public.feedbacks_weekly_counts TO authenticated;
```

### Nouvelle page `src/pages/AnalyticsPage.tsx`

Elle contient :
- **Sélecteur de période** : 7 jours / 30 jours / 90 jours / personnalisé
- **LineChart** : évolution du volume hebdomadaire de feedbacks (recharts)
- **BarChart** : distribution par catégorie
- **PieChart** : répartition par type (plainte, alerte, suggestion, question)
- **KPIs de performance** : délai moyen de traitement, taux de fermeture de boucle, % feedbacks critiques traités < 4h
- **Tableau des zones les plus actives** : groupement par `location_label`

**Route à ajouter dans `App.tsx`** :
```tsx
<Route path="analytics" element={<AnalyticsPage />} />
```

---

## Module 8 — SLA et Indicateurs de Délai

### Migration SQL : `202604XX_v2_sla.sql`

```sql
ALTER TABLE public.feedbacks
  ADD COLUMN first_touched_at timestamptz; -- renseigné au premier UPDATE de statut depuis 'new'

-- Table de configuration SLA
CREATE TABLE public.sla_config (
  priority text PRIMARY KEY CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  target_hours int NOT NULL CHECK (target_hours > 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.sla_config (priority, target_hours) VALUES
  ('critical', 4), ('high', 24), ('medium', 72), ('low', 168)
ON CONFLICT (priority) DO NOTHING;

-- Trigger : renseigner first_touched_at au premier changement de statut depuis 'new'
CREATE OR REPLACE FUNCTION public.track_first_touch()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF OLD.status = 'new' AND NEW.status <> 'new' AND NEW.first_touched_at IS NULL THEN
    NEW.first_touched_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_first_touch
  BEFORE UPDATE ON public.feedbacks
  FOR EACH ROW EXECUTE FUNCTION public.track_first_touch();
```

### UI à implémenter

**Dans la liste du tableau de bord** : afficher un badge orange « En retard » si `now() - created_at > sla_hours` et `status = 'new'`.

**Dans `FeedbackDetailPage.tsx`** : afficher « Délai écoulé : X heures » avec code couleur (vert/orange/rouge selon le SLA).

---

## Module 9 — Améliorations UX Prioritaires

### Pagination côté serveur (`DashboardPage.tsx`)

Remplacer le chargement de toutes les lignes par :
```typescript
const PAGE_SIZE = 25
const { data, count } = await supabase
  .from('feedbacks')
  .select('...', { count: 'exact' })
  .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)
  .order('created_at', { ascending: false })
```
Ajouter des boutons « Précédent / Suivant » et un indicateur « Page X / Y ».

### Géolocalisation automatique (`PublicFeedbackPage.tsx`)

```typescript
function requestGeolocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setLat(pos.coords.latitude.toFixed(6))
      setLng(pos.coords.longitude.toFixed(6))
    },
    (err) => console.warn('Géolocalisation refusée :', err)
  )
}
```
Ajouter un bouton « 📍 Utiliser ma position » à côté des champs latitude/longitude.

### Tri par colonne dans la liste (`DashboardPage.tsx`)

Ajouter un état `sortBy: { col: keyof FeedbackRow; dir: 'asc' | 'desc' }` et rendre les en-têtes de colonnes cliquables pour trier la liste filtrée.

### Gestion des doublons (`FeedbackDetailPage.tsx`)

Si `needs_duplicate_review === true` et `duplicate_of_id === null`, afficher une section « Rapprochement doublon » proposant :
- Un champ de recherche pour trouver le feedback original
- Un bouton « Marquer comme doublon de [ID] » appelant `updateFeedback(id, { duplicate_of_id: selectedId })`
- Un bouton « Marquer comme distinct » mettant `needs_duplicate_review = false`

---

## Module 10 — Internationalisation (i18n)

### Installation

```bash
npm install react-i18next i18next
```

### Structure à créer

```
src/
  i18n/
    index.ts          # configuration i18next
    locales/
      fr.json         # toutes les chaînes en français (langue par défaut)
      en.json         # traductions anglaises
```

### Règles d'implémentation

- Envelopper toutes les chaînes UI dans `t('clé')` via le hook `useTranslation()`
- Le sélecteur de langue est ajouté dans le header public (`PublicLayout.tsx`) et dans les paramètres utilisateur
- La langue sélectionnée est stockée dans `localStorage` (clé `cfrm_lang`)
- Les labels des catégories doivent utiliser `label_fr` ou `label_en` selon la langue active

---

## Checklist de livraison pour chaque module

Avant de soumettre l'implémentation d'un module :

- [ ] Migration SQL créée et testée sur un projet Supabase de test
- [ ] RLS activé sur toutes les nouvelles tables, politiques vérifiées pour chaque rôle
- [ ] Types TypeScript ajoutés dans `src/types/index.ts`
- [ ] Services Supabase ajoutés dans `src/services/`
- [ ] Permissions ajoutées/mises à jour dans `src/utils/permissions.ts`
- [ ] Composants UI implémentés, responsive (mobile + desktop)
- [ ] Routes enregistrées dans `src/App.tsx` avec `AdminGate` si nécessaire
- [ ] Audit log appelé pour les actions sensibles
- [ ] Tests unitaires Vitest écrits pour les nouveaux utilitaires
- [ ] `npm run lint` sans erreur
- [ ] `npm run test` sans régression
- [ ] `npm run build` réussi
- [ ] Documentation mise à jour dans `docs/UTILISATEUR.md` et `docs/TECHNIQUE.md`

---

## Ordre d'implémentation recommandé

```
1. Module 4 (Démographie) — migration simple, faible risque, enrichit immédiatement les données
2. Module 5 (Pièces jointes) — colmate un gap évident, table déjà présente dans le schéma
3. Module 1 (Fermeture de boucle) — impact AAP immédiat, migrations légères
4. Module 2 (Feedbacks sensibles) — critique pour la protection, bien délimiter avec RLS
5. Module 6 (Rôle field_agent) — prérequis pour les modules terrain futurs
6. Module 3 (Action Tracker) — plus complexe (nouvelle entité relationnelle)
7. Module 8 (SLA) — trigger SQL simple, UI peu invasive
8. Module 9 (UX) — améliorations transversales, à faire en parallèle
9. Module 7 (Analytique) — ajouter après que les données de qualité sont disponibles
10. Module 10 (i18n) — peut être fait en parallèle, impact transversal
```

---

*Référence : CFRM Hub — Document Additionnel de Conception v1.0 | IFRC Feedback Kit (Outils 1–34)*
