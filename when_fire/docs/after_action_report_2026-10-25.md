# when fire: after action report

Sunday, October 25, 2026, written at the end of the rewrite day.  What was done, what exists now, where things stand.

## 1. In one breath

The rewrite is live.  The old system stopped taking facts at 8:24 AM Eastern, its schema was renamed and kept, and the new one took over at the same address with the same token.  Your connector, your web app and the shelf all work; the record was replayed from Tuesday, October 21 as if the new actors had been there; the first live cycle ran end to end on its own at 8:42 AM.  Nothing was asserted on your side.  The day's model spend was about two and a half dollars, nearly all of it the replay.

## 2. What was done, in order

Saturday evening the credo was rewritten as one essay and the brief grew the Saturday additions (reason as a node, the standing question, the nightly copy, the stubs, the client as pages, artistic license).

Sunday before six: a full copy of the old record and the shelf to the Mac and the copies bucket (whens, facts, fires, settings; sources, claims, embeddings).  The ledger tables of that copy are now on Drive too, in superhuman/store/copies/2026-10-25_before_rewrite.

Six to seven: the schema (twenty tables, every one owned and guarded by row level security), the doors (every read and write a function, owner first), the bus (two triggers and the Heartbeat), the seed, all built in a scratch schema named wf_next beside the live one, because the plan to build in a second Supabase project was not allowed by the harness.  The record and the shelf were carried into the scratch schema: 23 whens with their lineage, 28 facts, 8 stated bridges, 3 reasons with their because links, 61 sources, 1,867 claims with their embeddings.

Seven to eight: the Watch, the Reconciler with replay, the Thinker, the Doer and the Librarian, each a function sharing one library.  The replay was run three times.  The first two found the bugs (the Reconciler re-reading episodes forever because a stored watermark at millisecond grain never matched a microsecond fact time; the Watch looking at the record as of the episode's happened time instead of the moment the Reconciler woke; facts that land late outside any episode never finding a home; links the model returned as shortened ids being thrown away).  The third run walked twenty-three checkpoints from Tuesday to this morning in fifteen passes, wrote four day snapshots, eleven episode snapshots and nine when snapshots, and left no error notes.  Every snapshot was read for grading words and pronoun slips: none.

Eight to half past: the dev connector and the client.  Saturday's jump rope session (64 minutes, 390 calories by the Watch, 9:56 AM) was recorded through the new connector as said by health, which exercised the glance live: it linked the fact to jump rope, calories and minutes, bridged it to the rope when as its first session, and opened a standing question for the record about the seated calf raises.  The Librarian learned the credo as a source (52 claims) after its embedding work was spread over several requests, since one request's compute budget could not carry forty embeddings.  The Doer wrote a morning page and a full copy on request.

8:24 AM: cutover.  The old heartbeat and the scratch heartbeat were stopped; the old schema became when_fire_v1; the four migrations were applied to a fresh when_fire; every table was copied from the scratch schema in dependency order; the old public query doors were dropped; the new connector was deployed at the old name; the old listener and web door were replaced with stubs that answer gone; the client was pushed to GitHub Pages.

8:42 AM: the first live cycle, unprompted.  The Heartbeat raised quiet thirty minutes after the rope fact landed; the Reconciler closed the orphan episode of Saturday morning, the Watch read Saturday again (met for the rope when; silence for the calf raises after it), the day of October 24 was written again with the session in it, and the Thinker settled through the yes-and way (noticer, builder, gatherer, honesty, closer) and chose nothing, since the one question worth asking already stood.

## 3. What exists now

The database.  Schema when_fire: 29 whens (13 on your side, the rest the system's own), 20 world facts and 11 notes, 21 fires, 62 sources, 1,919 claims all embedded, 70 concepts (28 body parts, 24 movements, 8 measures, 3 reasons, 2 people, 1 place, 4 other), 196 links, 16 bridges, 15 episodes, 31 snapshots, 2 open questions, 1 open task (this morning's page, for you to read and mark done).  Beside it, when_fire_v1 untouched and wf_next as scratch.  Cron job when_fire.heartbeat every minute.

The functions.  watch (version 2), reconciler (9), thinker (3), doer (1), librarian (6), when-fire-mcp (4), copy (4), next-when-fire-mcp (1); listener (10) and when-fire-web (2) are stubs.

The client.  https://stacydraper.github.io/SuperHuman/ with five pages: Record, Whens, Thoughts, Questions, Settings.  It carries your key once from the address and keeps it.  The first load after the push may need one refresh if the old page was cached.

The documents, in this project and on the Mac under ~/superhuman/when_fire/docs/: the credo, the rewrite brief, the model document, the readme (with the Health Shortcut steps), the lexicon, this report.  The code on the Mac under ~/superhuman/when_fire/: migrations, functions, client, tools.  The first build is beside it at ~/superhuman/when_fire_v1/.

## 4. Where things stand

Two things wait on you.  The Thinker's question, on the Questions page: does Friday's leg day count as a hard calf day for the rope when, or only calf-specific work.  And this morning's page in the outbox.  A third is yours when you have a minute: the Health Shortcut, seven steps in the readme, so every workout lands as a fact with no typing.

One thing on your Claude: the connector's verb list changed (assert replaces affirm; answer, did, turbo and health are new).  A chat client that cached the old list will show the old verbs until it reconnects once.

Decisions I made alone, all reversible.  The day's cap for every actor together is 5.00 for today because the replay spent two dollars; it goes back to 3.00 tomorrow unless you say otherwise (the caps table, one row).  Turbo was switched off by hand after the glance set it for a day over the rope and leg day question; the glance may now set at most six hours.  The settle runs after every episode close and costs about a third of a dollar (five model calls); the Thinker's own cap of 1.50 a day holds it to four or five settles, after which it writes an error note and rests until the next day.  If that is too few, the cap is one number; if the settle is too eager, the noticer can be told to say nothing more often.  The copy door's run verb, which executed statements during the build, is still deployed; I will remove it as the last act of the day, after this report, so the only ways in are the doors.

Rough edges I know of.  The Watch read Saturday's rope session as a surprise against the rope when because the when asks for two full days since the last hard calf day and Friday was legs; that reading is defensible and the question it raised is the right one, but the when was asserted after the session it names, so the surprise is partly an artifact of order.  The cutover copied the fires table with the triggers live, which dispatched two glances on the rope fact instead of one; two near-twin thinker notes stand at 8:24 AM, and I left them, since the record is a witness to the cutover too.  The shared concepts were seeded by hand from the body and movement words we had; the shelf has not yet been walked to grow them.  The claude.ai connector cannot be refreshed from here.  The Mac worker's bus mode was not Sunday's work and was not done.

What the first week will tell us.  Whether thirty minutes is the right gap.  Whether the Watch's readings on whens with no window (met only at the day's close) feel right to you.  Whether the morning page as a task in the outbox is a page you read.  Whether the Thinker's questions reach you only when they must.  Whether three dollars a day is the right belt.

## 5. The numbers of the day

Model calls: 96, 2.51 dollars (Reconciler 1.28, Watch 0.63, Thinker 0.46, Librarian 0.14), nearly all in the three replays and the live tests.  Deploys: watch 2, reconciler 9, thinker 3, doer 1, librarian 2, connectors 2, stubs 2.  Lines written fresh: about 3,600 across the migrations, the library, the actors, the connector and the client.  Facts lost: none.  Facts asserted on your side: none.
