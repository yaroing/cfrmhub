# CFRM Hub

Plateforme web **multicanale** de gestion de feedback communautaire pour ONG humanitaires — prototype opérationnel (React + Supabase) axé sur la **redevabilité envers les populations affectées (AAP)** et l’alignement CHS / IASC.

## Structure du projet

```
cfrm-hub/
├── web/                    # Application React (Vite + TypeScript + Tailwind v4)
│   ├── e2e/                # Tests Playwright (parcours public)
│   ├── scripts/            # Smoke test Supabase (RPC)
│   ├── src/
│   ├── .env.example
│   └── package.json
├── supabase/
│   └── migrations/         # Schéma SQL, RLS, triggers, RPC (ordre ci-dessous)
├── docs/                   # Installation, technique, utilisateur, tests, checklist
├── LICENSE                 # MIT
└── Documentation Conception CFRMHub/   # Documents fournis (hors code)
```

## Prérequis

- Node.js **20+** (pour `node --env-file` utilisé par le smoke test)
- Compte [Supabase](https://supabase.com) (projet gratuit suffisant pour la démo)

## Base de données Supabase — ordre des migrations

Exécuter **dans l’ordre** dans *SQL Editor* (ou via CLI `supabase db push`) :

| # | Fichier | Rôle |
|---|---------|------|
| 1 | `supabase/migrations/20260403120000_init.sql` | Schéma initial, RLS de base, RPC `submit_public_feedback` (v1), triggers, catégories |
| 2 | `supabase/migrations/20260404120000_v2_features.sql` | v2 : démographie, boucle, sensible, actions, SLA, RPC étendue `submit_public_feedback`, vues |
| 3 | `supabase/migrations/20260404120001_v2_rls_storage.sql` | RLS étendue (field_agent, focal_point, etc.) + bucket Storage `feedback-attachments` |
| 4 | `supabase/migrations/20260405120000_assisted_feedback_channels.sql` | Canaux `phone` et `in_person` pour la saisie assistée (connecté) |
| 5 | `supabase/migrations/20260405140000_twilio_sms_channel.sql` | Canal `sms_twilio` + index idempotence Twilio (`MessageSid`) |
| 6 | `supabase/migrations/20260405150000_telegram_bot_channel.sql` | Canal `telegram_bot` + index idempotence (`update_id`) pour le webhook bot |
| 7 | `supabase/migrations/20260405160000_repair_telegram_bot_trigger.sql` | Réaligne contrainte + trigger si la #6 avait été oubliée (évite canal `web` pour Telegram) |

**Sans les fichiers 2 et 3**, le frontend v2 (pièces jointes, certains rôles, RPC à paramètres étendus) peut **échouer** ou être incohérent avec la base.

### Après les migrations

1. **Realtime** : *Database → Replication* — ajouter `public.feedbacks` à `supabase_realtime` (ou ignorer l’erreur si déjà présent).
2. **Storage** : la migration v2 Storage crée le bucket `feedback-attachments` et des politiques. Vérifier dans *Storage* que le bucket existe ; ajuster si votre projet utilisait une config manuelle antérieure.
3. **Auth** : fournisseur *Email* activé ; créer un utilisateur puis :

   ```sql
   update public.profiles set role = 'admin' where email = 'votre@email.org';
   ```

## Installation rapide (frontend)

```bash
cd web
cp .env.example .env
# Renseigner VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY
npm install
npx playwright install chromium   # une fois, pour les tests E2E
npm run dev
```

Ouvrir `http://localhost:5173`.

## Scripts npm (`web/`)

| Script | Description |
|--------|-------------|
| `npm run dev` | Serveur de développement |
| `npm run build` | Build production |
| `npm run preview` | Prévisualisation du build |
| `npm run test` | Tests Vitest |
| `npm run lint` | ESLint |
| `npm run test:e2e` | Playwright (démarre Vite si besoin) |
| `npm run smoke:supabase` | Appel RPC `submit_public_feedback` (clé anon, crée une ligne test) |

## Fonctionnalités livrées (résumé)

- Page d’accueil publique, formulaire anonyme (RPC), pré-classification, dashboard (filtres, KPI, carte, pagination), workflow et historique, commentaires, rôles (admin, validateur, observateur, agent terrain, point focal), simulateurs SMS/WhatsApp/Telegram, **SMS réel via Twilio** (`sms_twilio`), **bot Telegram** (`telegram_bot`, webhook), admin, export CSV, extensions v2 (actions, SLA, sensibilité, pièces jointes, analytique), i18n FR/EN, thème clair/sombre.

## Documentation

- [Installation détaillée](docs/INSTALLATION.md)
- [Documentation technique](docs/TECHNIQUE.md)
- [Guide utilisateur](docs/UTILISATEUR.md)
- [Rapport de tests](docs/RAPPORT_TESTS.md)
- [Checklist « prêt prototype »](docs/CHECKLIST.md)
- [Sauvegardes / continuité](docs/BACKUP.md)
- [Feuille de route](docs/ROADMAP.md)
- [SMS Twilio (Edge Function)](docs/TWILIO.md)
- [Bot Telegram (Edge Function)](docs/TELEGRAM.md)

## Licence

**MIT** — voir le fichier [LICENSE](LICENSE). Remplacez la mention de copyright par votre organisation si vous publiez le dépôt.
