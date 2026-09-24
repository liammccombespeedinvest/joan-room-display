export function roomsFromEnvironment() {
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
