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

export type LatLng = { lat: number; lng: number };

export function isValidLatLng(lat?: number | null, lng?: number | null): lat is number {
  return (
    lat != null &&
    lng != null &&
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

/**
 * Fix common swap: India latitudes are ~6–37, longitudes ~68–98.
 * If values look swapped, correct them.
 */
export function normalizeIndiaLatLng(
  lat?: number | null,
  lng?: number | null
): { lat: number; lng: number } | null {
  if (!isValidLatLng(lat, lng)) return null;
  let a = lat;
  let b = lng;
  // Classic swap: lat looks like an Indian longitude and lng looks like a latitude
  if (a >= 68 && a <= 98 && b >= 6 && b <= 38) {
    return { lat: b, lng: a };
  }
  return { lat: a, lng: b };
}

/** Geocode an address via Nominatim (OpenStreetMap). */
export async function geocodeAddressToLatLng(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  if (!query?.trim()) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
      query.trim()
    )}&limit=1&countrycodes=in`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': 'Purifies/1.0' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const lat = parseFloat(data[0].lat);
    const lng = parseFloat(data[0].lon);
    return normalizeIndiaLatLng(lat, lng);
  } catch {
    return null;
  }
}

/**
 * Resolve shop + customer coordinates for map display.
 * Geocodes full addresses first (same strings as Google Maps navigation);
 * stored GPS is fallback only when geocoding fails.
 */
export async function resolveOrderMapCoordinates(params: {
  shopLat?: number | null;
  shopLng?: number | null;
  shopAddress?: string | null;
  shopName?: string | null;
  shopPincode?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  customerAddress?: string | null;
  customerPincode?: string | null;
}): Promise<{
  shop: { lat: number; lng: number } | null;
  customer: { lat: number; lng: number } | null;
}> {
  let shop: { lat: number; lng: number } | null = null;
  let customer: { lat: number; lng: number } | null = null;

  const shopQueries = [
    [params.shopName, params.shopAddress, params.shopPincode].filter(Boolean).join(', '),
    [params.shopAddress, params.shopPincode, 'Maharashtra, India'].filter(Boolean).join(', '),
    params.shopPincode ? `${params.shopPincode}, Maharashtra, India` : '',
    params.shopName ? `${params.shopName}, Maharashtra, India` : '',
  ].filter(Boolean);

  for (const q of shopQueries) {
    shop = await geocodeAddressToLatLng(q);
    if (shop) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!shop) {
    shop = normalizeIndiaLatLng(params.shopLat, params.shopLng);
  }

  const customerQueries = [
    [params.customerAddress, params.customerPincode].filter(Boolean).join(', '),
    [params.customerAddress, params.customerPincode, 'Maharashtra, India'].filter(Boolean).join(', '),
    params.customerPincode ? `${params.customerPincode}, Maharashtra, India` : '',
    params.customerAddress ? `${params.customerAddress}, India` : '',
  ].filter(Boolean);

  for (const q of customerQueries) {
    customer = await geocodeAddressToLatLng(q);
    if (customer) break;
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!customer) {
    customer = normalizeIndiaLatLng(params.customerLat, params.customerLng);
  }

  return { shop, customer };
}

/** Full address lines used by Google Maps navigation buttons. */
export function buildNavigationAddressLines(params: {
  shopName?: string | null;
  shopAddress?: string | null;
  shopPincode?: string | null;
  customerAddress?: string | null;
  customerPincode?: string | null;
}): { shopAddressLine: string; customerAddressLine: string } {
  const shopAddressLine =
    [params.shopName, params.shopAddress, params.shopPincode].filter(Boolean).join(', ') ||
    params.shopAddress ||
    '';
  const customerAddressLine =
    [params.customerAddress, params.customerPincode].filter(Boolean).join(', ') ||
    params.customerAddress ||
    '';
  return { shopAddressLine, customerAddressLine };
}

/** Road km for shop → customer — same OSRM logic as delivery Leaflet map green route. */
export async function fetchShopToCustomerRoadKm(params: {
  shopLat?: number | null;
  shopLng?: number | null;
  shopAddress?: string | null;
  shopName?: string | null;
  shopPincode?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  customerAddress?: string | null;
  customerPincode?: string | null;
}): Promise<number | undefined> {
  const { shop, customer } = await resolveOrderMapCoordinates(params);
  if (!shop || !customer) return undefined;
  const road = await fetchDrivingRoute(shop.lat, shop.lng, customer.lat, customer.lng);
  if (road) return road.distanceKm;
  return Math.round((haversineMeters(shop.lat, shop.lng, customer.lat, customer.lng) / 1000) * 100) / 100;
}

/**
 * Same total as delivery dashboard "Road distance" legend:
 * Blue (You → Shop) + Green (Shop → Customer) = Total km.
 * Shop/customer pins use address geocode first (same as View Map).
 */
export async function computeDeliveryMapTotalDistance(params: {
  driverLat?: number | null;
  driverLng?: number | null;
  shopLat?: number | null;
  shopLng?: number | null;
  shopAddress?: string | null;
  shopName?: string | null;
  shopPincode?: string | null;
  customerLat?: number | null;
  customerLng?: number | null;
  customerAddress?: string | null;
  customerPincode?: string | null;
}): Promise<{
  driverToShopKm?: number;
  shopToCustomerKm?: number;
  totalKm?: number;
}> {
  const { shop, customer } = await resolveOrderMapCoordinates({
    shopLat: params.shopLat,
    shopLng: params.shopLng,
    shopAddress: params.shopAddress,
    shopName: params.shopName,
    shopPincode: params.shopPincode,
    customerLat: params.customerLat,
    customerLng: params.customerLng,
    customerAddress: params.customerAddress,
    customerPincode: params.customerPincode,
  });
  const driver = normalizeIndiaLatLng(params.driverLat, params.driverLng);

  let driverToShopKm: number | undefined;
  let shopToCustomerKm: number | undefined;

  if (shop && customer) {
    const road = await fetchDrivingRoute(shop.lat, shop.lng, customer.lat, customer.lng);
    shopToCustomerKm = road
      ? road.distanceKm
      : Math.round((haversineMeters(shop.lat, shop.lng, customer.lat, customer.lng) / 1000) * 100) / 100;
  }

  if (driver && shop) {
    const road = await fetchDrivingRoute(driver.lat, driver.lng, shop.lat, shop.lng);
    driverToShopKm = road
      ? road.distanceKm
      : Math.round((haversineMeters(driver.lat, driver.lng, shop.lat, shop.lng) / 1000) * 100) / 100;
  }

  let totalKm: number | undefined;
  if (driverToShopKm != null && shopToCustomerKm != null) {
    totalKm = Math.round((driverToShopKm + shopToCustomerKm) * 100) / 100;
  } else if (shopToCustomerKm != null) {
    totalKm = shopToCustomerKm;
  } else if (driverToShopKm != null) {
    totalKm = driverToShopKm;
  }

  return { driverToShopKm, shopToCustomerKm, totalKm };
}

/** Straight-line km between two GPS points. */
export function distanceKmBetween(
  lat1?: number | null,
  lng1?: number | null,
  lat2?: number | null,
  lng2?: number | null
): number | undefined {
  if (!isValidLatLng(lat1, lng1) || !isValidLatLng(lat2, lng2)) return undefined;
  return Math.round((haversineMeters(lat1, lng1, lat2, lng2) / 1000) * 100) / 100;
}

export interface DeliveryTripDistance {
  /** Driver current location → shop (pickup) */
  driverToShopKm?: number;
  /** Shop → customer drop-off */
  shopToCustomerKm?: number;
  /**
   * Total trip the driver travels when both legs exist:
   * driver → shop → customer. Falls back to whichever leg is known.
   */
  totalKm?: number;
}

/**
 * Accurate trip distance from GPS:
 * driver → shop, then shop → customer (sum = total trip).
 */
export function computeDeliveryTripDistance(params: {
  driverLat?: number | null;
  driverLng?: number | null;
  shopLat?: number | null;
  shopLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
}): DeliveryTripDistance {
  const driver = normalizeIndiaLatLng(params.driverLat, params.driverLng);
  const shop = normalizeIndiaLatLng(params.shopLat, params.shopLng);
  const customer = normalizeIndiaLatLng(params.customerLat, params.customerLng);

  const driverToShopKm = distanceKmBetween(
    driver?.lat,
    driver?.lng,
    shop?.lat,
    shop?.lng
  );
  const shopToCustomerKm = distanceKmBetween(
    shop?.lat,
    shop?.lng,
    customer?.lat,
    customer?.lng
  );

  let totalKm: number | undefined;
  if (driverToShopKm != null && shopToCustomerKm != null) {
    totalKm = Math.round((driverToShopKm + shopToCustomerKm) * 100) / 100;
  } else if (shopToCustomerKm != null) {
    totalKm = shopToCustomerKm;
  } else if (driverToShopKm != null) {
    totalKm = driverToShopKm;
  }

  return { driverToShopKm, shopToCustomerKm, totalKm };
}

/**
 * Road (driving) distance via public OSRM. Falls back to null on failure.
 * Prefer for accuracy when network is available — follows real roads like Google Maps.
 */
export async function fetchDrivingDistanceKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<number | undefined> {
  const route = await fetchDrivingRoute(lat1, lng1, lat2, lng2);
  return route?.distanceKm;
}

export interface DrivingRouteResult {
  /** Road following distance in km (OSRM / same class as Google Maps driving) */
  distanceKm: number;
  /** Route polyline as [lat, lng][] for Leaflet */
  coordinates: [number, number][];
}

/**
 * Fetch full driving route geometry + distance from OSRM (OpenStreetMap roads).
 * Distance matches the road path drawn on the map (not straight-line GPS).
 */
export async function fetchDrivingRoute(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<DrivingRouteResult | undefined> {
  if (!isValidLatLng(lat1, lng1) || !isValidLatLng(lat2, lng2)) return undefined;
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/${lng1},${lat1};${lng2},${lat2}` +
      `?overview=full&geometries=geojson`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const data = await res.json();
    const route = data?.routes?.[0];
    const meters = route?.distance;
    const coordsRaw: [number, number][] | undefined = route?.geometry?.coordinates;
    if (typeof meters !== 'number' || Number.isNaN(meters) || !coordsRaw?.length) {
      return undefined;
    }
    // GeoJSON is [lng, lat] — Leaflet needs [lat, lng]
    const coordinates: [number, number][] = coordsRaw.map(([lng, lat]) => [lat, lng]);
    return {
      distanceKm: Math.round((meters / 1000) * 100) / 100,
      coordinates,
    };
  } catch {
    return undefined;
  }
}

