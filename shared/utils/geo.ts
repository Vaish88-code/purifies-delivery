const EARTH_RADIUS_METERS = 6371000; // Mean Earth radius in meters

/** Normalize place names for comparison (trim, lowercase, collapse spaces). */
export const normalizeLocationKey = (s: string | null | undefined): string => {
  if (!s?.trim()) return '';
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
};

/** Uses the last comma-separated segment as city when `city` field is missing. */
export const deriveCityTokenFromAddress = (address?: string | null): string => {
  if (!address?.trim()) return '';
  const parts = address.split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.length) return '';
  return parts[parts.length - 1];
};

export const cityKeyForMatching = (city?: string | null, address?: string | null): string => {
  const c = (city || '').trim();
  if (c) return normalizeLocationKey(c);
  return normalizeLocationKey(deriveCityTokenFromAddress(address));
};

/** If both sides have a state, they must match; missing state on either side does not block. */
export const statesCompatibleForAreaMatch = (
  vendorState?: string | null,
  personState?: string | null
): boolean => {
  const vs = normalizeLocationKey(vendorState || '');
  const ps = normalizeLocationKey(personState || '');
  if (vs && ps) return vs === ps;
  return true;
};

export const haversineMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(EARTH_RADIUS_METERS * c);
};

export const distanceMetersShopToPerson = (
  vendorLat?: number | null,
  vendorLng?: number | null,
  personLat?: number | null,
  personLng?: number | null
): number | undefined => {
  if (
    vendorLat == null ||
    vendorLng == null ||
    personLat == null ||
    personLng == null ||
    Number.isNaN(vendorLat) ||
    Number.isNaN(vendorLng) ||
    Number.isNaN(personLat) ||
    Number.isNaN(personLng)
  ) {
    return undefined;
  }
  return haversineMeters(vendorLat, vendorLng, personLat, personLng);
};

export const formatDistance = (meters?: number): string => {
  if (meters == null || Number.isNaN(meters)) return '—';
  if (meters < 1000) return `${meters.toFixed(0)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
};

/** Kilometers only — used where vendors compare distance to delivery persons. */
export const formatDistanceKm = (meters?: number): string => {
  if (meters == null || Number.isNaN(meters)) return '—';
  const km = meters / 1000;
  const decimals = km >= 100 ? 1 : 2;
  return `${km.toFixed(decimals)} km`;
};

/** Numeric km string only (no unit) for custom labels. */
export const formatKmNumber = (meters: number): string => {
  const km = meters / 1000;
  const decimals = km >= 100 ? 1 : 2;
  return km.toFixed(decimals);
};
