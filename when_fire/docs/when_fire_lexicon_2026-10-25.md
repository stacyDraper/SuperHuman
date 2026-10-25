# when fire: the lexicon

Sunday, October 25, 2026.  The words, as they stand after the rewrite.  One word per thing; the type and the instance share it.  Kinds live in a kind column, never in the name.  Actors are proper nouns and are capitalized in prose (the Watch); things are kinds with many instances and stay lowercase (a when).  In code every identifier is lowercase snake_case.  The system's name, when fire, stays lowercase.

## Things

- **when**: an intention put on the record in the person's words, with the condition under which it is due.  Kinds, read from the machine condition: tick (a clock), after (a fact landing), quiet (the record gone still), on (another fire), worded (no machine condition; the Watch reads it).  The person's whens are signed with his name; the system's with the actor's.
- **fact**: what happened, in the words of whoever said it, with two times.  Kinds: world (from outside the system) and note (the system's own words, never evidence).
- **fire**: a when coming true or coming due.  Kinds: tick, land, quiet, heard, met, silence.
- **reading**: what the Watch says the record shows for a when on a day: met, silence, open, or met later.  A description, never a verdict.
- **silence**: the word for nothing recorded where a when's window has passed.  The only word; never missed.
- **late**: a met reading that came after a silence for the same day, or a fact recorded after the episode it belongs to closed.
- **bundle**: whens that belong together; the head when is the bundle itself.
- **lineage**: a when and every wording it comes after; facts about any of them count for the current one.
- **supersedes**: the relation from a new wording to the one it comes after.  Nothing is edited; the chain notes that one came after another.
- **reason**: why a thing is asserted or done, in the person's words.  A concept of kind reason, pointed at by many whens with because.
- **concept**: a node of the graph: body part, movement, measure, reason, person, place, goal, document, substance, condition, other.  Shared (the system's) or owned (a person's).
- **link**: a named relation from a thing (a fact, a when, a concept, a claim, a source, a question) to a concept.
- **relation**: a word a link may use, with its inverse: about, because, cites, kind_of, opposes, part_of, same_as, works.  A table, not a list in code.
- **walk**: a recursive query over the links: under (down through part_of and kind_of), about_concept (everything to do with a concept), because_of (everything done because of a reason).
- **bridge**: a fact counted toward a when, with an amount when the when counts a number, and a line saying why.  Made by the person (stated), the glance, the Watch, or the Reconciler.
- **tally**: the count a when's bridges add up to, over a window or over all.
- **episode**: a stretch of facts with no gap between them by happened time, closed when the record has been quiet for the gap.
- **gap**: the quiet that closes an episode; thirty minutes.
- **day**: the episode of a local day, closed at four the next morning.
- **snapshot**: what stands about a subject (a when, an episode, a day) as of a watermark, in prose, replacing an earlier snapshot.  Current is derived, not stored.
- **watermark**: the recorded time up to which a snapshot is complete; the time of the last fact it saw.
- **stale**: a subject whose record has a fact recorded after its snapshot's watermark.  Stale subjects are written again at the next close.
- **source**: a document, picture or recording kept whole on the shelf.
- **claim**: one sentence a source says, with a few words naming its subject and an embedding.
- **shelf**: the sources and their claims.
- **question**: something the Thinker wants to know; a standing thing.  ask_of says where it is looking now: shelf, record, health, facts, person.  Open until an event answers or drops it.
- **thought**: a note the Thinker wrote: a glance, a conclusion, a question, a proposition, a commitment.
- **task**: a line in the outbox, with its events: requested, taken, done, error, dropped.  Kinds so far: morning_page, copy, carry, question, proposition.
- **outbox**: the open tasks.
- **cost**: the footnote on a model call.
- **handler**: the actor a fire is sent to, by name; the handlers table holds each one's address.

## Actors

- **Heartbeat**: the clock; once a minute, inside the database, it computes the crisp conditions and raises fires.
- **the bus**: the two triggers that carry a fire to its handler and a landing fact to the whens that listen for it.
- **Watch**: reads worded whens against the record and gives readings.
- **Reconciler**: closes episodes and days, links facts to concepts, bridges them to whens, writes snapshots, asks the Thinker to settle; replays the record on request.
- **Thinker**: thinks in a way given as data.  Two speeds: the glance (one call when a fact lands) and the settle (a way of seats after an episode closes).
- **way**: the seats a settle sits, in order, each with its prompt; data, not code.  Two ship: yes-and (noticer, builder, gatherer, honesty) and the court (facilitator, proposer, challenger, honesty).
- **navigator**: the last seat of every settle.  It takes everything the seats said and chooses the way forward: a conclusion, a question, a proposition, a commitment, or nothing.
- **Doer**: acts from the outbox; writes the morning page and the nightly copy.
- **Librarian**: keeps the shelf: learn, ask, media, embed.
- **connector**: the one door for people and models; speaks the Model Context Protocol; locked by the token on its address.
- **client**: the web pages; speaks to the connector with the same verbs.
- **Worker**: a machine that takes jobs; the MacBook is one.  Its bus mode is not Sunday's work.

## Verbs

- **assert**: to put an intention on the record, with its reason.  It swears nothing.  On the person's side only after he said yes to a read-back.
- **record**: to write a fact, with happened_at when it was not now.
- **propose**: to put a new wording on the record that comes after an old one.
- **raise**: to give a worded when a reading by hand, met or silence.
- **read**: to take the slice of the record an actor or a client needs.
- **ask**: to put a question to the shelf.
- **learn**: to hand the Librarian a source.
- **answer**: to answer an open question in the person's words; the answer is a fact and the question closes.
- **did**: to mark a task done.
- **glance**: the Thinker's one call when a fact lands.
- **settle**: the Thinker's way after an episode closes.
- **snap**: to write a snapshot.
- **close**: to end an episode or a day and write what stands.
- **replay**: to walk the record as if the Reconciler had been there.
- **relink**: to link and bridge facts again; a repair.
- **carry**: to take a copy from the bucket to Drive.

## Settings and limits

- **seatbelt**: an actor's set of limits.
- **cap**: one limit within a seatbelt: daily_dollars, max_tokens, max_rounds, max_whens.
- **turbo**: a faster Watch cadence that ends on its own at turbo_until.
- **hours**: the local hours in which the Watch polls and the Thinker settles.
- **gap_minutes** and **day_close**: the gap and the hour that close an episode and a day.

## Words kept out

Failed, missed, good, bad, success, should, verdict, grade, score: nowhere in the record about the person, in no actor's words, in no field name, in no instruction handed to a model.  The system's own machinery keeps the plain word error for its own breakdowns (an error note is a fact of kind note whose said_by starts with error:); the word applies to the system, never to the person.

## Renames from the first build

affirm to assert; affirmed_by to asserted_by; judge to Watch; judgment to reading; roll-up to snapshot; mark to watermark; fuzzy to worded; moment (as a fire kind) to met; source (on a fact) to said_by, so that source can mean a document; bound_to to bundle; the listener to the bus and the handlers; the knowledge schema to the shelf inside when_fire.
