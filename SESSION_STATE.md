# État de session — AvecToi (2026-06-16)

Branche courante : `feature/expo-setup` (4 commits en avance sur `origin/feature/expo-setup`, non pushés)

## ✅ Fait (suite — refonte nav/branding, plan dans `~/.claude/plans/deep-hopping-cat.md`)

Demande utilisateur en cours : refonte navigation (barre haut Calendrier/Créneaux/Nuits/Infos/
Partager + barre bas Nouvelles/Souvenirs/Entraide/Soutien/Compte), branding, compte visiteur
persistant, écran Nuits dédié, sync Nouvelles→Souvenirs, RGPD 30j, onboarding horaires.
Livraison **par lots testés un par un sur téléphone réel (Expo Go)**.

### Lot 1 — Branding + entrée + persistance visiteur : ✅ testé et validé en réel
- Assets icon/adaptive-icon/splash remplacés par icon-512 ; icon-sans-512 copié dans assets/
- Boutons accueil renommés (Je rends visite / Je suis Admin) + retour direct au calendrier si
  session visiteur mémorisée (`lib/visitorSession.ts`, AsyncStorage)
- **3 bugs pré-existants découverts et corrigés pendant ce premier test réel de bout en bout
  du flux de réservation visiteur (jamais testé avant cette session)** :
  1. Pas de filtre horaire sur les créneaux du jour (seule la date était vérifiée) → `lib/slotUtils.ts` `isSlotPast()`
  2. Toasts d'erreur de la modale de réservation invisibles (rendus sous la `<Modal>` native) → remplacés par `Alert.alert`
  3. **La table `reservations` n'avait jamais eu de colonne `space_id`** (héritage du MVP mono-patient) → toute réservation visiteur échouait silencieusement. Migration `supabase/migrations/20260616_reservations_space_id.sql` appliquée en prod par l'utilisateur.

### Reste à faire (lots suivants)
- Lot 2 — Navigation (barre haut+bas) + écran d'accueil `SpaceHeader` (logo photo patient, infos hôpital, adresse cliquable) + split Entraide/Soutien + Compte (admin/visiteur)
- Lot 3 — Écran Nuits dédié + recentrage Créneaux (extraction `BookingModal` partagé)
- Lot 4 — Sync Nouvelles→Souvenirs, RGPD 30j, onboarding horaires (visit_start_hour/end/duration/gap), champ `hospital_sector` ("Service de l'hôpital")

Décisions validées : PIN visiteur toujours ressaisi (pas d'auto-validation) ; nouveau champ
`hospital_sector` distinct de `hospital_service` existant.

## ✅ Fait (session précédente — onboarding app)

L'app ne permettait pas encore de créer un compte ni de renseigner la fiche patient (nom, photo,
adresse, n° de chambre, règles de visite) — un admin sans espace tombait sur un message mort
("Rendez-vous sur avectoi.care"). Corrigé pour que l'app téléchargée serve de démo autonome :

| Fichier | Rôle |
|---|---|
| `app/auth/signup.tsx` (nouveau) | Création de compte niveau 1 (email + mdp) via `supabase.auth.signUp`. Gère le cas confirmation email activée (pas de session immédiate → retour à `/auth/login`) et désactivée (session directe → `/(admin)/dashboard`). |
| `app/auth/login.tsx` | Lien "Pas encore de compte ?" pointe vers `/auth/signup` au lieu d'avectoi.care. |
| `components/PatientOnboarding.tsx` (nouveau) | Formulaire de création de l'espace patient : prénom/nom (requis), hôpital (nom, service, chambre, adresse, lien Maps), règles de visite (multiligne), thème. À la validation : génère `invite_token` (`expo-crypto`), crée la ligne `patient_spaces` + une ligne `slot_config` par défaut (14h–20h, créneaux 30 min, 2 visiteurs max, nuitées désactivées), durée 90 jours (cohérent avec le cycle RGPD existant). |
| `lib/SpaceContext.tsx` | `fetchSpace` refactorisé en fonction réutilisable + `refreshSpace()` exposé dans le contexte, appelé par le formulaire après création pour faire apparaître l'espace sans attendre le Realtime. |
| `app/(admin)/_layout.tsx` | Nouveau composant `AdminGate` : tant que `!hasSpace`, affiche `PatientOnboarding` à la place des Tabs (au lieu du dead-end dans Paramètres). |
| `package.json` | + `expo-crypto` (installé via `npx expo install`, version alignée SDK 54). |
| `supabase/migrations/20260616_admin_space_insert_policies.sql` (nouveau) | Policies RLS `INSERT` sur `patient_spaces` et `slot_config` pour que l'admin authentifié puisse créer sa propre fiche depuis l'app. **Non appliqué automatiquement** — à exécuter manuellement dans le SQL editor Supabase (pas de mot de passe DB / clé service role disponible localement pour le faire depuis le CLI). |

