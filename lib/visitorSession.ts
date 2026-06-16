import AsyncStorage from "@react-native-async-storage/async-storage";

// Persists "who is this visitor" on-device so reopening the app lands
// straight on the calendar instead of asking for the invite link again,
// and so booking forms can be pre-filled with prénom/nom. One slot per
// device — in practice a visitor's phone only ever follows one patient's
// link. The PIN itself is intentionally NOT stored here: it's always
// re-entered to confirm a sensitive action (cancel/edit/delete).
const KEY = "visitor_session";

export interface VisitorSession {
  token: string;
  spaceId: string;
  prenom: string;
  nom: string;
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
  partial: { token: string; spaceId: string; prenom?: string; nom?: string },
): Promise<void> {
  const existing = await getVisitorSession();
  const merged: VisitorSession = {
    token: partial.token,
    spaceId: partial.spaceId,
    prenom: partial.prenom ?? existing?.prenom ?? "",
    nom: partial.nom ?? existing?.nom ?? "",
  };
  await AsyncStorage.setItem(KEY, JSON.stringify(merged));
}

export async function clearVisitorSession(): Promise<void> {
  await AsyncStorage.removeItem(KEY);
}
