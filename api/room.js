import { buildRoomStatus } from "../lib/room-status.js";
import { fetchRelevantReservations, getAccessToken } from "../lib/joan.js";

function roomsFromEnvironment() {
  return {
    lovelace: {
      id: 1350162,
      label: "Lovelace",
      joanName: "London-Percy House-Lovelace (6)"
    },
    turing: {
      id: process.env.JOAN_TURING_ROOM_ID || null,
      label: "Turing",
      joanName: "Add the exact Joan room name here"
    }
  };
}

function setCors(req, res) {
  const allowedOrigin = process.env.DISPLAY_ORIGIN?.replace(/\/$/, "");
  const requestOrigin = req.headers.origin?.replace(/\/$/, "");

  if (allowedOrigin && requestOrigin && requestOrigin !== allowedOrigin) return false;
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin || "*");
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return true;
}

export default async function handler(req, res) {
  if (!setCors(req, res)) return res.status(403).json({ error: "Origin not allowed" });
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const roomKey = String(req.query.room || "lovelace").toLowerCase();
  const room = roomsFromEnvironment()[roomKey];
  if (!room) return res.status(404).json({ error: "Unknown room" });
  if (!room.id) return res.status(503).json({ error: `${room.label} is not configured yet` });

  const clientId = process.env.JOAN_CLIENT_ID;
  const clientSecret = process.env.JOAN_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: "Server credentials are not configured" });
  }

  try {
    const now = new Date();
    const token = await getAccessToken({ clientId, clientSecret });
    const reservations = await fetchRelevantReservations({ token, now: now.getTime() });
    const payload = buildRoomStatus({ room, reservations, now });

    res.setHeader("Cache-Control", "public, max-age=0, s-maxage=30, stale-while-revalidate=30");
    return res.status(200).json(payload);
  } catch (error) {
    console.error("Room status update failed", error);
    return res.status(502).json({ error: "Live room status is temporarily unavailable" });
  }
}
