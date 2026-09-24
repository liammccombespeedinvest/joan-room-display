# Joan 6 live room display

This project keeps Joan credentials in a Vercel serverless function and gives the display only a small, privacy-filtered JSON response. It is ready for Lovelace; Turing is wired in but needs its Joan room ID.

## What is included

- `api/room.js` — public read-only display endpoint.
- `lib/joan.js` — OAuth token cache and backward pagination over Joan's oldest-first reservation feed.
- `lib/room-status.js` — Europe/London status logic, organizer-name conversion, and privacy filtering.
- `public/index.html` — monochrome, e-ink-friendly Joan pane.
- `test/room-status.test.js` — tests for BST conversion, busy/free states, organizer handling, and privacy.

The browser never receives the Joan token, client ID, client secret, raw organizer email, room calendar key, attendees, or the full reservation object.

## Deploy the backend to Vercel

1. Put these files in a **private or public GitHub repository**. Do not create a real `.env` file in the repository.
2. In Vercel, choose **Add New → Project**, import the repository, and deploy it as-is. No framework preset is required.
3. In **Project Settings → Environment Variables**, add:
   - `JOAN_CLIENT_ID`
   - `JOAN_CLIENT_SECRET`
   - `DISPLAY_ORIGIN` = the origin of the GitHub Pages site, for example `https://yourname.github.io`
   - later, `JOAN_TURING_ROOM_ID` when known
4. Redeploy after adding the variables.
5. Test `https://YOUR-VERCEL-PROJECT.vercel.app/api/room?room=lovelace`. It should return only the small display payload.

Vercel encrypts environment variables and injects them only into the serverless function. Never paste either Joan credential into `index.html`, GitHub Actions, a URL, or this repository.

## Update the GitHub Pages frontend

1. Open `public/index.html`.
2. Replace `https://YOUR-VERCEL-PROJECT.vercel.app` with the real Vercel project URL.
3. Upload that file to the existing GitHub Pages repository as `index.html`.
4. Keep the current Joan URL for Lovelace, or add a cache-busting query such as `?room=lovelace&v=3`.

For Turing, use the same page with `?room=turing`. It will start working after `JOAN_TURING_ROOM_ID` is set in Vercel.

## Organizer overrides

Normal `firstname.lastname@speedinvest.com` addresses become `First Last`. For an unusual internal address, add a server-side entry to `ORGANIZER_OVERRIDES` in `lib/room-status.js`, for example:

```js
export const ORGANIZER_OVERRIDES = Object.freeze({
  "office@speedinvest.com": "Office Team"
});
```

The raw address is never placed in the response.

## Local checks

Run `npm test`. To run the complete site locally, install the Vercel CLI and run `vercel dev`; create a local `.env` only on your own machine if live Joan testing is required.

## Public-data note

The credentials are secret, but the display endpoint is intentionally public so an unattended Joan and a public GitHub Pages site can read it. `DISPLAY_ORIGIN` limits normal browser cross-origin access, but CORS is not authentication. Meeting titles and derived organizer names in the returned payload should therefore be treated as publicly readable. Private meetings are always returned as `Private meeting` with no organizer.
