import type { PatientSpace } from "./types";

/**
 * URL "Universal Cross-Platform Maps" de Google — pas de clé API requise,
 * ouvre l'app ou le web Google Maps directement sur la recherche.
 * https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsSearchUrl(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

type AddressParts = {
  street: string | null;
  line2: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
};

function cityLine(postalCode: string | null, city: string | null) {
  return [postalCode, city].filter((p) => p && p.trim().length > 0).join(" ");
}

/** Adresse sur une seule ligne (virgules), pour la recherche Google Maps et le calendrier natif. */
export function joinAddress({ street, line2, postalCode, city, country }: AddressParts): string {
  return [street, line2, cityLine(postalCode, city), country]
    .filter((p) => p && p.trim().length > 0)
    .join(", ");
}

/** Adresse en plusieurs lignes (rue / complément / CP+ville / pays), pour l'affichage dans le bandeau. */
export function addressLines({ street, line2, postalCode, city, country }: AddressParts): string[] {
  return [street, line2, cityLine(postalCode, city), country].filter((p) => p && p.trim().length > 0) as string[];
}

export function hospitalAddressParts(space: PatientSpace): AddressParts {
  return {
    street: space.hospital_address,
    line2: space.hospital_address_line2,
    postalCode: space.hospital_postal_code,
    city: space.hospital_city,
    country: space.hospital_country,
  };
}

export function homeAddressParts(space: PatientSpace): AddressParts {
  return {
    street: space.home_address,
    line2: space.home_address_line2,
    postalCode: space.home_postal_code,
    city: space.home_city,
    country: space.home_country,
  };
}

export function activeAddressParts(space: PatientSpace): AddressParts {
  return space.home_care_mode ? homeAddressParts(space) : hospitalAddressParts(space);
}

/**
 * Le segment /maps/place/<...>/ contient souvent le nom ET l'adresse
 * complète, séparés par des virgules :
 * "Hôpital Michallon - CHU Grenoble Alpes, Bd de la Chantourne, 38700 La Tronche"
 * → on renvoie chaque partie décodée pour les répartir ensuite (nom / rue /
 * CP+ville) sans dépendre des coordonnées GPS, absentes de certains liens.
 */
function extractPlaceSegments(url: string): string[] {
  const match = url.match(/\/maps\/place\/([^/?]+)/);
  if (!match) return [];
  const decoded = decodeURIComponent(match[1].replace(/\+/g, " "));
  return decoded.split(",").map((s) => s.trim()).filter(Boolean);
}

/**
 * Répartit les segments d'adresse (hors nom, en position 0) en rue / CP /
 * ville / pays. Pour une adresse hors du pays de l'utilisateur, Google
 * ajoute le pays comme dernier segment ("..., 8001 Zürich, Suisse") — on
 * cherche donc le segment "<CP> <ville>" n'importe où, pas seulement en
 * dernière position, et tout ce qui suit devient le pays.
 */
function parseAddressFromSegments(segments: string[]): { street: string | null; postalCode: string | null; city: string | null; country: string | null } {
  const rest = segments.slice(1);
  if (rest.length === 0) return { street: null, postalCode: null, city: null, country: null };
  const cpIndex = rest.findIndex((s) => /^\d{4,6}\s+.+$/.test(s));
  if (cpIndex === -1) {
    return { street: rest.join(", ") || null, postalCode: null, city: null, country: null };
  }
  const cpMatch = rest[cpIndex].match(/^(\d{4,6})\s+(.+)$/)!;
  const street = rest.slice(0, cpIndex).join(", ") || null;
  const country = rest.slice(cpIndex + 1).join(", ") || null;
  return { street, postalCode: cpMatch[1], city: cpMatch[2], country };
}

function extractCoords(url: string): { lat: number; lon: number } | null {
  const at = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (at) return { lat: parseFloat(at[1]), lon: parseFloat(at[2]) };
  // Repli : format "!3d<lat>!4d<lon>" utilisé dans le paramètre data= de
  // certaines URLs Google Maps quand le "@lat,lon" n'est pas présent.
  const bang = url.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bang) return { lat: parseFloat(bang[1]), lon: parseFloat(bang[2]) };
  return null;
}

/**
 * Certaines redirections Google (écran de consentement RGPD en zone UE, par
 * ex. consent.google.com/ml?continue=<url encodée>) transportent la vraie
 * URL maps.google.com dans un paramètre encodé plutôt que dans le path
 * visible. On décode une à deux fois pour faire remonter /maps/place/ et
 * @lat,lon avant d'y appliquer les regex ci-dessus.
 */
function decodeLayers(url: string, times = 2): string {
  let out = url;
  for (let i = 0; i < times; i++) {
    try {
      const next = decodeURIComponent(out);
      if (next === out) break;
      out = next;
    } catch {
      break;
    }
  }
  return out;
}

