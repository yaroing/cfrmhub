# Scénarios de Test - Plateforme CFRM Humanitaire

## 1. Tests de Réception de Feedback

### 1.1 Canal SMS
**Objectif :** Vérifier la réception et le traitement des messages SMS dans le contexte humanitaire

#### Scénarios Positifs
- **SMS-001 :** Message simple en français - demande d'aide
  - **Données :** "Bonjour, j'ai besoin d'aide pour la distribution alimentaire"
  - **Attendu :** Ticket créé, catégorie "Request", priorité "Moyenne", contexte "refugee_camp"

- **SMS-002 :** Message urgent avec mots-clés spécifiques
  - **Données :** "URGENT: Problème avec l'eau potable dans le camp - Zone A"
  - **Attendu :** Ticket créé, priorité "Critique", catégorie "Complaint", escalade automatique

- **SMS-003 :** Message multilingue - contexte humanitaire
  - **Données :** "Hello, I need help with medical care for my children"
  - **Attendu :** Ticket créé, langue détectée (EN), traduction si nécessaire, population "women_children"

- **SMS-004 :** Message PSEA/SEA
  - **Données :** "Plainte concernant le personnel - comportement inapproprié"
  - **Attendu :** Ticket créé, catégorie "PSEA", priorité "Critique", escalade vers psea@cfrm.org

- **SMS-005 :** Message de remerciement
  - **Données :** "Merci pour l'aide reçue, excellent service"
  - **Attendu :** Ticket créé, catégorie "Feedback", priorité "Information", sentiment "Positive"

#### Scénarios Négatifs
- **SMS-006 :** Message vide ou trop court
  - **Données :** "OK" ou ""
  - **Attendu :** Rejet avec message d'erreur, suggestion de reformulation

- **SMS-007 :** Message avec caractères spéciaux
  - **Données :** "Problème @#$%^&*()"
  - **Attendu :** Nettoyage des caractères, traitement normal

- **SMS-008 :** Message non lié au contexte humanitaire
  - **Données :** "Vendez-vous des voitures ?"
  - **Attendu :** Redirection vers le bon service ou rejet avec information

### 1.2 Canal Web (Formulaire)
**Objectif :** Vérifier la soumission via formulaire web dans le contexte humanitaire

#### Scénarios Positifs
- **WEB-001 :** Formulaire complet valide - demande d'aide
  - **Données :** Tous les champs remplis, sujet "Problème avec la distribution alimentaire"
  - **Attendu :** Ticket créé avec toutes les informations, catégorie "Complaint", priorité "Moyenne"

- **WEB-002 :** Formulaire avec pièce jointe - signalement
  - **Données :** Texte + fichier image (photo du problème d'eau)
  - **Attendu :** Ticket créé, fichier uploadé et lié, catégorie "Complaint"

- **WEB-003 :** Formulaire PSEA/SEA
  - **Données :** Catégorie "PSEA" avec description d'incident
  - **Attendu :** Ticket créé, catégorie "PSEA", priorité "Critique", escalade automatique

- **WEB-004 :** Formulaire de remerciement
  - **Données :** Catégorie "Feedback" avec message positif
  - **Attendu :** Ticket créé, catégorie "Feedback", priorité "Information", sentiment "Positive"

- **WEB-005 :** Formulaire avec informations de vulnérabilité
  - **Données :** Statut vulnérable, famille nombreuse, localisation précise
  - **Attendu :** Ticket créé avec priorité élevée, assignation spéciale

#### Scénarios Négatifs
- **WEB-006 :** Formulaire incomplet
  - **Données :** Champs obligatoires manquants (nom, description)
  - **Attendu :** Erreurs de validation affichées, aide contextuelle

- **WEB-007 :** Fichier trop volumineux
  - **Données :** Fichier > 10MB
  - **Attendu :** Erreur de taille de fichier, suggestion de compression

- **WEB-008 :** Formulaire avec données sensibles non protégées
  - **Données :** Informations PSEA dans un formulaire non sécurisé
  - **Attendu :** Redirection vers formulaire sécurisé, chiffrement activé

### 1.3 Canal Messageries Instantanées
**Objectif :** Vérifier l'intégration avec WhatsApp, Telegram, etc. dans le contexte humanitaire

#### Scénarios Positifs
- **MSG-001 :** Message WhatsApp simple - demande d'aide
  - **Données :** "Bonjour, j'ai besoin d'aide pour ma famille"
  - **Attendu :** Ticket créé, canal "whatsapp", catégorie "Request"

- **MSG-002 :** Message avec média - signalement
  - **Données :** Texte + photo du problème d'eau
  - **Attendu :** Ticket créé, média attaché, catégorie "Complaint"

- **MSG-003 :** Conversation groupée - coordination communautaire
  - **Données :** Message dans un groupe de coordination
  - **Attendu :** Ticket créé, contexte de groupe préservé, priorité selon l'urgence

- **MSG-004 :** Message PSEA via WhatsApp
  - **Données :** "Signalement d'abus par le personnel de distribution"
  - **Attendu :** Ticket créé, catégorie "PSEA", priorité "Critique", escalade immédiate

- **MSG-005 :** Message multilingue - contexte réfugié
  - **Données :** "مرحبا، أحتاج مساعدة مع الطعام" (arabe)
  - **Attendu :** Ticket créé, langue détectée, traduction automatique

## 2. Tests de Classification Automatique

### 2.1 Classification par Catégorie
- **CLASS-001 :** Classification "Bug" vs "Feature Request"
- **CLASS-002 :** Classification par priorité (Haute/Moyenne/Basse)
- **CLASS-003 :** Classification par langue
- **CLASS-004 :** Classification par sentiment (Positif/Négatif/Neutre)

### 2.2 Tests de Précision
- **PREC-001 :** 100 messages de test avec classification manuelle
- **PREC-002 :** Mesure du taux de précision par catégorie
- **PREC-003 :** Identification des cas d'échec de classification

## 3. Tests de Performance

### 3.1 Charge de Réception
- **PERF-001 :** 1000 messages simultanés
- **PERF-002 :** 10000 messages/heure
- **PERF-003 :** Pic de charge (5000 messages en 5 minutes)

### 3.2 Temps de Réponse
- **PERF-004 :** Temps de traitement < 2 secondes
- **PERF-005 :** Temps de classification < 5 secondes
- **PERF-006 :** Temps de notification < 10 secondes

## 4. Tests de Sécurité

### 4.1 Validation des Entrées
- **SEC-001 :** Injection SQL dans les messages
- **SEC-002 :** Scripts malveillants (XSS)
- **SEC-003 :** Fichiers malveillants

### 4.2 Authentification
- **SEC-004 :** Accès non autorisé aux tickets
- **SEC-005 :** Élévation de privilèges
- **SEC-006 :** Session hijacking

## 5. Tests d'Intégration

### 5.1 Intégrations Externes
- **INT-001 :** API SMS (Twilio)
- **INT-002 :** API WhatsApp Business
- **INT-003 :** API Telegram Bot
- **INT-004 :** Service de traduction

### 5.2 Notifications
- **INT-005 :** Email de confirmation
- **INT-006 :** SMS de suivi
- **INT-007 :** Notifications push
