# Handoff — AvecToi
_Généré le : 3 juillet 2026_

---

## 1. Objectif de la session

Débloquer la saisie d'adresse hôpital/domicile (précédemment en attente d'une décision d'architecture Google Places API) et permettre à l'admin de coller un lien Google Maps pour remplir automatiquement nom + adresse — **sans jamais utiliser de clé API Google**, contrainte explicite et répétée du client après discussion des risques de sécurité liés à l'embarquement d'une clé dans une app mobile.

**État "done" visé :** admin colle un lien Google Maps (hôpital), nom + adresse (rue/complément/CP/ville/pays) se remplissent automatiquement ; domicile génère son lien Maps automatiquement depuis l'adresse saisie. → **Atteint et confirmé fonctionnel par l'utilisateur**, y compris pour des adresses hors de France (testé sur un hôpital suisse et un hôpital allemand).

---

## 2. État actuel

### Ce qui fonctionne (livré et confirmé par l'utilisateur)
- **Décision d'architecture tranchée** : abandon de la piste Google Places API (directe ou via proxy Edge Function) — remplacée par une solution 100% gratuite et sans clé :
  1. Résolution des liens courts `maps.app.goo.gl` par simple suivi de redirection HTTP (`fetch(url, { method: "HEAD", redirect: "follow" })`).
  2. Lecture du nom et de l'adresse **directement dans le texte de l'URL Google** (`/maps/place/<nom>,+<rue>,+<CP>+<ville>[,+<pays>]/`), sans appel API.
  3. Repli sur **OpenStreetMap Nominatim** (géocodage inverse gratuit, sans clé, juste un `User-Agent` requis) uniquement pour les liens qui n'ont que des coordonnées GPS sans texte d'adresse (pin déposé sans fiche).
- **Adresse structurée** pour hôpital ET domicile : rue / complément / code postal / ville / **pays** (nouveau champ ajouté cette session).
- **Domicile** : lien Google Maps généré automatiquement depuis l'adresse saisie (pas de champ lien manuel, choix explicite du client).
- **Hôpital** : champ dédié pour coller un lien Google Maps trouvé sur internet ; au blur du champ, résolution automatique du nom + adresse complète avec spinners de chargement sur les champs concernés et toasts différenciés selon ce qui a été récupéré.
- **Correction du bug d'adresses étrangères** : le parsing cherchait initialement le "CP + ville" uniquement dans le dernier segment de l'URL, ce qui échouait pour les adresses hors de France où Google ajoute le pays comme segment supplémentaire après "CP Ville" (ex. `..., 8001 Zürich, Suisse`). Corrigé en cherchant ce motif à n'importe quelle position dans les segments, et en traitant tout ce qui suit comme le pays.
- **`components/SpaceHeader.tsx`** : affichage de l'adresse active (hôpital ou domicile selon `home_care_mode`) sur plusieurs lignes via `addressLines()`, ouverture du lien Maps adapté au mode.
- **`components/BookingFlow.tsx`** : notes de l'événement calendrier natif utilisent désormais l'adresse structurée complète (avec pays) via `joinAddress()`.
- **`app/index.tsx`** : logo réel de l'app (`assets/icon.png`) à la place de l'ancien emoji sur l'écran d'accueil.
- **Migrations exécutées en prod par l'utilisateur** :
  - `supabase/migrations/20260703_address_details.sql` (colonnes `*_address_line2`, `*_postal_code`, `*_city` pour hôpital et domicile)
  - `supabase/migrations/20260703_address_country.sql` (colonnes `hospital_country`, `home_country`)
- **Vérification** : `npx tsc --noEmit` propre (seules erreurs pré-existantes non liées, `lib/notifications.ts` et Edge Functions Deno, subsistent).

### Ce qui est en cours / non terminé
Rien de bloquant. Un `Alert.alert` de debug temporaire (`if (__DEV__) Alert.alert("Debug lien Maps", place.debug)`) a été laissé dans `handleHospitalMapsUrlBlur` (`app/(admin)/settings.tsx`) — utile pendant cette session pour diagnostiquer via captures d'écran pourquoi certains liens ne se résolvaient pas (a permis de découvrir que certains liens Google Maps n'ont pas de coordonnées `@lat,lon` du tout, juste un ID de lieu interne). Ne s'affiche qu'en dev, jamais en build de prod (`__DEV__`) — à retirer ou garder selon préférence du client, aucune urgence.

