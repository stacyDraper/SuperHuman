# when fire: the readme

Sunday, October 25, 2026.  Where everything lives and how it is run.  The model document says what the parts are; this says where they are and which knobs turn.

## 1. Where things live

The database: the Supabase project called Superhuman, reference xmdrzegrkjdeibvxihih.  The live schema is when_fire.  Beside it stand when_fire_v1 (the first build's schema, renamed on cutover day, untouched, its heartbeat stopped) and wf_next (the scratch copy the rewrite was built and replayed in; its heartbeat is stopped; it can be dropped at any time).  Two private storage buckets: sources (pictures and recordings the Librarian keeps) and copies (the Doer's nightly copy).

The functions, each a Supabase edge function at https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/<name>: watch, reconciler, thinker, doer, librarian (the actors, locked by the shared secret in the header x-when-fire-secret); when-fire-mcp (the connector, locked by the token on its address); copy (the copy door, locked by x-copy-secret); next-when-fire-mcp (the same connector code, kept for scratch work, pointed at a scratch schema with ?schema=); listener and when-fire-web (the first build's doors, now stubs that answer gone).

The code: on the Mac at ~/superhuman/when_fire/ (migrations, functions, client, docs, tools), and in this project under claude/.  The first build is beside it at ~/superhuman/when_fire_v1/.  The client's pages are also the docs/ folder of the repository stacyDraper/SuperHuman, which GitHub Pages serves at https://stacydraper.github.io/SuperHuman/.

The secrets, in the database vault: when_fire_model_key (the model key), when_fire_listener_secret (the actors' shared secret), when_fire_mcp_token (the person's token; its hash is in people.token_hash).  The functions read the vault over their direct database connection; nothing is exposed through the public query layer.

## 2. The migrations

Four files, applied in order, name the when_fire schema: 001_when_fire_tables.sql (every table, index and view, with row level security on), 002_when_fire_doors.sql (every function an actor calls), 003_when_fire_bus.sql (the triggers, the heartbeat, and the cron job when_fire.heartbeat that runs it every minute), 004_when_fire_seed.sql (the system person, Stacy, settings, caps, relation words, handlers, the shared concepts, and the system's own whens).  To build a scratch copy, substitute the word when_fire with another schema name across the files and apply them; the actors serve any schema named in the dispatch body if it is on the short list in lib.ts.  On cutover day the seed was not run against when_fire; every row came from the scratch schema by a straight copy, table by table in dependency order.

## 3. The actors' code

One shared file, lib.ts, is bundled into every actor: the database connection, the doors as functions, local time, the shelf's embed and ask, the model call with its cost footnote and cut-off rule, the seatbelt, the credo, and the text forms of whens, facts and fires that every prompt uses.  watch.ts is shared by the Watch's door and the Reconciler.  Each actor's folder holds its index.ts.  Deploying an actor means deploying its index.ts with lib.ts (and watch.ts where imported) as one function; the files are type checked with Deno before each deploy.

## 4. Running it

The heartbeat runs on its own.  Nothing needs starting.  To see the system's state, call the connector's health verb (or open Settings in the client): the heartbeat's last run, the last world fact, fires and notes in the last day, actor errors, the day's spend, open questions and tasks.

Turbo: the connector's turbo verb (or the Settings page) sets turbo_until so the Watch polls every thirty minutes until then; zero turns it off.  The Thinker's glance may set it for up to six hours on its own.

Caps, in the caps table per owner: daily_dollars for every actor together (3.00 is the standing number; it was set to 5.00 for October 25 because the replay spent two dollars that day), daily_dollars for the thinker alone (1.50), max_tokens per settle (80,000), max_rounds (2), max_whens per look (40).  When a cap is reached the actor writes an error note and does nothing more that day.

Settings, in the settings table per owner: model (claude-sonnet-5-5), model_workspace_id, hours (06-23), gap_minutes (30), day_close (04:00), turbo_every (30), turbo_until, max_depth (5), price_in_per_m, price_out_per_m, price_cached_per_m (3, 15, 0.30), thinker_way (yes-and), thinker_ways (an override, as data).

Replay: post to the reconciler with the secret, {"mode": "replay", "owner": ..., "since": "YYYY-MM-DD", "steps": 1, "schema": ...} and loop while more is true (the tool replay_loop.py does this).  Clear the derived rows first if the replay is to start clean (the tool clean_derived.sql shows which rows are derived).  Relink: {"mode": "link", "owner": ..., "facts": [ids]} links and bridges facts again and returns the model's reply.

Copies: the Doer copies every table to the copies bucket at three each morning.  The copy door's out verb exports a table of a named schema and its in verb reloads rows; the tool wf.py wraps both (wf.py out <schema> <table> <file>; wf.py in <schema> <table> <file>).  The copy door's run verb executed arbitrary statements during the build and is to be removed; see the after action report.

## 5. The connector

Address: https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/when-fire-mcp?token=<the token>.  Any model client that speaks the Model Context Protocol over a plain post can plug in.  The verbs: read (the record: active whens with reasons, facts since a time, readings, what stands, open questions and tasks), assert (a bundle and its whens with the reason), record (a fact, with happened_at when it was not now, and an optional picture), propose (a when that comes after another), raise (a reading by hand), ask (the shelf), learn (hand the Librarian a source), answer (answer an open question in the person's words), did (mark a task done), turbo, health.  The instructions the connector hands every model client carry the credo.  A client of the first build that cached the old verb list (read, affirm, record, propose, raise, ask, learn) needs to reconnect once to see the new list.

## 6. The client

https://stacydraper.github.io/SuperHuman/ with ?token=<the token> on the first visit; the key is kept in the browser after that.  Five pages, one bar: Record (the box, the happened time with a Now button, an optional about, a picture, and the recent log below), Whens (what stands, grouped by bundle, with the latest reading beside each), Thoughts (snapshots of days, episodes and whens, and the Thinker's notes on request), Questions (what is asked of the person, with an answer box; what the Thinker is still looking into; the outbox with the morning page), Settings (health, turbo, the door, the key).  Entries written with no connection are kept on the phone and sent when it returns.  On an iPhone, Share, then Add to Home Screen, makes it an app.  The pages are built from one template by client/build_pages.py so the head and the bar stay the same everywhere.

## 7. The Health Shortcut (for Stacy to set up)

The wrist as a witness: every workout becomes a fact with no typing, and the Watch reads met from it.  In the Shortcuts app on the phone:

1. New Automation: When a workout ends (Personal Automation, Apple Watch Workout, Ends, any type).  Run immediately, without asking.
2. Add the action Find Workouts, filtered to the most recent one, limit 1.
3. Add Get Details of Workout for the workout type, the duration (in minutes), the active energy (in calories) and the start date.
4. Add Text, with the words of the fact, for example: "[Workout Type], [Duration] minutes, [Active Energy] calories, from the Watch."
5. Add Format Date on the start date, custom format yyyy-MM-dd'T'HH:mm:ssZZZZZ, so the happened time travels with its offset.
6. Add Get Contents of URL: the address above (with the token), method POST, header Content-Type application/json, request body as JSON text:
   {"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "record", "arguments": {"said": "[the Text]", "said_by": "health", "happened_at": "[the formatted date]", "shape": {"via": "health shortcut"}}}}
7. Save.  The first run asks once for permission to read Health; allow it.

That is the whole stub.  When a fuller client exists the same post moves inside it.

## 8. Operations in a few lines

A fact entered with the wrong time is corrected by recording a new fact with corrects pointing at the old one; the Reconciler lets the corrected words stand and notes the correction once.  A when whose words changed is proposed anew with supersedes pointing at the old one; facts about either count for the current wording.  A reading the Watch got wrong can be answered by hand with raise (met or silence for a day).  A question that reached the person is answered through the client or the connector; the answer is recorded as a fact and the question closes.  When something looks off, read the error notes (facts with said_by starting error:) and the health verb before anything else.