/**
 * Géocodage inverse gratuit et sans clé via OpenStreetMap Nominatim — leur
 * politique d'usage demande juste un User-Agent identifiant l'app (pas de
 * compte, pas d'inscription). Résultat parfois légèrement différent du
 * découpage d'adresse "officiel" Google — à ajuster à la main si besoin.
 * https://operations.osmfoundation.org/policies/nominatim/
 */
async function reverseGeocode(lat: number, lon: number): Promise<{ street: string | null; postalCode: string | null; city: string | null; country: string | null; note: string }> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1&email=support%40avectoi.care`,
      { headers: { "User-Agent": "AvecToi/1.0 (support@avectoi.care)", "Accept": "application/json", "Accept-Language": "fr" } }
    );
    if (!res.ok) {
      return { street: null, postalCode: null, city: null, country: null, note: `Nominatim a répondu ${res.status}` };
    }
    const data = await res.json();
    const a = data?.address ?? {};
    const street = ([a.house_number, a.road].filter(Boolean).join(" ") || null) as string | null;
    const postalCode = (a.postcode as string | undefined) ?? null;
    const city = (a.city ?? a.town ?? a.village ?? a.municipality ?? null) as string | null;
    const country = (a.country as string | undefined) ?? null;
    return { street, postalCode, city, country, note: `Nominatim OK : ${JSON.stringify(a)}` };
  } catch (e) {
    return { street: null, postalCode: null, city: null, country: null, note: `Nominatim a échoué : ${String(e)}` };
  }
}

export type ResolvedPlace = {
  name: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  /** Trace lisible de la résolution, pour affichage de debug côté admin. */
  debug: string;
};

/**
 * Résout nom + adresse depuis un lien Google Maps collé par l'admin.
 * - Nom + adresse : lus directement dans l'URL (segment /maps/place/<nom>,
 *   +<rue>,+<CP>+<ville>/), après avoir suivi la redirection pour un lien
 *   court (maps.app.goo.gl). Aucune clé API requise — pas d'appel à la
 *   Places API, juste une résolution d'URL.
 * - Repli : certains liens (pin déposé sans adresse formatée) n'ont que des
 *   coordonnées GPS et pas de texte d'adresse — dans ce cas seulement, on
 *   interroge Nominatim (géocodage inverse gratuit, sans clé) pour
 *   retrouver rue/CP/ville à partir des coordonnées.
 * Renvoie des champs à null quand rien n'a pu être résolu (lien non
 * reconnu, pas de connexion, etc.) — l'admin garde la main pour corriger.
 */
export async function resolvePlaceFromMapsUrl(url: string): Promise<ResolvedPlace> {
  const trace: string[] = [];
  const finish = (name: string | null, addr: { street: string | null; postalCode: string | null; city: string | null; country: string | null }): ResolvedPlace => ({
    name,
    ...addr,
    debug: trace.join("\n"),
  });
  const empty = { street: null, postalCode: null, city: null, country: null };

  const trimmed = url.trim();
  if (!trimmed) {
    trace.push("Lien vide.");
    return finish(null, empty);
  }

  let finalUrl = trimmed;
  if (extractPlaceSegments(trimmed).length === 0) {
    trace.push(`Lien court détecté, résolution de la redirection : ${trimmed}`);
    try {
      const res = await fetch(trimmed, { method: "HEAD", redirect: "follow" });
      finalUrl = res.url || trimmed;
      trace.push(`URL finale : ${finalUrl}`);
    } catch (e) {
      trace.push(`Échec de la résolution du lien : ${String(e)}`);
      return finish(null, empty);
    }
  } else {
    trace.push(`Lien direct (déjà une URL /maps/place/) : ${trimmed}`);
  }

  const decoded = decodeLayers(finalUrl);
  const segments = extractPlaceSegments(finalUrl).length ? extractPlaceSegments(finalUrl) : extractPlaceSegments(decoded);
  const name = segments[0] ?? null;
  trace.push(`Nom trouvé : ${name ?? "aucun"}`);

  const addrFromUrl = parseAddressFromSegments(segments);
  if (addrFromUrl.street || addrFromUrl.postalCode || addrFromUrl.city) {
    trace.push(`Adresse lue directement dans le lien → rue=${addrFromUrl.street ?? "—"} / CP=${addrFromUrl.postalCode ?? "—"} / ville=${addrFromUrl.city ?? "—"} / pays=${addrFromUrl.country ?? "—"}`);
    return finish(name, addrFromUrl);
  }

  const coords = extractCoords(finalUrl) ?? extractCoords(decoded);
  trace.push(coords ? `Pas d'adresse texte dans le lien, coordonnées trouvées : ${coords.lat}, ${coords.lon}` : "Pas d'adresse texte ni de coordonnées dans le lien.");
  if (!coords) return finish(name, empty);

  const addr = await reverseGeocode(coords.lat, coords.lon);
  trace.push(`Nominatim → rue=${addr.street ?? "—"} / CP=${addr.postalCode ?? "—"} / ville=${addr.city ?? "—"} / pays=${addr.country ?? "—"}`);
  return finish(name, addr);
}
