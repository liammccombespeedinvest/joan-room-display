import { timingSafeEqual } from "node:crypto";
import { bookingWindow, buildReservationPayload, hasConflict } from "../lib/booking.js";
import {
  createReservation,
  fetchRelevantReservations,
  fetchRoom,
  getAccessToken
} from "../lib/joan.js";
import { roomsFromEnvironment } from "../lib/rooms.js";

const recentAttempts = new Map();

function setCors(req, res) {
  const allowedOrigin = process.env.DISPLAY_ORIGIN?.replace(/\/$/, "");
  const requestOrigin = req.headers.origin?.replace(/\/$/, "");
  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Booking-Key");
  return true;
}

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestBody(req) {
  if (typeof req.body === "string") return JSON.parse(req.body);
  return req.body || {};
}

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  if (!safeEqual(req.headers["x-booking-key"], process.env.BOOKING_KEY)) {
    return res.status(401).json({ error: "Booking is not authorised" });
  }

  let body;
  try {
    body = requestBody(req);
  } catch {
    return res.status(400).json({ error: "Invalid request" });
  }

  const roomKey = String(body.room || "").toLowerCase();
  const room = roomsFromEnvironment()[roomKey];
  if (!room) return res.status(404).json({ error: "Unknown room" });
  if (!room.id) return res.status(503).json({ error: `${room.label} is not configured yet` });

  const clientId = process.env.JOAN_CLIENT_ID;
  const clientSecret = process.env.JOAN_CLIENT_SECRET;
  const organizerEmail = process.env.JOAN_BOOKING_ORGANIZER_EMAIL;
  if (!clientId || !clientSecret || !organizerEmail || !process.env.BOOKING_KEY) {
    return res.status(503).json({ error: "Walk-up booking is not configured" });
  }

  let window;
  try {
    window = bookingWindow(new Date(), body.duration);
  } catch {
    return res.status(400).json({ error: "Choose a 15 or 30 minute booking" });
  }

  const lastAttempt = recentAttempts.get(roomKey) || 0;
  if (Date.now() - lastAttempt < 10_000) {
    return res.status(429).json({ error: "Please wait before trying again" });
  }
  recentAttempts.set(roomKey, Date.now());

  try {
    const token = await getAccessToken({ clientId, clientSecret });
    const reservations = await fetchRelevantReservations({
      token,
      now: Date.now(),
      fresh: true
    });

    if (hasConflict({
      reservations,
      roomId: room.id,
      start: window.start,
      end: window.end
    })) {
      return res.status(409).json({ error: "The room is no longer free for that duration" });
    }

    const joanRoom = await fetchRoom({ token, roomId: room.id });
    if (!joanRoom.key) throw new Error("Joan room has no calendar address");

    const payload = buildReservationPayload({
      roomCalendarEmail: joanRoom.key,
      organizerEmail,
      start: window.start,
      end: window.end
    });
    const created = await createReservation({ token, payload });

    res.setHeader("Cache-Control", "no-store");
    return res.status(201).json({
      booked: true,
      id: created.id,
      title: "Walk-up meeting",
      start: window.start.toISOString(),
      end: window.end.toISOString()
    });
  } catch (error) {
    recentAttempts.delete(roomKey);
    console.error("Walk-up booking failed", error);
    return res.status(502).json({ error: "The room could not be booked" });
  }
}
