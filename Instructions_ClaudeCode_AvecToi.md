# Instructions Claude Code — AvecToi
*HCS — Hybrid Consulting Systems — Juin 2026*

---

## A. MESSAGE D'OUVERTURE (à coller dans Claude Code au démarrage)

```
Bonjour Claude Code. Je veux développer une application Android native appelée AvecToi.

Voici le contexte complet :

**PRD** : [joindre le fichier PRD_AvecToi_v1_4.md]
**Code source de référence (MVP web existant)** : [joindre le fichier App.jsx]

**Credentials à configurer immédiatement dans un fichier .env (à ajouter au .gitignore) :**
EXPO_PUBLIC_SUPABASE_URL=https://flmslcdzjuifkivmzins.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZsbXNsY2R6anVpZmtpdm16aW5zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3MTA1MTYsImV4cCI6MjA5NDI4NjUxNn0.JrGew23JTv8ITFpAGB2YwEZ9b1WooLGyDokpwm8yb7Q

**Ce que je veux que tu fasses en premier, dans l'ordre :**
1. Lire entièrement le PRD et App.jsx avant de coder quoi que ce soit
2. Confirmer ta compréhension du modèle "reader app" (§3.1 du PRD) — CRITIQUE pour la conformité Play Store
3. Initialiser un projet Expo React Native (SDK 51+) avec Expo Router
4. Configurer la connexion Supabase avec les credentials ci-dessus
5. Créer le fichier .env et vérifier qu'il est dans .gitignore
6. Configurer Git :
   git config --global user.name "HCS Hybrid Consulting Systems"
   git config --global user.email "guillaume.frey38@gmail.com"
7. Créer la structure de dossiers complète du projet
8. Me présenter la structure avant de commencer à coder les écrans

**Contraintes CRITIQUES :**
- L'app est GRATUITE sur le Play Store, SANS achat in-app, SANS affichage de prix
- Le paiement (5,99€ Stripe) se fait UNIQUEMENT sur le web — jamais dans l'app
- Stack : Expo + React Native + Supabase (existant) + EAS Build
- Cible V1 : Android uniquement
- Charte graphique : conserver les couleurs et polices du MVP (section 6 du PRD)
- App.jsx est la référence fonctionnelle — toute la logique est dedans, à porter en React Native
- Ne jamais committer le fichier .env
- Travailler en branches Git (jamais directement sur main)
- Chaque étape terminée = commit + push sur GitHub
```

---

## B. INSTRUCTIONS DU PROJET CLAUDE CODE (à coller dans "Project instructions")

```
# Projet AvecToi — HCS Hybrid Consulting Systems

## Contexte
Application Android native de coordination de visites hospitalières.
Nom : AvecToi | Baseline : "Parce qu'être présent, ça s'organise"
Développeur : HCS — Hybrid Consulting Systems (Guillaume Frey)
Repo GitHub : https://github.com/EI-HCS-Consulting/Planning-Visites-Maman

## POINT CRITIQUE — Modèle reader app (conformité Play Store)
L'app est "consumption-only" : elle NE VEND RIEN en son sein.
- Aucun écran de prix
- Aucun bouton d'achat ou "Créer un espace"
- Aucun lien vers une page de paiement
Le paiement (5,99€ Stripe) se fait EXCLUSIVEMENT sur le site web avectoi.care
Ce modèle est explicitement autorisé par Google Play et évite toute commission.

## Stack technique obligatoire
- React Native + Expo SDK 51+
- Expo Router (navigation file-based)
- Supabase (BDD + Auth + Storage + Realtime + Edge Functions)
- EAS Build / EAS Submit (build cloud + publication Play Store)
- expo-notifications (push rappels)
- expo-image-picker + expo-image-manipulator (galerie + compression)
- expo-calendar (ajout créneau au calendrier natif Android)
- expo-sharing (partage)
- react-native-qrcode-svg (QR code)
- Stripe : côté WEB uniquement (jamais dans l'app)

## Règles Git — STRICTES
- .env jamais committé — vérifier .gitignore avant chaque commit
- Ne jamais travailler directement sur main
- Toujours créer une branche : feature/nom-feature ou fix/nom-fix
- Format commit : "feat: description" / "fix: description" / "chore: description"
- Pull Request sur GitHub avant tout merge sur main

## Structure de dossiers cible
```
/app               → écrans (Expo Router)
  /(admin)         → écrans admin (dashboard, paramètres)
  /(visitor)       → écrans visiteur (calendrier, créneaux, souvenirs)
  /auth            → connexion admin
/components        → composants réutilisables
/lib
  supabase.ts      → client Supabase
  themes.ts        → 6 thèmes de couleur
/constants         → constantes métier
/assets            → logo SVG, images
.env               → credentials (JAMAIS committé)
.gitignore         → doit contenir .env
```

## Priorité des tâches V1 (ordre strict)
1.  Setup Expo + structure + connexion Supabase + Git configuré
2.  Auth admin (Supabase Auth — web + app)
3.  Écran visiteur : accès via lien d'invitation (token)
4.  Migration MVP : calendrier + créneaux + réservation + PIN
5.  Galerie Souvenirs (upload, download groupé, sélectionner tout, suppression PIN)
6.  Nouvelles du jour (publication texte + photos, flux anté-chronologique, droits PIN/admin)
7.  Entraide (besoins + statut + "Je m'en occupe") + Mur de soutien
8.  Thèmes couleur (6 thèmes, switch temps réel) + photo patient dans le logo
9.  Bouton "Prochaine disponibilité" (admin + visiteur)
10. Ajout créneau au calendrier natif Android
11. Notifications push (rappel 1h avant) + emails annulation admin
12. RGPD : purge auto (Edge Function quotidienne) + alerte J-7 + prolongation
13. EAS Build → APK signé
14. Fiche Play Store + soumission

## Références
- PRD complet : PRD_AvecToi_v1_4.md (dans ce projet)
- Code source MVP : App.jsx (dans ce projet)
- App web de référence : https://planning-visites-maman.vercel.app
- Supabase dashboard : https://supabase.com/dashboard/project/flmslcdzjuifkivmzins
- Vercel : https://vercel.com/ei-hcs-consultings-projects/planning-visites-maman
- GitHub : https://github.com/EI-HCS-Consulting/Planning-Visites-Maman
```