### Dernière action effectuée avant le handoff
Confirmation utilisateur ("c'est fait et ça fonctionne") après exécution de la migration `20260703_address_country.sql` et nouveau test sur les hôpitaux suisse/allemand : CP, ville et pays se remplissent désormais correctement.

---

## 3. Fichiers concernés

| Fichier | Rôle / modifications |
|---|---|
| `lib/types.ts` | `PatientSpace` : ajout `hospital_address_line2/postal_code/city/country`, `home_address_line2/postal_code/city/country`. |
| `lib/address.ts` | **Nouveau fichier**, cœur de la logique : `googleMapsSearchUrl` (URL Maps sans clé), `joinAddress`/`addressLines` (formatage), `hospitalAddressParts`/`homeAddressParts`/`activeAddressParts`, et toute la résolution de lien collé (`resolvePlaceFromMapsUrl` + helpers : parsing des segments `/maps/place/...`, extraction GPS en repli, décodage des URL de consentement RGPD imbriquées, géocodage inverse Nominatim). |
| `components/SpaceHeader.tsx` | Affichage adresse multi-lignes (`addressLines`), ouverture du lien Maps adapté au mode hôpital/domicile. |
| `components/BookingFlow.tsx` | Notes de l'événement calendrier natif via `joinAddress(activeAddressParts(space))`. |
| `app/index.tsx` | Logo réel (`assets/icon.png`) sur l'écran d'accueil. |
| `app/(admin)/settings.tsx` | Blocs "Coordonnées de l'hôpital" et "Coordonnées" (domicile) : champs rue/complément/CP/ville/**pays**, `handleHospitalMapsUrlBlur` (auto-remplissage), `handleSaveHospitalCoords`/`handleSaveHomeCoords`. |
| `supabase/migrations/20260703_address_details.sql` | ✅ Exécutée — colonnes adresse détaillée (hôpital + domicile). |
| `supabase/migrations/20260703_address_country.sql` | ✅ Exécutée — colonnes `hospital_country`, `home_country`. |

---

## 4. Ce qui a échoué

- **Google Places API (options A directe et B proxy Edge Function)** : écartées d'entrée par le client pour des raisons de sécurité de clé API embarquée dans une app mobile. Ne pas retenter cette piste sans revalidation explicite.
- **Lien Maps auto-généré pour l'hôpital aussi** : une première approche générait automatiquement le lien Maps pour hôpital ET domicile — le client a demandé de revenir à un champ de collage manuel pour l'hôpital uniquement (l'adresse officielle Google d'un hôpital est plus fiable que la recherche générée), en gardant l'auto-génération pour le domicile seul.
- **Extraction du nom incluant l'adresse complète** : la regex initiale capturait tout le segment `/maps/place/<...>/` jusqu'au premier `/`, donnant un nom du type "Hôpital X, Bd Y, 38700 Ville" — corrigé en découpant sur les virgules et en répartissant nom / rue / CP+ville / pays.
- **Dépendance systématique aux coordonnées GPS** : l'implémentation intermédiaire appelait Nominatim via les coordonnées `@lat,lon` de l'URL, mais de nombreux liens Google Maps (ceux avec un ID de lieu interne type `!1s0x478af...`) n'ont pas ce segment du tout — l'adresse ne se remplissait jamais. Diagnostiqué grâce à un `Alert.alert` de debug (le terminal/PowerShell du client n'affichait aucun log malgré plusieurs tentatives). Corrigé en lisant l'adresse texte directement dans l'URL en priorité, Nominatim n'étant qu'un repli.
- **Parsing CP/ville supposant "dernier segment = CP Ville"** : cassait pour les adresses hors France (pays ajouté par Google comme segment final après "CP Ville"). Corrigé en cherchant ce motif n'importe où dans les segments plutôt qu'en dernière position.

---

## 5. Prochaine étape

Aucune action bloquante — fonctionnalité validée par le client. Pistes pour une prochaine session, si le client souhaite continuer sur ce sujet :
1. Décider si le `Alert.alert` de debug (`__DEV__` uniquement, dans `handleHospitalMapsUrlBlur`) doit être retiré maintenant que le flux est stable, ou conservé comme outil de diagnostic pour de futurs formats de lien.
2. Revenir à la liste de priorités V1 (voir `CLAUDE.md` du projet) pour identifier la prochaine fonctionnalité à traiter — ce chantier adresse/Maps était une demande ad hoc, hors de cette liste initiale.
