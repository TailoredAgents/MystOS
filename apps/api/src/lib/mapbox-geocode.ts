import { URLSearchParams } from "url";

type AddressInput = {
  line1: string;
  city: string;
  state: string;
  postalCode: string;
};

type MapboxFeature = {
  center?: [number, number];
  relevance?: number;
};

type MapboxResponse = {
  features?: MapboxFeature[];
};

const MAPBOX_API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";

export async function geocodeAddress(
  address: AddressInput
): Promise<{ lat: number; lng: number } | null> {
  const token = process.env["MAPBOX_ACCESS_TOKEN"];
  if (!token) {
    return null;
  }

  const query = `${address.line1}, ${address.city}, ${address.state} ${address.postalCode}`;
  const qs = new URLSearchParams({
    access_token: token,
    autocomplete: "false",
    limit: "1",
    country: "US"
  });

  const url = `${MAPBOX_API_URL}/${encodeURIComponent(query)}.json?${qs.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      console.warn("[mapbox] geocode.failed", { status: response.status, statusText: response.statusText });
      return null;
    }

    const data = (await response.json()) as MapboxResponse;
    const feature = data.features?.[0];
    if (!feature?.center || feature.center.length !== 2) {
      return null;
    }
    const [lng, lat] = feature.center;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  } catch (error) {
    console.warn("[mapbox] geocode.error", { error: String(error) });
    return null;
  }
}