/**
 * Prefer road distance when OSRM succeeds; otherwise GPS straight-line.
 */
export async function computeAccurateDeliveryTripDistance(params: {
  driverLat?: number | null;
  driverLng?: number | null;
  shopLat?: number | null;
  shopLng?: number | null;
  customerLat?: number | null;
  customerLng?: number | null;
}): Promise<
  DeliveryTripDistance & {
    source: 'road' | 'gps';
    driverToShopRoute?: [number, number][];
    shopToCustomerRoute?: [number, number][];
  }
> {
  const driver = normalizeIndiaLatLng(params.driverLat, params.driverLng);
  const shop = normalizeIndiaLatLng(params.shopLat, params.shopLng);
  const customer = normalizeIndiaLatLng(params.customerLat, params.customerLng);

  const gps = computeDeliveryTripDistance({
    driverLat: driver?.lat,
    driverLng: driver?.lng,
    shopLat: shop?.lat,
    shopLng: shop?.lng,
    customerLat: customer?.lat,
    customerLng: customer?.lng,
  });
  let driverToShopKm = gps.driverToShopKm;
  let shopToCustomerKm = gps.shopToCustomerKm;
  let usedRoad = false;
  let driverToShopRoute: [number, number][] | undefined;
  let shopToCustomerRoute: [number, number][] | undefined;

  if (shop && customer) {
    const road = await fetchDrivingRoute(shop.lat, shop.lng, customer.lat, customer.lng);
    if (road) {
      shopToCustomerKm = road.distanceKm;
      shopToCustomerRoute = road.coordinates;
      usedRoad = true;
    } else if (shopToCustomerKm != null) {
      shopToCustomerRoute = [
        [shop.lat, shop.lng],
        [customer.lat, customer.lng],
      ];
    }
  }

  if (driver && shop) {
    const road = await fetchDrivingRoute(driver.lat, driver.lng, shop.lat, shop.lng);
    if (road) {
      driverToShopKm = road.distanceKm;
      driverToShopRoute = road.coordinates;
      usedRoad = true;
    } else if (driverToShopKm != null) {
      driverToShopRoute = [
        [driver.lat, driver.lng],
        [shop.lat, shop.lng],
      ];
    }
  }

  let totalKm: number | undefined;
  if (driverToShopKm != null && shopToCustomerKm != null) {
    totalKm = Math.round((driverToShopKm + shopToCustomerKm) * 100) / 100;
  } else if (shopToCustomerKm != null) {
    totalKm = shopToCustomerKm;
  } else if (driverToShopKm != null) {
    totalKm = driverToShopKm;
  }

  return {
    driverToShopKm,
    shopToCustomerKm,
    totalKm,
    source: usedRoad ? 'road' : 'gps',
    driverToShopRoute,
    shopToCustomerRoute,
  };
}
