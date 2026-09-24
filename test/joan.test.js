import test from "node:test";
import assert from "node:assert/strict";
import {
  clearCachesForTests,
  fetchRelevantReservations,
  getAccessToken
} from "../lib/joan.js";

test("caches an OAuth access token until shortly before expiry", async () => {
  clearCachesForTests();
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(JSON.stringify({ access_token: "safe-test-token", expires_in: 36000 }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  const first = await getAccessToken({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
    now: 1_000
  });
  const second = await getAccessToken({
    clientId: "id",
    clientSecret: "secret",
    fetchImpl,
    now: 2_000
  });

  assert.equal(first, "safe-test-token");
  assert.equal(second, first);
  assert.equal(calls, 1);
});

test("starts at the newest reservation page and paginates backward to recent history", async () => {
  clearCachesForTests();
  const offsets = [];
  const recent = { start: "2026-09-25T10:00:00Z" };
  const old = { start: "2026-09-01T10:00:00Z" };

  const fetchImpl = async (input) => {
    const url = new URL(input);
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));
    if (limit === 1) {
      return new Response(JSON.stringify({ count: 1201, results: [old] }), { status: 200 });
    }

    offsets.push(offset);
    const results = offset === 1000 ? [recent] : [old];
    return new Response(JSON.stringify({ count: 1201, results }), { status: 200 });
  };

  const results = await fetchRelevantReservations({
    token: "token",
    fetchImpl,
    now: Date.parse("2026-09-24T12:00:00Z")
  });

  assert.deepEqual(offsets, [1000, 500]);
  assert.deepEqual(results, [recent, old]);
});
