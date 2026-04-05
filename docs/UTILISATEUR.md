# Guide utilisateur — CFRM Hub

## Public (sans compte)

1. **Accueil** : présentation du mécanisme de feedback, de la confidentialité et des canaux.
2. **Soumettre un feedback** : décrire la situation (min. 10 caractères), indiquer le type de message, la localisation et, si besoin, des coordonnées facultatives. Les coordonnées GPS sont optionnelles et aident la carte du tableau de bord. Un bloc **démographie** (facultatif) peut être déplié. Vous pouvez **joindre des fichiers** après l’envoi, si le stockage est configuré côté projet.
3. **Langue** : dans l’en-tête public, bascule **FR / EN** (interface traduite partiellement selon les écrans).
4. Après envoi, un **accusé de réception** et un **identifiant de référence** s’affichent — à conserver si un suivi est proposé par l’organisation pilote.

## Connexion (équipe)

Utilisez **Connexion** avec l’e-mail et le mot de passe fournis par l’administrateur. Les rôles :

| Rôle | Capacités principales |
|------|------------------------|
| **Administrateur** | Tout le tableau de bord, export, administration (utilisateurs, catégories, canaux, points focaux, audit). Plan d’actions (création / mise à jour). |
| **Validateur** | Voir et traiter les feedbacks, commenter, modifier statut / catégorie / priorité, fermeture de boucle, signalement sensible, simulateurs, export CSV, actions. |
| **Observateur** | Consulter les listes et fiches, l’**analytique** et les actions en lecture, sans modifier le traitement ni commenter. |
| **Agent terrain** | Après connexion, redirection vers **Saisie terrain** : soumettre des feedbacks comme le formulaire public (rôle opérationnel). |
| **Point focal** | Lecture élargie des fiches, **contenu sensible démasqué** (selon politique organisationnelle), analytique ; pas de validation ni de gestion d’actions. |

## Tableau de bord

- **Indicateurs (KPI)** : volumes, boucle fermée, signaux sensibles, **SLA** (retard possible selon configuration), etc.
- **Carte** : points allégés pour les fiches géolocalisées (chargement dédié).
- **Filtres** : statut, priorité, canal, texte, dates, **sexe / tranche d’âge** (si collectés), **boucle fermée**, **sensible**.
- **Pagination** et **tri** sur colonnes.
- **Liste** : accès au détail d’une fiche.

## Analytique & plan d’actions

- **Analytique** : graphiques (volumes, répartition) et tendances hebdomadaires (selon droits).
- **Plan d’actions** : créer des actions, les lier aux feedbacks depuis la fiche (validateurs / admins), suivre les statuts.

## Fiche feedback

- Lecture de la description, du canal, de l’accusé automatique, des contacts si saisis. **Contenu sensible** masqué pour les profils non autorisés.
- **Classification** : catégorie suggérée par le système vs catégorie retenue ; priorité et override.
- **Workflow** : choix du statut parmi *Nouveau*, *En validation*, *Validé*, *En cours de traitement*, *Clos*, *Rejeté / faux signalement*.
- **Fermeture de boucle** : accusé de clôture / preuve de prise en charge (validateurs).
- **Points focaux** : contacts sensibles (référents SGBV, protection, etc.) gérés en admin.
- **Doublons** : suggestions de fiches proches pour fusion manuelle.
- **Pièces jointes** : liste et ajout selon droits et configuration Storage.
- **Actions liées** : vue pour tous les rôles autorisés sur la fiche ; édition réservée validateurs / admins.
- **Historique** : journal des changements de statut.
- **Commentaires internes** : notes d’équipe (validateurs / admins uniquement).

## Simulateurs de canaux

Depuis le menu (compte connecté), les entrées **SMS / WhatsApp / Telegram (simulés)** permettent d’injecter un message comme s’il arrivait par ce canal. Utile pour démonstration et tests d’homogénéisation des données.

## Thème

Le bouton **lune / soleil** dans l’en-tête bascule entre thème clair et sombre (mémorisé localement).
