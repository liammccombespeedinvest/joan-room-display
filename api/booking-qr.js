import { timingSafeEqual } from "node:crypto";
import QRCode from "qrcode";
import { roomsFromEnvironment } from "../lib/rooms.js";

function safeEqual(left, right) {
  if (!left || !right) return false;
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });
  const bookingKey = process.env.BOOKING_KEY;
  if (!safeEqual(req.headers["x-booking-key"], bookingKey)) {
    return res.status(401).json({ error: "Not authorised" });
  }

  const roomKey = String(req.query.room || "").toLowerCase();
  const room = roomsFromEnvironment()[roomKey];
  if (!room?.id) return res.status(404).json({ error: "Unknown room" });

  const host = String(req.headers.host || "");
  if (!/^[a-z0-9.-]+(?::\d+)?$/i.test(host)) {
    return res.status(400).json({ error: "Invalid host" });
  }

  const protocol = host.startsWith("localhost:") ? "http" : "https";
  const bookingUrl = `${protocol}://${host}/book.html?room=${encodeURIComponent(roomKey)}#book=${encodeURIComponent(bookingKey)}`;

  try {
    const svg = await QRCode.toString(bookingUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 260,
      color: { dark: "#000000", light: "#ffffff" }
    });
    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    return res.status(200).send(svg);
  } catch (error) {
    console.error("QR generation failed", error);
    return res.status(500).json({ error: "QR code unavailable" });
  }
}
