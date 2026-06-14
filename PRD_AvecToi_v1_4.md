# PRD — AvecToi
## Product Requirements Document v1.4
*Préparé pour Claude Code — Juin 2026*

> **Changelog v1.3 → v1.4**
> - **Nom définitif : AvecToi** (remplace le nom de travail « Relais Visites »). Domaine principal **`avectoi.care`**. Voir §0 Identité de marque.

> **Changelog v1.2 → v1.3 (rappel)**
> - **Tout en V1** : Entraide + Mur de soutien intégrés au périmètre V1
> - **Paiement** : app gratuite « consumption-only » (reader app), paiement 5,99 € hors app via Stripe web. Voir §3.1 et §4bis

---

## 0. Identité de marque

- **Nom** : **AvecToi**
- **Domaine principal** : **`avectoi.care`** (neutre géographiquement — France, Belgique, Suisse — et sémantiquement fort dans la santé ; `.fr` et `.com` indisponibles à prix raisonnable)
- **Baseline principale** : *« Parce qu'être présent, ça s'organise »* (variantes : *« Organisez vos visites, gardez le lien »*, *« Votre proche n'est jamais seul »*)
- **Réf. complète** : voir `AvecToi_Identité_Marque.md` (baselines, pitchs, stratégie domaines)

> **INPI** — « AvecToi » est un nom **distinctif** (expression appropriée, bien plus protégeable que « Relais »). Dépôt prévu en **classes 42 (logiciels/SaaS)** et **44 (services de santé)** ; envisager d'ajouter **9 (applications téléchargeables)** et **45 (services aux personnes)** pour couvrir l'usage. ⚠️ *Disponibilité de la marque « AvecToi » non encore vérifiée dans l'export INPI — faire une extraction sur ce nom (classes 9/42/44/45) avant dépôt, idéalement validée par un CPI.*

> **⚠️ Cohérence à harmoniser dans `AvecToi_Identité_Marque.md`** : le document de marque décrit encore le modèle initial (« PWA sans installation, sans compte », « freemium B2C »). Le modèle **décidé et figé dans ce PRD** est : **app native Android gratuite (reader app) + paiement unique 5,99 € sur le web** ; compte requis pour l'**admin** uniquement (les visiteurs restent sans compte). À aligner dans le doc marketing.

---

## 1. Contexte & Vision

### Origine
Application née d'un besoin réel : coordonner les visites à un proche hospitalisé (Rose-Marie, Hôpital Michallon, CHU Grenoble Alpes) sans conflits de créneaux, sans surcharger le patient ni l'équipe soignante.

Un MVP fonctionnel existe déjà : une PWA React déployée sur Vercel, connectée à Supabase, accessible sur https://planning-visites-maman.vercel.app

### Vision produit
Transformer ce MVP en application Android native (puis iOS), **gratuite au téléchargement pour tous**, l'organisateur payant **une fois** la création de son espace patient via le web. Permettre à n'importe quelle famille de coordonner sereinement la présence autour d'un proche — planning des visites, entraide, et nouvelles partagées.

Le nom **AvecToi** porte la promesse : la **présence auprès d'un proche** — coordination collective + dimension affective.

### Utilisateurs cibles
- Familles de patients hospitalisés
- Contextes : hospitalisation courte ou longue durée, soins palliatifs, rééducation, maternité, **EHPAD, maison de repos, convalescence post-opératoire à domicile**
- Profil : adultes 35-70 ans, pas nécessairement technophiles

### Modèle économique
- **Paiement unique** par l'admin (le proche organisateur), pas d'abonnement : **5,99 €** par espace patient
- **Paiement réalisé sur le web (Stripe), hors de l'app** → l'app reste gratuite et sans achat in-app (modèle reader app, voir §3.1 et §4bis)
- Visiteurs : accès 100 % gratuit via lien d'invitation
- **Prescripteurs (acquisition, pas de revenu direct)** : établissements de santé (autocollant QR code en salon des familles, pointant vers le **web**), puis — phase 2 — mutuelles et assureurs

---

## 2. Rôles & Permissions

### Super-admin (développeur = Guillaume Frey)
- Accès direct Supabase (dashboard technique)
- Voit tous les espaces patients
- Gère incidents, remboursements, support technique
- N'apparaît pas dans l'interface utilisateur

### Admin (client payant)
- **Crée son compte et son espace patient sur le web, et paie 5,99 € via Stripe** (le paiement ne se fait jamais dans l'app — voir §3.1)
- Se connecte ensuite indifféremment sur le web (responsive) ou dans l'app mobile pour gérer
- Renseigne : nom du patient, hôpital, service, numéro de chambre, adresse, lien Google Maps
- Renseigne son email (obligatoire) pour notifications d'annulation + alertes de purge
- **Configure les créneaux** : heures début/fin, durée, temps min entre visites, nb max de visiteurs/créneau
- Configure les règles de visite (texte libre)
- **Rédige des notes libres / infos visiteurs** (texte libre affiché aux visiteurs). ⚠️ *Garde-fou données sensibles, §10bis*
- **Choisit un thème de couleur** (6 thèmes)
- **Upload une photo du patient** (optionnel — logo générique par défaut)
- Invite des visiteurs via lien unique, QR code, SMS, WhatsApp
- Voit le planning complet avec noms et coordonnées
- Ajoute/modifie/supprime n'importe quelle réservation
- Suspend les nuitées, modifie les règles en cours
- Accède à l'historique complet
- Télécharge/upload des photos souvenirs ; **supprime n'importe quelle photo** (droits étendus)
- **Publie et modère les Nouvelles du jour** (peut supprimer toute nouvelle)
- **Crée des besoins d'entraide et modère le mur de soutien**
- Reçoit un email automatique à chaque annulation
- **Prolonge ou déclenche la purge** de l'espace (§10bis)

### Visiteur (accès gratuit via lien d'invitation)
- Accède via lien unique (pas de compte requis)
- **Voit le planning complet** : qui vient à quel créneau
- Réserve un créneau disponible
- Saisit : **Prénom (obligatoire), Nom (obligatoire)**, Téléphone (optionnel)
  - *Nom obligatoire : permet aux autres visiteurs de savoir précisément qui vient.*
- Choisit un PIN 4 chiffres (modif/annulation, photos, nouvelles, entraide)
- Modifie/annule sa réservation avec son PIN
- Consulte infos patient + hôpital
- Upload/télécharge des photos souvenirs ; **supprime ses propres photos** (PIN)
- **Publie une Nouvelle du jour** (texte + photos) ; modifie/supprime les siennes (PIN)
- **S'attribue un besoin d'entraide** (« Je m'en occupe ») ; **poste un message de soutien**
- **"Sélectionner tout" / "Télécharger tout"** dans la galerie
- Reçoit un rappel push 1h avant sa visite (si notifications acceptées)
- **Ajoute son créneau à son calendrier** (Google/Apple/natif)

---

## 3. Fonctionnalités — V1 Android

### 3.1 Onboarding & Paiement *(modèle reader app — CRITIQUE)*

**Principe de conformité Google Play**
L'app est **"consumption-only" (reader app)** : elle ne vend **aucun** bien ou service en son sein. Aucun écran de prix, aucun bouton d'achat, aucun lien de paiement sortant *depuis l'app*. La création payante d'un espace se fait **exclusivement sur le web**. Ce modèle est explicitement autorisé par la politique Paiements de Google Play et n'entraîne **aucune commission de plateforme**.

> ❌ **Interdits dans l'app** (sous peine de rejet Play Store ou de frais Google) :
> - tout affichage de prix / offre d'achat
> - tout bouton "Acheter / Créer un espace payant"
> - tout lien sortant vers une page de paiement (les "external payment links" déclenchent des frais Google ~20 % + intégration d'API dédiée)

**Parcours Admin (sur le web)**
1. L'admin arrive sur le site web (`avectoi.care` ou domaine retenu) via SEO / QR code prescripteur / bouche-à-oreille
2. Crée un compte (Supabase Auth : email + mot de passe, vérification email)
3. Renseigne l'espace patient (formulaire en étapes, voir ci-dessous)
4. **Paie 5,99 € via Stripe Checkout** (sur le web)
5. À paiement confirmé (webhook Stripe → Supabase) : l'espace est activé, l'admin reçoit son accès + le **lien d'invitation visiteurs** (et le QR code)
6. L'admin peut dès lors gérer depuis le web **ou** se connecter dans l'app mobile

**Parcours dans l'app mobile**
- Écran d'accueil : « J'ai un lien d'invitation » (visiteur) / « Je gère un espace » (admin → écran de connexion)
- **Admin sans espace** : message neutre « Connectez-vous à votre espace. » — *aucune incitation à acheter, aucun lien d'achat*. (La création/achat se découvre via le web.)
- **Visiteur** : ouvre directement l'espace via le lien d'invitation, sans compte

**Formulaire de création d'espace (web)**

Étape 1 — Patient : Prénom, Nom ; upload photo (optionnel, compression auto ; sinon logo générique)
Étape 2 — Hôpital : établissement, service/pavillon, chambre, adresse, lien Google Maps (auto si adresse)
Étape 3 — Créneaux : heure début, heure fin, durée (min), écart min entre visites, max visiteurs/créneau ; nuitées on/off + max/nuit
Étape 4 — Règles & notes :
- Règles de visite (texte libre, exemples pré-remplis optionnels)
- **Notes libres / infos visiteurs** (2ᵉ champ libre) — avec avertissement *« N'indiquez pas d'informations médicales sensibles »* (§10bis)
Étape 5 — Thème couleur (6 options, prévisualisation)
Étape 6 — Dates : début, fin estimée (modifiable ; alimente le calcul de purge §10bis)

### 3.2 Interface Admin — Dashboard

**Vue Calendrier** : calendrier mensuel (indicateurs dispo/partiel/complet) ; **bouton "⚡ Prochaine disponibilité"** ; **clic sur un jour → vue jour** (visiteurs + accès Nouvelles du jour) ; navigation mois.

**Vue Jour** : créneaux du jour (heure, inscrits/max, noms) ; ajouter/modifier/supprimer une résa ; bloc nuitée si activée ; **bouton "📰 Nouvelles du jour"** pour cette date.

**Gestion des invitations** : lien unique, WhatsApp, SMS, copier, QR code.

**Galerie Souvenirs (admin)** : upload (galerie/caméra), compression auto, grille anté-chronologique, lightbox, **"Sélectionner tout" / "Télécharger tout"**, légende optionnelle, **suppression de n'importe quelle photo** (sans PIN).

**Entraide & Soutien (admin)** : crée/édite/supprime des besoins ; voit qui s'est attribué quoi ; modère le mur de soutien (voir §3.8).

**Paramètres** : config espace, suspendre/réactiver nuitées, créneaux, thème, photo patient, règles & notes, **gestion de la purge** (date prévue, prolonger, fermer/purger), support.

### 3.3 Interface Visiteur

**Accès** : lien unique (WhatsApp/SMS) ; pas de compte ; **au 1er accès, consentement** (prénom + nom visibles des autres visiteurs).

**Onglets** :
- **Calendrier** : vue partagée ; "⚡ Prochaine disponibilité" ; clic jour → créneaux + accès Nouvelles du jour
- **Créneaux** : liste du jour ; **noms (prénom + nom) visibles** (transparence assumée) ; "+ Réserver" ; "✏️ Modifier" (PIN) ; "📰 Nouvelles du jour"
- **Nouvelles du jour** (§3.7)
- **Entraide** (§3.8)
- **Souvenirs** : voir/ uploader ; "Sélectionner tout" / "Télécharger tout" ; lightbox ; **suppression de ses propres photos** (PIN ; PIN de session si pas de résa)
- **Infos** : photo patient, nom, hôpital, Google Maps, règles + notes libres
- **Partager** : QR code, copier le lien, WhatsApp/SMS

### 3.4 Réservation (flux visiteur)
1. Sélection créneau
2. Modal : Prénom* / **Nom*** / Téléphone (optionnel) / **PIN 4 chiffres** (clavier intégré)
3. Confirmation : récap + affichage PIN (à noter) + **"📅 Ajouter à mon calendrier"** (Intent natif Android + fallback Google Calendar) + option notifications

### 3.5 Modification / Annulation
- "✏️ Modifier" sur créneau occupé → PIN → modifier (jour/créneau/infos) ou annuler
- À l'annulation → **email automatique à l'admin** (nom, créneau, date, lien)

### 3.6 Notifications
- **Push** (expo-notifications + Edge Function planifiée horaire) : rappel visiteur 1h avant
- **Email admin** (Resend/SendGrid) : annulation visiteur ; **alerte purge J-7** (lien pour prolonger)

### 3.7 Nouvelles du jour

Compte-rendu court après le passage d'un visiteur, pour rassurer les proches absents.

**Publication** : bouton **"📰 Nouvelles du jour"** depuis l'onglet dédié **et** la vue jour ; formulaire texte + **une ou plusieurs photos** (compression) ; auteur prénom + nom (repris de la résa si existante) ; rattachée à une **date** (par défaut le jour consulté / le jour même).

**Affichage** : **flux anté-chronologique** (plus récent → plus ancien) ; chaque entrée = auteur, date/heure, texte, photos (tap → lightbox) ; **accès par jour** depuis le calendrier (clic jour → qui est venu + bouton Nouvelles du jour → entrées de cette date).

**Droits** : visiteur édite/supprime **ses** nouvelles (PIN) ; admin supprime **n'importe quelle** nouvelle.

### 3.8 Entraide & Mur de soutien

**Entraide — besoins & coups de main (care calendar)**
- L'admin (ou un visiteur) crée un **besoin** : ex. apporter un repas maison, du linge propre, des affaires de toilette, un livre, faire une course
- Chaque besoin : **catégorie** (repas / affaires / courses / autre) + **statut** (ouvert → pris en charge → fait)
- Un visiteur clique **« Je m'en occupe »** (identifié prénom + nom, PIN pour se désinscrire)
- ❌ **Pas de covoiturage / trajets entre visiteurs** (exclu du produit)

**Mur de soutien**
- Messages courts d'encouragement pour le patient / la famille
- Affichage anté-chronologique
- Distinct des Nouvelles du jour (qui sont des comptes-rendus de visite)

---

## 4. Stack Technique

### Mobile (app gratuite, Play Store)
- **Framework** : React Native + Expo (SDK 51+)
- **Navigation** : Expo Router
- **Styles** : StyleSheet
- **Icônes** : @expo/vector-icons
- **Calendrier natif** : expo-calendar
- **Galerie / Caméra** : expo-image-picker
- **Compression** : expo-image-manipulator
- **QR Code** : react-native-qrcode-svg
- **Partage** : expo-sharing
- ❌ **Pas de librairie de paiement in-app** (ni Play Billing, ni Stripe SDK in-app) — l'app ne vend rien

### Web (site de vente + gestion — basé sur la PWA Vercel existante)
- **React + Vite** (réutilise l'`App.jsx` actuel comme base)
- **Stripe Checkout** (paiement 5,99 € hébergé par Stripe) + **webhook** vers Supabase pour activer l'espace
- Responsive : permet à l'admin de tout gérer depuis le navigateur sans l'app

### Backend (existant, à étendre) — partagé web + app
- **Base de données** : Supabase (PostgreSQL), **région UE** (RGPD §10bis)
- **Auth** : Supabase Auth (admin)
- **Storage** : Supabase Storage (souvenirs, photo patient, photos Nouvelles du jour)
- **Realtime** : planning + nouvelles en direct
- **Edge Functions** : webhook Stripe (activation espace), emails, rappels push, **job de purge quotidien**

### Build & Publication
- **EAS Build** (Android), **EAS Submit** (Play Store)

---

## 4bis. Architecture — séparation web / app *(NOUVEAU, critique pour la conformité)*

```
   ┌─────────────────────────────┐         ┌──────────────────────────────┐
   │   WEB  (avectoi.care)   │         │   APP ANDROID (gratuite)     │
   │   = la "caisse" + gestion   │         │   = usage, "reader app"      │
   ├─────────────────────────────┤         ├──────────────────────────────┤
   │ • Landing / SEO             │         │ • Visiteur : réserver, voir  │
   │ • Création compte admin     │         │   nouvelles, souvenirs,      │
   │ • Création espace patient   │         │   entraide                   │
   │ • PAIEMENT 5,99 € (Stripe)  │         │ • Admin : gérer en mobilité  │
   │ • Gestion (responsive)      │         │   + push                     │
   └──────────────┬──────────────┘         │ • AUCUN prix / achat in-app  │
                  │                         └───────────────┬──────────────┘
                  │      ┌──────────────────────────┐       │
                  └─────▶│   SUPABASE (UE)          │◀──────┘
                         │  Auth · DB · Storage ·   │
                         │  Realtime · Edge Funcs   │
                         └──────────────────────────┘
```

- **Le web vend, l'app sert.** L'achat se fait à 100 % sur le web → app gratuite légitime, 0 % commission.
- **Acquisition** : QR codes prescripteurs et liens pointent vers le **web** (découverte + achat).
- **Lien d'invitation visiteur** : ouvre l'app si installée (deep link), sinon la version web (PWA) — le visiteur n'a jamais à payer ni à installer.
- **Frais réels** : Stripe EU ≈ 1,5 % + 0,25 € → ~0,34 € sur 5,99 € (net ~5,65 €).

---

## 5. Schéma base de données (Supabase)

### Table `admin_accounts`
```
id (uuid, PK)
email (text)                  ← notifications + alertes purge
created_at (timestamp)
stripe_customer_id (text)     ← client Stripe (paiement web)
```

### Table `patient_spaces`
```
id (uuid, PK)
admin_id (uuid, FK → admin_accounts)
patient_firstname (text)
patient_lastname (text)
patient_photo_url (text)      ← nullable
hospital_name (text)
hospital_service (text)
hospital_room (text)
hospital_address (text)
hospital_maps_url (text)
visit_rules (text)
admin_notes (text)            ← notes libres (⚠️ pas d'info médicale sensible)
theme (text)                  ← "blue"|"red"|"pink"|"green"|"yellow"|"orange"
start_date (date)
end_date (date)
is_active (boolean)           ← activé après paiement Stripe confirmé
invite_token (text, unique)
stripe_payment_id (text)      ← référence du paiement (webhook)
last_activity_at (timestamp)  ← rafraîchi à chaque résa/nouvelle/upload
purge_scheduled_at (date)     ← date de purge auto calculée
created_at (timestamp)
```

### Table `slot_config`
```
id (uuid, PK)
space_id (uuid, FK → patient_spaces)
visit_start_hour (integer)
visit_end_hour (integer)
slot_duration_minutes (integer)
min_gap_minutes (integer)
max_visitors_per_slot (integer)
night_enabled (boolean)
max_night_visitors (integer)
```

### Table `reservations`
```
id (uuid, PK)
space_id (uuid, FK → patient_spaces)
date (date)
creneau (text)
prenom (text)
nom (text)                    ← obligatoire
telephone (text)
type (text)                   ← "Visite" | "Nuit"
pin (text)
push_token (text)
timestamp (timestamp)
```

### Table `souvenirs`
```
id (uuid, PK)
space_id (uuid, FK)
filename (text)
caption (text)
uploaded_by_prenom (text)
uploaded_by_nom (text)
uploaded_by_pin (text)
created_at (timestamp)
```

### Table `news` — Nouvelles du jour
```
id (uuid, PK)
space_id (uuid, FK)
news_date (date)
content (text)
photos (jsonb)                ← liste d'URLs Storage
author_prenom (text)
author_nom (text)
author_pin (text)
created_at (timestamp)
```

### Table `tasks` — Entraide
```
id (uuid, PK)
space_id (uuid, FK)
title (text)
description (text)
category (text)               ← "repas" | "affaires" | "courses" | "autre"
status (text)                 ← "ouvert" | "pris_en_charge" | "fait"
claimed_by_prenom (text, nullable)
claimed_by_nom (text, nullable)
claimed_by_pin (text, nullable)
created_by (text)
created_at (timestamp)
```

### Table `support_messages` — Mur de soutien
```
id (uuid, PK)
space_id (uuid, FK)
message (text)
author_prenom (text)
author_nom (text)
created_at (timestamp)
```

> **RLS** : toutes les tables filtrées par `space_id`. Politiques `anon` explicites (SELECT/INSERT/UPDATE/DELETE `USING (true)`). Rappel MVP : les policies par défaut ciblant `authenticated` bloquent silencieusement l'`anon`.

---

## 6. Charte graphique & Thèmes

### Principe
L'admin choisit un thème à la création, modifiable ensuite. Tous les visiteurs voient ce thème. Couleurs de police adaptées automatiquement (contraste WCAG AA min).

### 6 thèmes
> ⚠️ Codes couleurs exacts à définir. Noms = identifiants logiques.

| Identifiant | Nom affiché | Ambiance |
|---|---|---|
| `blue` | Bleu nuit | Sérénité — défaut (charte MVP) |
| `red` | Rouge grenat | Force, combativité |
| `pink` | Rose doux | Tendresse |
| `green` | Vert nature | Espoir, apaisement |
| `yellow` | Jaune soleil | Optimisme, chaleur |
| `orange` | Orange vif | Énergie, bienveillance |

### Structure d'un thème
```javascript
const themes = {
  blue: {
    bg: "#0D1B2E", card: "#112240", border: "#1E3A5F",
    accent: "#2E75B6", gold: "#f0b429", text: "#e8edf5",
    muted: "#7a8fa6", success: "#3ecf8e", danger: "#e94560",
    orange: "#f97316",
  },
  red: {/* à définir */}, pink: {/* à définir */}, green: {/* à définir */},
  yellow: {/* à définir */}, orange: {/* à définir */},
};
```

### Logo / En-tête
- Logo circulaire (silhouettes + calendrier, SVG fourni)
- Photo patient (si uploadée) ronde au centre, par-dessus les silhouettes ; sinon logo générique
- Teinte du logo adaptée au thème

### Typographie
- Titres : Playfair Display ; Corps : DM Sans (expo-google-fonts)

---

## 7. Ce qui existe déjà (MVP Vercel)

Code de référence : `App.jsx` (fichier unique React) — composants UI complets, connexion Supabase (`supabase.js`), logique métier (créneaux, PIN, compression, QR). **La base web du modèle §4bis réutilise directement ce code.**

**À porter en React Native (app mobile) :**
| Web (actuel) | React Native (cible) |
|---|---|
| `<div>` | `<View>` |
| `<p>`, `<span>` | `<Text>` |
| Styles inline CSS | `StyleSheet.create()` |
| `navigator.share` | `expo-sharing` |
| `<input type="file">` | `expo-image-picker` |
| Canvas API (compression) | `expo-image-manipulator` |
| QR code web | `react-native-qrcode-svg` |
| Lien Google Calendar | `expo-calendar` |
| `window.innerWidth` | `Dimensions.get('window')` |

Logique Supabase (requêtes, realtime, storage) : 100 % réutilisable.

---

## 8. Hors scope V1

- Application iOS (V2 selon traction Android)
- Mode multi-patients simultanés pour un même admin (V2)
- Intégration calendrier hôpital
- **Covoiturage / coordination de trajets (exclu du produit)**
- Messagerie interne bidirectionnelle (le mur de soutien n'en est pas une)
- Traduction multilingue
- Paiement in-app (par conception : modèle reader app, §3.1)
- Prescription mutuelles / assureurs (phase 2 commerciale)
- Codes couleurs définitifs des thèmes autres que `blue` (à intégrer en V1 avant publication)

---

## 9. Critères de succès V1

- App Android publiée sur Play Store, **gratuite, sans achat in-app** (conforme reader app)
- Site web opérationnel : création compte + espace + **paiement Stripe 5,99 €** + activation par webhook
- Flux complet : admin crée espace + paie (web) → invite → visiteur réserve (app/web)
- Connexion admin dans l'app à un espace créé sur le web
- Thèmes (6, switch temps réel) ; photo patient au centre du logo
- "Prochaine disponibilité" (admin + visiteur) ; ajout calendrier natif Android
- Galerie : upload, download groupé, "Sélectionner tout", suppression par PIN
- **Nouvelles du jour** : publication (texte + photos), flux anté-chronologique, accès par jour, droits PIN/admin
- **Entraide** : création de besoins, statut, « Je m'en occupe » (PIN) ; **Mur de soutien** : post + affichage anté-chronologique
- Notes libres admin affichées (avec avertissement données sensibles)
- Email admin à chaque annulation ; **purge auto + alerte J-7 + prolongation**
- Push rappel 1h avant visite ; planning + nouvelles en temps réel (Realtime)

---

## 10. Contacts & Ressources

- **Développeur** : HCS — Hybrid Consulting Systems (Guillaume Frey)
- **App existante (référence / base web)** : https://planning-visites-maman.vercel.app
- **GitHub** : https://github.com/EI-HCS-Consulting/Planning-Visites-Maman
- **Vercel** : https://vercel.com/ei-hcs-consultings-projects/planning-visites-maman
- **Supabase dashboard** : https://supabase.com/dashboard/project/flmslcdzjuifkivmzins
- **Supabase URL** : https://flmslcdzjuifkivmzins.supabase.co
- **Supabase anon key** : `.env` → `EXPO_PUBLIC_SUPABASE_ANON_KEY` (ne jamais committer)
- **Stripe** : clés `.env` (web uniquement) ; webhook → Edge Function d'activation
- **Code de référence** : `App.jsx`
- **Assets logo** : SVG du logo circulaire à fournir à Claude Code

---

## 10bis. RGPD & Cycle de vie des données

### Données collectées
- Visiteurs : prénom, nom, téléphone (optionnel), PIN, photos volontaires, textes (nouvelles, soutien)
- Admin : email, notes libres
- **Aucune donnée de santé structurée.** Seul vecteur potentiel de données sensibles : le champ libre `admin_notes` → avertissement UI explicite *« N'indiquez pas d'informations médicales sensibles. »*

### Hébergement
- Supabase **région UE**. Pas d'obligation HDS tant qu'aucune donnée de santé n'est traitée à titre médical (réévaluer si évolution B2B hospitalière).

### Purge automatique
- **Règle** : `purge_scheduled_at = max(end_date, last_activity_at) + 90 jours`
- `last_activity_at` rafraîchi à chaque réservation/nouvelle/upload/modification
- **Job quotidien** (Edge Function) : si `purge_scheduled_at` dépassée → suppression en cascade (`reservations`, `souvenirs` + fichiers Storage, `news` + photos, `tasks`, `support_messages`, photo patient, puis l'espace)
- **Alerte email J-7** à l'admin avec lien pour **prolonger** (réinitialise l'échéance) ou **purger immédiatement**
- L'admin peut **fermer/purger manuellement** depuis les paramètres

### Bénéfices
- Maîtrise du coût serveur (un paiement unique ne finance pas un stockage à vie)
- Conformité RGPD (minimisation + effacement automatisé)
- Réassurance : *« vos données sont supprimées après le séjour »* — argument de confiance

### Droits des personnes
- Consentement à l'inscription (prénom + nom visibles des autres visiteurs)
- Suppression sur demande (visiteur via PIN ; admin pour l'espace)
- Mentions légales + politique de confidentialité à publier avant mise en ligne Play Store
