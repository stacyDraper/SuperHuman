# when_fire_web, in the SuperHuman repository

The web client for when fire: the ledger on a screen, and a "did it" that writes a fact.  A stepping stone toward the real app; a little clumsy is the price of rapid development.  Named October 22, 2026.

## What it is

One page, no build step, no framework.  `docs/` is the whole site:

- `index.html`, `styles.css`, `app.js`: the page.  Today's ledger (fires and facts), what's live (whens grouped by bundle, each of the person's with a "Did it" button), a free "record something" form, and last night's reconciliation.
- `sw.js`: the service worker.  Keeps the shell available offline and is where a push will land in phase 3.
- `manifest.webmanifest`, `icon-512.png`: so it installs to the Home Screen.

It talks to the core through the when fire connector, the same five verbs any AI uses, and nothing else.  The connector's address is a meta tag in `index.html`; the key is given once, on the address (`?token=...`) or pasted into the first-run field, and kept in the browser's storage.  The page itself holds no secret.

## Where it runs

Static hosting over HTTPS.  GitHub Pages from the `docs/` folder of the SuperHuman repository: https://stacydraper.github.io/SuperHuman/

Why not inside the Supabase project: Supabase serves any HTML coming out of an edge function as plain text, sandboxed, on the supabase.co domain (an anti-phishing rule).  Scripts and styles come through fine, the page does not.  A custom domain on the project lifts that, and is the route for "the app ships inside the database" later.

## Phases

1. Read and capture.  This.
2. Talk: a session pane on a converse function, so affirm and the yes button live here.
3. Initiate: a converse handler that opens or continues a session when a fire lands, and a push.  The morning calm is the first session it opens.  The red light for the heartbeat.
4. The fat client, when the pattern is known.

## Testing without writing

`tools/` is gone with the function; the test bench lives in the build session: a local server that serves `docs/`, proxies reads to the real connector, and answers `record` calls without forwarding them, driven by headless Chromium.  Nothing in the ledger is written by a test.
