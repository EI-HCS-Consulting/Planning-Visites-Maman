import AsyncStorage from "@react-native-async-storage/async-storage";

// Persists "who is this visitor" on-device so reopening the app lands
// straight on the calendar instead of asking for the invite link again,
// and so booking forms can be pre-filled with prénom/nom. One slot per
// device — in practice a visitor's phone only ever follows one patient's
// link.
//
// `pin` is also the credential checked by `sessionPinMatches` below to skip
// re-asking for a PIN when modifying/cancelling a record the visitor
// authored on this same device — see sessionPinMatches.
const KEY = "visitor_session";

export interface VisitorSession {
  token: string;
  spaceId: string;
  prenom: string;
  nom: string;
  email: string;
  pin: string;
  localPhotoUri: string | null;
}

export async function getVisitorSession(): Promise<VisitorSession | null> {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as VisitorSession;
  } catch {
    return null;
  }
}

export async function saveVisitorSession(
  partial: {
    token: string;
    spaceId: string;
    prenom?: string;
    nom?: string;
    email?: string;
    pin?: string;
    localPhotoUri?: string | null;
  },
): Promise<void> {
  const existing = await getVisitorSession();
  const merged: VisitorSession = {
    token: partial.token,
    spaceId: partial.spaceId,
    prenom: partial.prenom ?? existing?.prenom ?? "",
    nom: partial.nom ?? existing?.nom ?? "",
    email: partial.email ?? existing?.email ?? "",
    pin: partial.pin ?? existing?.pin ?? "",
    localPhotoUri: partial.localPhotoUri ?? existing?.localPhotoUri ?? null,
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
}

export async function clearVisitorSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}

// Le PIN saisi une fois en "Mon compte" sert d'identité pour ce téléphone :
// s'il correspond au PIN stocké sur l'élément (réservation, nouvelle,
// tâche, message), on évite de le redemander pour le modifier/annuler.
// Si aucune session n'est enregistrée, ou si le PIN ne correspond pas
// (élément créé par quelqu'un d'autre sur le même appareil), on retombe
// sur la saisie manuelle du PIN.
export async function sessionPinMatches(pin: string | null | undefined): Promise<boolean> {
  if (!pin) return false;
  const session = await getVisitorSession();
  return !!session && session.pin === pin;
}

// À appeler juste après la création d'un élément protégé par PIN
// (réservation, nouvelle, message de soutien, prise en charge d'une
// tâche) pour que sessionPinMatches puisse reconnaître l'auteur plus tard
// sans redemander le PIN. No-op si aucune session (token/spaceId) n'existe
// encore — ne devrait pas arriver, le visiteur arrive toujours via un lien
// d'invitation qui crée la session en premier.
export async function rememberAuthorPin(prenom: string, nom: string, pin: string): Promise<void> {
  const existing = await getVisitorSession();
  if (!existing) return;
  await saveVisitorSession({ token: existing.token, spaceId: existing.spaceId, prenom, nom, pin });
}
