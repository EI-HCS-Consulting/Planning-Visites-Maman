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
/app
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
CLAUDE.md          → ce fichier
PRD_AvecToi_v1_4.md → PRD complet (référence)
App.jsx            → MVP web de référence (logique à porter en RN)
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

## Commande handoff
Quand je dis "génère un handoff", tu dois :
1. Remplir le template ci-dessous avec l'état exact de la session en cours
2. Écrire le résultat dans un fichier `handoff.md` à la racine du projet
3. Confirmer que le fichier est écrit et prêt

### Template handoff
```markdown
# Handoff — AvecToi
_Généré le : {date et heure}_

## 1. Objectif de la session
Ce qu'on cherchait à accomplir.
État "done" : comment on saurait que c'est terminé.

## 2. État actuel
Ce qui fonctionne déjà.
Ce qui est en cours (non terminé).
Dernière action effectuée avant le handoff.

## 3. Fichiers concernés
Chemins exacts des fichiers touchés + rôle de chacun.
Ex : src/components/Calendar.tsx → composant calendrier visiteur

## 4. Ce qui a échoué
Pistes déjà tentées qui n'ont PAS marché, et pourquoi.
⚠️ Section critique : évite de re-tenter les impasses.

## 5. Prochaine étape
La toute prochaine action concrète à effectuer.
Être directif : commande, fichier, ou tâche précise en premier.
Hypothèses à tester, par ordre de priorité.
```

## Références
- PRD complet : PRD_AvecToi_v1_4.md (dans ce dossier)
- Code source MVP : App.jsx (dans ce dossier)
- App web de référence : https://planning-visites-maman.vercel.app
- Supabase dashboard : https://supabase.com/dashboard/project/flmslcdzjuifkivmzins
- Vercel : https://vercel.com/ei-hcs-consultings-projects/planning-visites-maman
- GitHub : https://github.com/EI-HCS-Consulting/Planning-Visites-Maman
