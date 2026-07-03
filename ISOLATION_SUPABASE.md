# Mémo — Isoler une base Supabase de dev/test

> Écrit le 18 juin 2026. À relire **avant** la prochaine session de dev si on veut arrêter de tester contre la base de production.

## Pourquoi ce mémo existe
L'app web (Vercel, `planning-visites-maman.vercel.app`) est utilisée par de vraies personnes, et l'app native (Expo, branche `feature/expo-setup`) partage **la même base Supabase** (`flmslcdzjuifkivmzins`). Décision prise le 18/06 : on continue à développer/tester sur cette base unique pour l'instant (pas de passage au plan payant Supabase, pas de nouveau projet), en utilisant l'espace de test existant pour cloisonner les données. Ce mémo décrit comment faire une vraie isolation **quand ce sera le bon moment** (ex : avant de tester le cron RGPD qui supprime des espaces définitivement, ou avant une session de dev plus invasive sur le schéma).

## Le blocage à connaître
`supabase/migrations/` ne contient que 5 fichiers (16-17 juin 2026). La majorité du schéma réel (tables `patient_spaces`, `slot_config`, `reservations`, `news_entries`, `souvenirs`, `tasks`, `support_messages`, les 5 buckets Storage, leurs policies, triggers...) a été créée à la main dans le SQL Editor Supabase au fil des sessions précédentes et **n'est versionnée nulle part**. Donc : créer un nouveau projet Supabase et rejouer juste les migrations du repo donnerait une base quasi vide. Il faut d'abord extraire le schéma réel.

## Séquence à suivre (~1-2h, gratuit — le free tier autorise 2 projets actifs par org)

1. **Toi** : Dashboard Supabase → Project Settings → Database → "Reset database password" (le mot de passe actuel n'est pas connu localement). Note le nouveau mot de passe.
2. **Claude Code** : `supabase db dump --linked --schema public,storage -f schema.sql` → récupère tout le DDL (tables, RLS, buckets, policies) sans les données.
3. **Toi** : créer un nouveau projet Supabase (ex: "AvecToi — Dev/Test").
4. **Claude Code** : appliquer `schema.sql` sur le nouveau projet, redéployer les 2 Edge Functions (`notify-cancel`, `rgpd-purge`) avec leurs secrets (`RESEND_API_KEY`, `CRON_SECRET`), reconfigurer `supabase/cron.sql` si on veut tester la purge RGPD aussi.
5. **Claude Code** : nouveau `.env.local` (et `.env` app) pointant vers le projet de test, gardé hors Git comme les fichiers actuels.
6. **Toi** : recréer un compte admin + une fiche patient de test via l'onboarding de l'app (pas de migration des données de prod — exprès, pour ne rien mélanger).

## Alternative écartée : Supabase Branching
Fonctionnalité officielle (preview DB par branche Git), mais plan Pro (25$/mois) **et** souffre du même problème : elle se base sur les migrations du repo comme source de vérité, qui sont incomplètes. L'étape 2 ci-dessus serait nécessaire de toute façon avant de pouvoir s'en servir.

## En attendant (solution actuelle, zéro effort)
Utiliser l'espace de test déjà existant (`space_id = 779f5e5c-084e-418a-adb9-4a2e4af33d80`, créé lors d'une session précédente) pour tous les tests téléphone. Les données sont cloisonnées par `space_id` dans toutes les tables, donc ça ne pollue pas l'espace du vrai patient. Limite : le **schéma** et les **buckets Storage** restent partagés — toute migration SQL appliquée affecte aussi l'app en prod (acceptable tant que les migrations sont additives, comme actuellement).
