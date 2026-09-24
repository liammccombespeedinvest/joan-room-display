import test from "node:test";
import assert from "node:assert/strict";
import { buildRoomStatus, organizerName } from "../lib/room-status.js";

const room = { id: 1350162, label: "Lovelace" };
const reservation = (overrides = {}) => ({
  room: { id: 1350162 },
  start: "2026-09-25T10:00:00Z",
  end: "2026-09-25T11:00:00Z",
  title: "Investment Committee",
  visibility: "public",
  organizer: { external: { email: "claudia.naue@speedinvest.com" } },
  ...overrides
});

test("derives a friendly internal organizer name without returning an email", () => {
  assert.equal(organizerName("claudia.naue@speedinvest.com"), "Claudia Naue");
  assert.equal(organizerName("external@example.com"), undefined);
  assert.equal(organizerName("office@speedinvest.com"), undefined);
});

test("shows free until the next London-time booking", () => {
  const result = buildRoomStatus({
    room,
    reservations: [reservation()],
    now: new Date("2026-09-25T09:30:00Z")
  });

  assert.deepEqual(result, {
    room: "Lovelace",
    status: "free",
    until: "11:00",
    next: {
      title: "Investment Committee",
      organizer: "Claudia Naue",
      start: "11:00",
      end: "12:00"
    },
    updatedAt: "2026-09-25T09:30:00.000Z"
  });
});

test("shows busy until the current reservation ends and exposes the following meeting", () => {
  const following = reservation({
    start: "2026-09-25T11:30:00Z",
    end: "2026-09-25T12:00:00Z",
    title: "Partner meeting"
  });
  const result = buildRoomStatus({
    room,
    reservations: [reservation(), following],
    now: new Date("2026-09-25T10:30:00Z")
  });

  assert.equal(result.status, "busy");
  assert.equal(result.until, "12:00");
  assert.equal(result.next.title, "Partner meeting");
  assert.equal(result.next.start, "12:30");
});

test("redacts private meeting title and organizer", () => {
  const result = buildRoomStatus({
    room,
    reservations: [reservation({ visibility: "private", title: "Secret plan" })],
    now: new Date("2026-09-25T09:30:00Z")
  });

  assert.deepEqual(result.next, {
    title: "Private meeting",
    start: "11:00",
    end: "12:00"
  });
});

test("reports free for the rest of the day when only tomorrow has bookings", () => {
  const result = buildRoomStatus({
    room,
    reservations: [reservation({
      start: "2026-09-26T10:00:00Z",
      end: "2026-09-26T11:00:00Z"
    })],
    now: new Date("2026-09-25T13:00:00Z")
  });

  assert.equal(result.status, "free");
  assert.equal(result.until, null);
  assert.equal(result.next, null);
});
