# AvecToi — État du déploiement

> Dernière mise à jour : 15 juin 2026
> Développeur : HCS — Hybrid Consulting Systems (Guillaume Frey)

---

## 1. Application React Native (Expo)

| Champ | Valeur |
|---|---|
| Nom | AvecToi |
| Bundle ID / Package | `care.avectoi.app` |
| SDK | Expo SDK 54 |
| React Native | 0.81.5 |
| React | 19.1.0 |
| Version app | 1.0.0 (versionCode 1) |
| Navigation | Expo Router ~6.0 |
| Branche active | `feature/expo-setup` |

---

## 2. EAS Build — Expo Application Services

**Projet EAS**
- Compte : `ei-hcs-consulting`
- Slug : `avectoi`
- Project ID : `305abfe3-5d04-449f-9b06-8975f2196588`
- Dashboard : https://expo.dev/accounts/ei-hcs-consulting/projects/avectoi

**Profils de build (`eas.json`)**

| Profil | Type | Distribution | Usage |
|---|---|---|---|
| `development` | APK | internal | Dev avec hot reload |
| `preview` | APK (assembleRelease) | internal | Tests internes |
| `production` | AAB (app-bundle) | store | Play Store |

**Keystore Android**
- Gérée par EAS (cloud, serveurs Expo)
- Nom : `Build Credentials IMr2RrsA1I` (default)

**Historique des builds**

| Date | ID | Statut | APK |
|---|---|---|---|
| 15/06/2026 11h | `22ad09f1` | ✅ FINISHED | [Télécharger](https://expo.dev/artifacts/eas/Absy6vAAzYjwcXN_sGejwbenWvGdLpkkr4AmbBrvDnE.apk) |
| 15/06/2026 08h43 | `6b643fe2` | ✅ FINISHED | [Télécharger](https://expo.dev/artifacts/eas/pJ9Jvmdma7FIWpGpR7WtQplcMKHT84ACsoG8T-IcVDU.apk) |
| 15/06/2026 08h35 | `0c94605c` | ❌ ERRORED | — |
| 15/06/2026 08h30 | `f38102ce` | ❌ ERRORED | — |
| 15/06/2026 08h22 | `8b68f0f4` | ❌ ERRORED | — |

> Les builds en erreur sont liés à des dépendances manquantes (`expo-font`, `expo-asset`) et à une version React Native incompatible avec SDK 53, corrigés avant les builds réussis.
> Les APK expirent le **29 juin 2026**.

---

## 3. Variables d'environnement EAS

Configurées via `eas env:create` pour les 3 environnements (`development`, `preview`, `production`) :

| Variable | Visibilité | Valeur |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | plaintext | `https://flmslcdzjuifkivmzins.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | sensitive | `eyJhbGci...` (clé anon JWT) |

---

## 4. Supabase

| Champ | Valeur |
|---|---|
| Project ref | `flmslcdzjuifkivmzins` |
| URL | `https://flmslcdzjuifkivmzins.supabase.co` |
| Dashboard | https://supabase.com/dashboard/project/flmslcdzjuifkivmzins |
| Région | (par défaut Supabase) |

**Edge Functions déployées**

| Fonction | Fichier | Rôle |
|---|---|---|
| `notify-cancel` | `supabase/functions/notify-cancel/index.ts` | Email d'annulation admin |
| `rgpd-purge` | `supabase/functions/rgpd-purge/index.ts` | Purge auto des données RGPD |

**Cron (purge RGPD)**
- Défini dans `supabase/cron.sql`
- Fréquence : quotidienne
- Déclenche `rgpd-purge` + alerte J-7 avant expiration

---

## 5. MVP Web (référence)

| Champ | Valeur |
|---|---|
| URL | https://planning-visites-maman.vercel.app |
| Hébergeur | Vercel |
| Dashboard Vercel | https://vercel.com/ei-hcs-consultings-projects/planning-visites-maman |
| Fichier source | `App.jsx` (dans ce dépôt) |

---

## 6. GitHub

| Champ | Valeur |
|---|---|
| Repo | https://github.com/EI-HCS-Consulting/Planning-Visites-Maman |
| Branche principale | `main` |
| Branche en cours | `feature/expo-setup` |

**Commits V1 (tâches complétées)**

| Commit | Tâche |
|---|---|
| `684a486` | Connexion historique RN ↔ MVP web |
| `643618e` | Tâche 14 — Fiche Play Store + configuration soumission |
| `4e209d6` | Tâche 13 — EAS Build APK/AAB signé |
| `dc2379e` | Tâche 12 — RGPD purge auto + alerte J-7 + prolongation |
| `c26dea5` | Tâche 11 — Notifications push + email annulation admin |
| `2380582` | Tâche 10 — Ajout créneau au calendrier natif Android |
| `f58af81` | Tâche 9 — Invitations + admin CRUD réservations dashboard |
| `cc11ce8` | Tâche 8 — Thèmes couleur temps réel + photo patient |
| `8dfcf0d` | Tâche 7 — Entraide & mur de soutien |
| `cc92c4a` | Tâche 6 — Nouvelles du jour (flux + publication + photos + PIN) |
| `55512ad` | Tâche 5 — Galerie souvenirs (upload + compression + PIN) |
| `a646d54` | Tâche 4 — Réservation visiteur + PIN + calendrier |
| `374b704` | Tâches 2+3 — Auth admin + espace patient + deep link |
| `cb8f753` | Tâche 1 — Setup Expo SDK 53 + Router + Supabase |

---

## 7. Prochaines étapes

- [ ] Build EAS post-upgrade SDK 54 (les 2 builds réussis sont SDK 53)
- [ ] Soumission Play Store (`eas submit --profile production`)
- [ ] Configurer `google-play-service-account.json` pour la soumission automatique
- [ ] Tester les push notifications sur APK (non disponible dans Expo Go SDK 53+)