### ⚠️ Action manuelle requise avant de tester
Exécuter `supabase/migrations/20260616_admin_space_insert_policies.sql` dans le dashboard Supabase
(SQL Editor) — sans ça, l'INSERT du formulaire d'onboarding échouera avec une erreur RLS
("new row violates row-level security policy").

### Hors scope de ce lot (décision explicite, à reprendre plus tard)
- Page web `avectoi.care/upgrade` + Stripe Checkout + webhook `checkout.session.completed`
- Emails Resend "bienvenue" (signup) et "confirmation paiement" (le pattern existe déjà dans
  `supabase/functions/notify-cancel` et `rgpd-purge`, réutilisable)
- Réglages fins du `slot_config` (horaires, durée des créneaux) dans l'onboarding — actuellement
  uniquement des valeurs par défaut ; à exposer dans Paramètres si besoin

### À tester une fois la policy SQL appliquée
1. Inscription depuis l'app (email+mdp) → doit atterrir sur le formulaire de fiche patient
2. Création de la fiche → doit basculer automatiquement sur les Tabs (Calendrier, etc.)
3. Vérifier que le cap freemium (5 visites) et le verrou QR/partage s'appliquent bien au nouvel espace (`premium: false` par défaut)
4. Vérifier qu'un admin existant sans espace actif (cas marginal) tombe aussi sur le formulaire au lieu du dead-end

## ✅ Fait

### 1. Upgrade Expo SDK 53 → SDK 54
- `expo@^54.0.35`, `react-native@0.81.5`, `react@19.1.0`, `expo-router@~6.0.24`
- Ajout `expo-font`, `expo-asset`, `expo-splash-screen` (manquants, causaient des échecs de build)
- Raison : Expo Go avait basculé sur SDK 54, incompatible avec le projet en SDK 53

### 2. Fix écran bleu (blue screen) au lancement
- Fichier : `app/_layout.tsx`
- Cause : `useFonts` ne gérait pas le cas d'erreur, l'app restait bloquée si les fonts ne chargeaient pas
- Fix : `const [fontsLoaded, fontError] = useFonts(...)` + condition `if (!fontsLoaded && !fontError)`

### 3. Implémentation des 5 features du fichier delta (`Instructions_ClaudeCode_AvecToi_AppDeltas.md`)
Toutes conformes au modèle **reader app** (aucun prix, aucun bouton d'achat, aucun lien de paiement dans l'app — cf. CLAUDE.md) :

| # | Feature | Fichier(s) |
|---|---------|-----------|
| 1 | Champ `premium: boolean` sur l'espace patient | `lib/types.ts` |
| 2 | Modale de consentement visiteur (1er accès par espace, persistée via AsyncStorage `consent_${space.id}`) | `app/(visitor)/_layout.tsx` |
| 3 | Toggle nuitées (live) + édition `admin_notes` avec avertissement données médicales | `app/(admin)/settings.tsx` |
| 4 | Cap freemium : blocage de la 6ᵉ réservation "Visite" pour espace non-premium (message neutre, sans prix) | `app/(visitor)/slots.tsx` |
| 5 | Verrou QR code / lien d'invitation si `!space.premium` (🔒 + message neutre) | `app/(admin)/dashboard.tsx` |

Le Realtime Supabase déjà présent sur `patient_spaces` (`lib/SpaceContext.tsx`, `lib/VisitorContext.tsx`) propage automatiquement les changements de `premium` sans travail supplémentaire.

### 4. Base de données Supabase
- Colonnes ajoutées : `patient_spaces.premium` (boolean, default false), `patient_spaces.admin_notes` (text, nullable)
- Espace **Rose-Marie** passé en `premium = true` (espace réel protégé de la limite freemium)

### 5. Builds EAS (historique)
| Build ID | Statut | Notes |
|----------|--------|-------|
| `22ad09f1...` | FINISHED | SDK 54 de base, sans les 5 features deltas |
| `0c8715af...` | **ERRORED** | `npm ci` échoue : `package-lock.json` désynchronisé (`react-dom@19.2.7` et `scheduler@0.27.0` manquants du lock) |
| `2d358ce7-c8ed-49c3-856d-cbbb1724e156` | **FINISHED ✅** | APK final avec toutes les features. **URL : https://expo.dev/artifacts/eas/3TNPZm2BB_2q7SQMc0G7WjBIKlsqBDqhnwddsDCA3gE.apk** |

