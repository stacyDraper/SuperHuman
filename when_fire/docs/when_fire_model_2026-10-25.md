# when fire: the model

Sunday, October 25, 2026.  What the system is made of, after the rewrite.  Written for Stacy, who does not need the code lines, and for the next session, which does.

## 1. One sentence

when fire is a person's record of what he said he would do (whens) and what happened (facts), with fires for the moments a when came true, kept by a small set of actors that read the record, write what stands, and never grade.

## 2. The things

Every thing in the record belongs to an owner, a row in people.  The system is one person too, with its own id, and owns the shared concepts and relation words.  Nothing is edited or deleted; a change is a new row that points at the old one.

A when is an intention put on the record in the person's words.  It carries the words, the condition in words (when it is due, as spoken), an optional machine condition for the crisp kinds, a horizon in words and an optional horizon time, who asserted it and when, the bundle it belongs to, the when it comes after (supersedes), and a free shape for anything else worth keeping.  Its kind is read from the machine condition: tick (a clock), after (a fact landing), quiet (the record gone still), on (another fire), or worded (no machine condition; the Watch reads it).  The person's whens are signed with his name; the system's own whens are signed by their actor (watch, reconciler, thinker, doer) and carry a handler, the actor the fire is sent to.

A fact is what happened, in the words of whoever said it.  Two times: happened_at, when it happened, and recorded_at, when it was entered.  Late facts are welcome; the time a thing happened leads, the time it was entered is a footnote.  A fact has said_by (the person, a device such as health, or an actor), a kind (world, from outside the system, or note, the system's own words), an optional about (the when the person named), an optional corrects (an earlier fact it corrects), and an optional cites (a source such as a picture).  The system's notes are never evidence that the person did a thing.

A fire is a moment: a when came due or came true.  Kinds: tick (a clock struck), land (a fact landed), quiet (the record went still), heard (another fire woke a listener), met (a fact shows the when's words were done), silence (the window passed with nothing recorded).  Fires carry who raised them, the fact or fire that caused them, and a context (the day the reading belongs to, the reason in one sentence, whether it was late).

A source is a document, a picture or a recording the shelf keeps whole.  A claim is one sentence the Librarian read out of a source, with a few words naming its subject and an embedding for search by meaning.  The shelf is the sources and their claims.

A concept is a node of the graph: a body part, a movement, a measure, a reason, a person, a place, a goal, a document, a substance, a condition, or other.  Concepts have an owner (the system's are shared by everyone; a person's are his own), a kind and a name; the same name and kind for the same owner is one concept, and a concept may supersede another when two are found to be one.

A link joins a thing to a concept with a relation word: a fact is about a concept, a when is because of a reason, a dip is a kind of push, calves are part of legs, a movement works a body part, one movement opposes another, two concepts are the same as each other, a thing cites a source.  The relation words are a table, each with its inverse; a link is admitted only if its word is on the list.  A link may be negated by a later link rather than deleted.

A reason is a concept of kind reason.  Many whens may point at one reason with because; one when may point at several.  That is how "find everything I do because of the gift" is a walk, not a search.

A bridge joins a fact to a when it counts toward, with an optional amount (reps, calories, minutes, sessions) and a line saying why.  Bridges are made by the person (stated), by the glance, by the Watch when it reads met, and by the Reconciler when it links an episode.  A tally over a when's bridges gives the count the facts show.  A when and all the whens it comes after form a lineage; a fact about any wording in the lineage counts for the current one.

An episode is a stretch of facts with no gap of thirty minutes between them (by happened time), closed when the record has been quiet; a day is the episode of a local day, closed at four in the morning.  A snapshot is what stands about a subject (a when, an episode, a day) as of a watermark, the time of the last fact it saw; a later snapshot replaces an earlier one and the view current_snapshots shows only the latest.  Snapshots are prose written by the Reconciler: the asserted beside the recorded, in order, with ids cited, no grade.

A question is a standing thing the Thinker wants to know.  It carries where the Thinker is looking now (ask_of: shelf, record, health, facts, person) and stays open until an event answers or drops it.  The person is asked last.

A task is a line in the outbox: something for the Doer or the session to do, with events (requested, taken, done, error, dropped).  The morning page and the nightly copy land here.

A cost is a footnote on every model call: actor, model, tokens in, out, thinking and cached, dollars, seconds, the fire that caused it, a note.  Caps are the seatbelts: dollars per day for every actor together and for the Thinker alone, tokens per settle, whens per look.

Settings are per owner: the model, the workspace the key bills to, the hours actors may think, the gap that closes an episode, the hour that closes a day, the prices per million tokens, turbo.

## 3. The actors

The Heartbeat runs once a minute inside the database.  It computes the crisp conditions: a tick when a clock condition comes due (at a time of day, on given days or dates, once per local day; or every N minutes within given hours, every turbo_every while turbo is on), and a quiet fire when the latest world fact is N minutes old and the quiet when has not fired since it landed.  The Heartbeat raises fires; it does nothing else.

The bus is two triggers.  When a fire lands, the bus posts it to the handler the when names (watch, reconciler, thinker, doer, librarian) at that actor's address, with the fire, the owner, the when, the kind and the schema, and wakes any when of kind on that listens for it, to a depth of five.  When a world fact lands, the bus raises land on every when of kind after that is listening for the world (or for a given sayer).  The bus waits up to a hundred and fifty seconds for an actor's answer and keeps the answer in its own table.

The Watch reads the person's worded and ticking whens against the record and gives each one a reading for each day it is asked about: met (facts show it was done in the window the when names; the facts are named and bridged), silence (the window has clearly closed with nothing recorded), open (the window has not closed or the condition has not come up), or met later (done after an earlier silence).  A when that names no window of its own has the whole day and reads open until the day closes at four the next morning.  Never a second silence for the same when and day; a met after a silence is late.  The Watch runs on its own poll (every three hours between six and eleven, every thirty minutes while turbo is on), at every episode close, and at the day's close.

The Reconciler closes episodes and days.  At an episode close (the quiet fire): every world fact that belongs to no closed episode is segmented by happened time; each segment whose gap has passed becomes an episode; for each, the Watch reads the episode's days and today, the facts the glance did not link are linked to concepts and bridged to whens, and one snapshot is written per stale when (a when is stale when a fact in its lineage or bridged to it was recorded after its current snapshot's watermark) and one for the episode.  A fact that lands late inside a closed episode's span makes that episode stale and it is written again, with the Watch looking again at those days.  A closed day whose record changed is closed again, so the corrected words stand.  Then the Thinker is asked to settle.  At the day close (four in the morning): the Watch reads the day one last time, then one snapshot of the day with the health line and the day's cost.  In replay mode the Reconciler walks the record from a date as if it had been there: at every moment it would have woken (the gap after each fact was recorded, and each day's close) it closes what had closed by then, seeing only what had been recorded by then; a cursor remembers how far it got.

The Thinker has one socket and two speeds.  The glance runs when a fact from the world lands: one model call that links the fact's concepts, says which whens it counts toward (with amounts), marks it expected, surprise or question, answers an open question if the fact does, opens a question if one is worth standing, writes a note only when the fact surprises or asks, and may turn turbo on for a few hours (at most six).  It reads any picture the fact cites.  The settle runs after an episode closes, within the thinking hours: a way runs, seats in order, each a model call that sees the transcript so far, then the navigator chooses the way forward: a conclusion (a note), a question (a standing thing, asked of the shelf, the record, Health or the person), a proposition for a calm moment (a note and a task), a commitment (a when on the Thinker's side), or nothing.  Ways are data: yes-and ships first (noticer, builder, gatherer, honesty), and the court (facilitator, proposer, challenger, honesty) is the second; a setting may override them.  Standing questions asked of the shelf are tried on the shelf before the way sits.

The Doer acts from the outbox and has two hands of its own: the morning page at half past five (today's whens in the person's words, last night's day snapshot, the questions only the person can answer, written as a task of kind morning_page) and the copy at three in the morning (every table of the schema to the private copies bucket, dated, with a task of kind carry asking the session to carry the record's tables to Drive).

The Librarian keeps the shelf.  Learn keeps a document whole as a source, reads it with the model in chunks, writes one claim per sentence it says, and fills the embeddings a few at a time by posting to itself (the embedder is heavy on the worker's compute budget).  The same origin and title handed in again reuses the source and adds only what is missing.  Ask returns the current claims that bear on a question, by words and by meaning, with their sources.  Media stores a picture, a recording or any file in the private sources bucket and records it as a source a fact may cite; the kind (picture, recording, file) is read from the media type.

The connector is the one door for people and models: a Model Context Protocol server, stateless, locked by a token on its address that names the owner.  Verbs: read, assert, record, propose, raise, ask, learn, answer, did, turbo, health.  The web client speaks the same verbs.  The connector holds no state and no judgment; everything goes through the database's doors.

## 4. The doors

Every write and every read goes through a function in the when_fire schema, owner first: record, assert, raise, concept, link, bridge, snap, question, question_event, task, task_event, cost, read, health, ask, tally, lineage, under (walk down the graph), about_concept (everything to do with a concept and what is under it), because_of (everything done because of a reason).  The actors reach the database directly as its owner, through those doors; the connector finds the owner through owner_for_token.  Every table has row level security on from the first migration, with one select policy for a signed-in person over his own rows, for the client that will one day read the database itself.

## 5. Time

Times are stored as instants.  Every actor sees local time in the owner's zone, written out ("Sat Oct 24, 8:00 AM"), never a raw universal time.  The day closes at four in the morning local time, so a late evening belongs to its day.  The driver hands back milliseconds and the database keeps microseconds, so every comparison of a stored watermark against a stored time is made at the millisecond grain.

## 6. The model calls

Sonnet 5.5, thinking left on.  Every ceiling is room, not a target; a reply cut off at its ceiling is tried once more with twice the room, then fails loudly.  Replies that write into the record are shaped on the model's side (a schema the reply must fit).  The stable part of every prompt (the credo and the actor's standing instructions) is marked for caching.  Every call writes its cost footnote.  Before an actor thinks, the seatbelt checks the day's spend against the caps.  Ids that come back as a prefix are matched against what was shown, never invented.

## 7. The credo, in code

The credo is the first paragraph of every actor's prompt: the record is a witness, not a judge; the word for nothing recorded is silence; never failed, missed, good, bad, success or should about the person; describe, do not evaluate; the person's words outrank any retelling; what the person said and what was inferred are kept apart; the time a thing happened leads; the system's own notes are never evidence; cite ids.  The Watch's readings are descriptions of the record; the Reconciler's snapshots are the asserted beside the recorded; the Thinker's honesty seat strikes any grade that slipped through.

## 8. Copies

The record is copied three ways.  The Doer's nightly copy at three in the morning writes every table to the private copies bucket, dated by schema and day, and asks the session to carry the record's tables to Drive.  The copy door (verbs out and in) exports and reloads any table of a named schema, with the shared secret.  The old schema stands beside the new one as when_fire_v1, unchanged, until Stacy says drop.
