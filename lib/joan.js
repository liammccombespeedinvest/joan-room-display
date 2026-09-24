const TOKEN_URL = "https://portal.getjoan.com/api/token/";
const RESERVATIONS_URL = "https://portal.getjoan.com/api/2.0/portal/rooms/reservations/";
const ROOMS_URL = "https://portal.getjoan.com/api/2.0/portal/rooms/";
const PAGE_SIZE = 500;
const MAX_PAGES = 20;
const LOOKBACK_MS = 7 * 24 * 60 * 60 * 1000;

let tokenCache = null;
let reservationCache = null;

async function jsonOrThrow(response, label) {
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${label} failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

export async function getAccessToken({ clientId, clientSecret, fetchImpl = fetch, now = Date.now() }) {
  if (tokenCache && tokenCache.expiresAt > now + 60_000) return tokenCache.value;

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetchImpl(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });
  const data = await jsonOrThrow(response, "Joan authentication");

  if (!data.access_token) throw new Error("Joan authentication returned no access token");
  tokenCache = {
    value: data.access_token,
    expiresAt: now + Math.max(60, Number(data.expires_in) || 3600) * 1000
  };
  return tokenCache.value;
}

async function fetchPage({ token, limit, offset, fetchImpl }) {
  const url = new URL(RESERVATIONS_URL);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("offset", String(offset));

  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return jsonOrThrow(response, "Joan reservations");
}

export async function fetchRelevantReservations({ token, fetchImpl = fetch, now = Date.now(), fresh = false }) {
  if (!fresh && reservationCache && reservationCache.expiresAt > now) return reservationCache.value;

  const probe = await fetchPage({ token, limit: 1, offset: 0, fetchImpl });
  const count = Math.max(0, Number(probe.count) || 0);
  if (count === 0) return [];

  const pages = [];
  let offset = Math.floor((count - 1) / PAGE_SIZE) * PAGE_SIZE;
  const stopBefore = now - LOOKBACK_MS;
  let reachedRelevantHistory = false;

  for (let pageNumber = 0; offset >= 0 && pageNumber < MAX_PAGES; pageNumber += 1) {
    const page = await fetchPage({ token, limit: PAGE_SIZE, offset, fetchImpl });
    const results = Array.isArray(page.results) ? page.results : [];
    pages.push(...results);

    const newestStart = results.reduce((latest, item) => {
      const value = Date.parse(item?.start);
      return Number.isFinite(value) ? Math.max(latest, value) : latest;
    }, -Infinity);

    if (newestStart < stopBefore) {
      reachedRelevantHistory = true;
      break;
    }
    offset -= PAGE_SIZE;
  }

  if (offset < 0) reachedRelevantHistory = true;
  if (!reachedRelevantHistory) {
    throw new Error(`Joan reservation history exceeded the ${MAX_PAGES}-page safety limit`);
  }

  reservationCache = { value: pages, expiresAt: now + 30_000 };
  return pages;
}

// Walk-up bookings only need the newest reservations for a final collision
// check. Avoid walking backwards through weeks of company-wide history, which
// can exceed a serverless function's execution limit on larger accounts.
export async function fetchLatestReservations({ token, fetchImpl = fetch }) {
  const probe = await fetchPage({ token, limit: 1, offset: 0, fetchImpl });
  const count = Math.max(0, Number(probe.count) || 0);
  if (count === 0) return [];

  const offset = Math.max(0, count - PAGE_SIZE);
  const page = await fetchPage({ token, limit: PAGE_SIZE, offset, fetchImpl });
  return Array.isArray(page.results) ? page.results : [];
}

export async function fetchRoom({ token, roomId, fetchImpl = fetch }) {
  const response = await fetchImpl(`${ROOMS_URL}${encodeURIComponent(roomId)}/`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return jsonOrThrow(response, "Joan room lookup");
}

export async function createReservation({ token, payload, fetchImpl = fetch }) {
  const response = await fetchImpl(RESERVATIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });
  const reservation = await jsonOrThrow(response, "Joan room booking");
  reservationCache = null;
  return reservation;
}

export function clearCachesForTests() {
  tokenCache = null;
  reservationCache = null;
}