### 6. Fix du build EAS (`npm ci` incompatible)
- Cause : EAS exécute `npm ci` qui exige une stricte cohérence package.json/lock. Le lock avait été généré localement avec `--legacy-peer-deps`, ce qui omettait `react-dom`/`scheduler` du lock.
- Fix : création de `.npmrc` (`legacy-peer-deps=true`) à la racine + régénération de `package-lock.json`
- Commit : `6d5a11d` — `fix: sync package-lock.json + .npmrc legacy-peer-deps pour EAS Build`

### 7. Documentation
- `DEPLOYMENT.md` généré (état complet du déploiement : EAS, env vars, Supabase, Edge Functions, Vercel, GitHub) — copié dans `C:\Users\ReMarkt\Downloads\DEPLOYMENT.md`

## ⚠️ Point en suspens (non commité)

`package.json` a une modification **non commitée** : ajout de `"react-dom": "^19.1.0"` dans les dépendances (installé pendant le débogage du lock file, avant la décision finale d'utiliser `.npmrc`). Cette ligne est cohérente avec le fix (react-dom est bien nécessaire comme peer dep d'expo-router 6) mais n'a pas encore été incluse dans un commit.

**Action à prendre** : commit ce changement avec le prochain commit de features, ou faire un petit commit dédié.

Autres éléments non suivis par git (normal, à ignorer) :
- `npm-install.log` (log local, pas utile au repo)
- `supabase/.temp/` (dossier temporaire CLI Supabase)

## 🔜 Reste à faire

1. **Tester l'APK final** (`2d358ce7...`) sur appareil réel :
   - Modale de consentement visiteur
   - Toggle nuitées dans paramètres admin
   - Édition admin_notes
   - Cap freemium (5 visites max) sur un espace test non-premium
   - Verrou QR/lien d'invitation sur espace non-premium
2. Commit la modif `react-dom` en attente dans `package.json`
3. **Push** la branche `feature/expo-setup` vers `origin` (2 commits locaux non pushés : `3d1866c`, `6d5a11d`)
4. Créer une **Pull Request** vers `main` (règle CLAUDE.md : jamais de travail direct sur main)
5. `eas submit --profile production` pour soumission Play Store (nécessite `google-play-service-account.json` — à vérifier si déjà présent/configuré)
6. Build `production` (AAB) à lancer avant soumission (profil `preview` ne produit qu'un APK de test)

## 🔑 Décisions prises

- **Modèle reader app strictement respecté** : aucune feature ajoutée ne contient de prix, bouton d'achat ou lien de paiement — uniquement des messages neutres renvoyant vers l'email envoyé par le site web
- **`.npmrc` avec `legacy-peer-deps=true`** committé au repo pour garantir que l'environnement EAS et l'environnement local résolvent les dépendances de la même façon (évite les divergences `npm ci` vs `npm install --legacy-peer-deps`)
- **Espace Rose-Marie protégé en `premium=true`** pour ne pas casser l'usage réel pendant les tests de la limite freemium

## 📁 Fichiers concernés (résumé)

```
app.json                          → EAS project ID configuré
lib/types.ts                      → +premium: boolean
app/_layout.tsx                   → fix useFonts (écran bleu)
app/(visitor)/_layout.tsx         → modale consentement
app/(admin)/settings.tsx          → toggle nuitées + admin_notes
app/(visitor)/slots.tsx           → cap freemium 5 visites
app/(admin)/dashboard.tsx         → verrou invitation non-premium
package.json                      → SDK54 + react-dom (NON commité)
package-lock.json                 → régénéré, cohérent avec .npmrc
.npmrc                            → NOUVEAU — legacy-peer-deps=true
DEPLOYMENT.md                     → doc déploiement (+ copie Downloads)
SESSION_STATE.md                  → ce fichier
```

## 🔗 Références utiles

- APK final à tester : https://expo.dev/artifacts/eas/3TNPZm2BB_2q7SQMc0G7WjBIKlsqBDqhnwddsDCA3gE.apk
- Build EAS final : https://expo.dev/accounts/ei-hcs-consulting/projects/avectoi/builds/2d358ce7-c8ed-49c3-856d-cbbb1724e156
- Supabase dashboard : https://supabase.com/dashboard/project/flmslcdzjuifkivmzins
- Vercel (MVP web) : https://vercel.com/ei-hcs-consultings-projects/planning-visites-maman
- GitHub : https://github.com/EI-HCS-Consulting/Planning-Visites-Maman
