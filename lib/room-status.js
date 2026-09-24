export const TIME_ZONE = "Europe/London";

// Add exceptional internal addresses here. Keys are kept only on the server.
// Example: "office@speedinvest.com": "Office Team"
export const ORGANIZER_OVERRIDES = Object.freeze({});

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
});

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

function titleCasePart(value) {
  return value
    .split(/([-'])/)
    .map((part) => (part === "-" || part === "'")
      ? part
      : part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join("");
}

export function organizerName(email, overrides = ORGANIZER_OVERRIDES) {
  if (typeof email !== "string") return undefined;

  const normalized = email.trim().toLowerCase();
  if (overrides[normalized]) return overrides[normalized];

  const match = normalized.match(/^([a-z][a-z'-]*)\.([a-z][a-z'-]*)@speedinvest\.com$/i);
  if (!match) return undefined;

  return `${titleCasePart(match[1])} ${titleCasePart(match[2])}`;
}

export function isPrivate(reservation) {
  return String(reservation?.visibility || "").toLowerCase() === "private";
}

function localDateKey(date) {
  const parts = dateFormatter.formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function publicMeeting(reservation) {
  const privateMeeting = isPrivate(reservation);
  const meeting = {
    title: privateMeeting ? "Private meeting" : (reservation.title?.trim() || "Reserved"),
    start: timeFormatter.format(new Date(reservation.start)),
    end: timeFormatter.format(new Date(reservation.end))
  };

  if (!privateMeeting) {
    const email = reservation.organizer?.external?.email;
    const organizer = organizerName(email);
    if (organizer) meeting.organizer = organizer;
  }

  return meeting;
}

export function buildRoomStatus({ room, reservations, now = new Date() }) {
  const nowMs = now.getTime();
  const today = localDateKey(now);

  const valid = reservations
    .filter((item) => Number(item?.room?.id) === Number(room.id))
    .filter((item) => Number.isFinite(Date.parse(item.start)) && Number.isFinite(Date.parse(item.end)))
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));

  const current = valid
    .filter((item) => Date.parse(item.start) <= nowMs && nowMs < Date.parse(item.end))
    .sort((a, b) => Date.parse(a.end) - Date.parse(b.end))[0];

  const next = valid.find((item) =>
    Date.parse(item.start) > nowMs && localDateKey(new Date(item.start)) === today
  );

  const payload = {
    room: room.label,
    status: current ? "busy" : "free",
    until: current
      ? timeFormatter.format(new Date(current.end))
      : next
        ? timeFormatter.format(new Date(next.start))
        : null,
    current: current ? publicMeeting(current) : null,
    next: next ? publicMeeting(next) : null,
    updatedAt: now.toISOString()
  };

  return payload;
}
