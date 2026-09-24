import { TIME_ZONE } from "./room-status.js";

export const ALLOWED_DURATIONS = Object.freeze([15, 30]);

export function bookingWindow(now, durationMinutes) {
  const duration = Number(durationMinutes);
  if (!ALLOWED_DURATIONS.includes(duration)) {
    throw new Error("Unsupported booking duration");
  }

  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  const startMs = Math.ceil(nowMs / 60_000) * 60_000;
  return {
    start: new Date(startMs),
    end: new Date(startMs + duration * 60_000)
  };
}

export function hasConflict({ reservations, roomId, start, end }) {
  const startMs = start.getTime();
  const endMs = end.getTime();

  return reservations.some((item) => {
    if (Number(item?.room?.id) !== Number(roomId)) return false;
    if (item.declined === true || String(item.status).toLowerCase() === "cancelled") return false;
    const itemStart = Date.parse(item.start);
    const itemEnd = Date.parse(item.end);
    return Number.isFinite(itemStart) && Number.isFinite(itemEnd)
      && itemStart < endMs && itemEnd > startMs;
  });
}

export function buildReservationPayload({ roomId, roomCalendarEmail, organizerEmail, start, end }) {
  return {
    room_id: Number(roomId),
    title: "Walk-up meeting",
    start: start.toISOString(),
    end: end.toISOString(),
    tz: TIME_ZONE,
    visibility: "public",
    send_notification_to_attendees: false,
    send_notification_to_organizer: false,
    is_all_day: false,
    description: "Booked from the room display",
    attendees: [roomCalendarEmail],
    organizer_email: organizerEmail,
    recurring: null,
    status: "confirmed"
  };
}
