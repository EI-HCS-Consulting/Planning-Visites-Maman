# Handoff Claude Code — Migration Auth Supabase + UX confirmation

## Contexte
Repo `Planning-Visites-Maman`, branche à créer : `feat/auth-migration`
Supabase projet `flmslcdzjuifkivmzins`

⚠️ **La version web existante `planning-visites-maman.vercel.app` (PWA de base, MVP historique) ne doit JAMAIS être supprimée ni mise à jour avec les changements de cette migration.** Elle reste figée en l'état. Toute modification cible uniquement l'app Expo et le futur site `avectoi.care`.

## Décision actée
Le PIN visiteur est supprimé. Admin **et** visiteur passent par Supabase Auth (email + mot de passe). Le téléphone est supprimé, remplacé par l'email (obligatoire) sur `reservations`.

## Script SQL complet (à exécuter dans l'ordre)

```sql
-- 1. Nouvelles colonnes reservations
ALTER TABLE reservations
  ADD COLUMN user_id uuid REFERENCES auth.users(id),
  ADD COLUMN email text;

-- 2. Rendre email obligatoire (après backfill si données existantes)
ALTER TABLE reservations
  ALTER COLUMN email SET NOT NULL;

-- 3. Suppression des anciennes colonnes
ALTER TABLE reservations
  DROP COLUMN telephone,
  DROP COLUMN pin;

-- 4. Table profils (photo optionnelle, fallback initiales géré côté front)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  prenom text NOT NULL,
  nom text NOT NULL,
  photo_url text,
  role text NOT NULL CHECK (role IN ('admin','visiteur')),
  space_id uuid REFERENCES patient_spaces(id),
  created_at timestamptz DEFAULT now()
);

-- 5. RLS reservations
ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all" ON reservations; -- adapter au nom réel existant

CREATE POLICY "select_own_space" ON reservations
  FOR SELECT USING (true); -- visiteurs voient tout le planning de l'espace (transparence assumée PRD §3.3)

CREATE POLICY "insert_own" ON reservations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own" ON reservations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "delete_own" ON reservations
  FOR DELETE USING (auth.uid() = user_id);

-- Suppression étendue admin (cumulative avec delete_own)
CREATE POLICY "delete_as_admin" ON reservations
  FOR DELETE USING (
    auth.uid() IN (
      SELECT admin_id FROM patient_spaces WHERE id = reservations.space_id
    )
  );

-- 6. RLS profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_all_profiles" ON profiles
  FOR SELECT USING (true); -- besoin d'afficher prénom/nom/photo des autres visiteurs

CREATE POLICY "update_own_profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);
```

## Ordre des tâches

### 0. Audit préalable
Vérifier l'état actuel de `reservations` : la colonne `space_id` existe-t-elle déjà (prévue au PRD web §4.2) ou reste-t-elle à créer sur cette branche ? Si absente, l'ajouter (`ALTER TABLE reservations ADD COLUMN space_id uuid REFERENCES patient_spaces(id)`) **avant** d'exécuter la policy `delete_as_admin`, qui en dépend.

### 1. Migration DB
Exécuter le script SQL fourni (voir section suivante) dans le SQL Editor Supabase.
- Backfill `email` sur les lignes existantes avant `NOT NULL` si des résas existent déjà sans email.
- Vérifier qu'aucune policy `USING (true)` ne subsiste après la migration RLS.

### 2. Auth Supabase
- Activer email+mot de passe dans Supabase Auth (déjà dispo par défaut)
- Configurer SMTP custom : connecter Resend (domaine `avectoi.care` vérifié SPF/DKIM/DMARC) dans Dashboard → Auth → SMTP Settings
- Tester le flow `resetPasswordForEmail()` de bout en bout (réception email + lien fonctionnel)

### 3. Frontend (`App (11).jsx` et composants associés)
- Remplacer les écrans `PinModal` et la logique de saisie PIN par :
  - Login/signup email+mot de passe (admin ET visiteur)
  - Session Supabase Auth active → plus de saisie d'identité à chaque action
- **Nouveau modal de confirmation** avant toute modification ou suppression de réservation (remplace l'étape PIN, ne pas la supprimer sans remplacement — risque de mauvaise manip sinon)
  - Texte type : "Confirmer l'annulation de ta visite du [date] à [créneau] ?" avec boutons Annuler / Confirmer
  - Même pattern pour modification (avant sauvegarde des changements)
- Composant `Avatar` : photo si présente (`profiles.photo_url`), sinon initiales générées (prénom+nom)
- Retirer tout champ téléphone des formulaires de réservation
- Retirer les champs nom/prénom en saisie dans Nouvelles/Soutien/Entraide — récupérer depuis la session (`profiles`)

### 4. Points de vigilance
- `reservations.user_id` doit être rempli à l'insert (`auth.uid()`), ne plus dépendre du PIN pour l'association
- Vérifier que les Realtime subscriptions existantes fonctionnent toujours après le changement de policies RLS
- **Confirmé** : l'admin garde son droit de suppression étendu sur toutes les résas de son espace (PRD §2). Policy `delete_as_admin` ajoutée au script SQL (vérifie `auth.uid()` contre `patient_spaces.admin_id`), cumulée avec `delete_own` pour les visiteurs.

## Definition of Done
- [ ] Plus aucune référence au PIN dans le code (recherche globale `pin`)
- [ ] Signup/login email+mdp fonctionnel app + web
- [ ] "Mot de passe oublié" fonctionnel (email reçu via Resend, lien de reset opérant)
- [ ] Modal de confirmation actif sur modif ET suppression de résa
- [ ] Avatar avec fallback initiales visible partout où une photo profil était prévue
- [ ] Aucun champ téléphone résiduel dans les formulaires ou le schéma
