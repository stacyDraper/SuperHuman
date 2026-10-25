-- when fire, the rewrite.  004: the seed.  Sunday, October 25, 2026.
-- The system person, the first person, the settings, the seatbelt, the relation words, the handlers,
-- the shared concepts, and the system's own whens: the Watch's poll, the glance, the episode close, the
-- day close, the morning page, the nightly copy.

-- The system.
insert into when_fire.people (id, kind, name, words, tz)
values (when_fire.system_id(), 'system', 'when fire', 'the system itself; owns the shared rows', 'UTC')
on conflict (id) do nothing;

-- The first person.  His connector token is the one already in the vault; its hash names him.
insert into when_fire.people (kind, name, words, tz, token_hash)
select 'person', 'Stacy', 'Stacy Draper, a man, 56 in 2026; refer to him as Stacy, he, him.', 'America/New_York',
       encode(extensions.digest((select decrypted_secret from vault.decrypted_secrets where name = 'when_fire_mcp_token'), 'sha256'), 'hex')
where not exists (select 1 from when_fire.people where name = 'Stacy' and kind = 'person');

-- Settings, the system's defaults.
insert into when_fire.settings (owner, key, value, note) values
  (when_fire.system_id(), 'model', 'claude-sonnet-5-5', 'the model every actor calls'),
  (when_fire.system_id(), 'model_workspace_id', 'wrkspc_01ECEMmwxSCJBRND5u89Drzx', 'sent as anthropic-workspace-id; the key is scoped to the organization'),
  (when_fire.system_id(), 'hours', '06-23', 'local hours within which the Watch''s poll and the Thinker run'),
  (when_fire.system_id(), 'turbo_every', '30', 'minutes between the Watch''s polls while turbo_until is in the future'),
  (when_fire.system_id(), 'turbo_until', 'epoch', 'turbo runs until this time and ends on its own; epoch means off'),
  (when_fire.system_id(), 'max_depth', '5', 'how deep listeners of listeners may go'),
  (when_fire.system_id(), 'gap_minutes', '30', 'the quiet that closes an episode'),
  (when_fire.system_id(), 'day_close', '04:00', 'the backstop hour that closes a day when sleep has not'),
  (when_fire.system_id(), 'price_in_per_m', '3', 'dollars per million input tokens'),
  (when_fire.system_id(), 'price_out_per_m', '15', 'dollars per million output tokens, thinking included'),
  (when_fire.system_id(), 'price_cached_per_m', '0.30', 'dollars per million cached input tokens read')
on conflict (owner, key) do nothing;

-- The seatbelt, the system's defaults.
insert into when_fire.caps (owner, actor, name, value, note) values
  (when_fire.system_id(), '*', 'daily_dollars', '3.00', 'every actor together, per person, per local day'),
  (when_fire.system_id(), 'thinker', 'daily_dollars', '1.50', 'the Thinker alone'),
  (when_fire.system_id(), 'thinker', 'max_rounds', '2', 'rounds in a settle'),
  (when_fire.system_id(), 'thinker', 'max_tokens', '80000', 'tokens in a settle, all seats together'),
  (when_fire.system_id(), 'watch', 'max_whens', '40', 'worded whens in one look')
on conflict (owner, actor, name) do nothing;

-- Relation words.
insert into when_fire.relations (name, inverse, note) values
  ('kind_of', 'has_kind', 'a dip is a kind of push'),
  ('part_of', 'has_part', 'calves are part of legs'),
  ('works', 'worked_by', 'a movement works a body part'),
  ('opposes', 'opposes', 'a movement or a muscle opposes another'),
  ('because', 'reason_for', 'a when or a fact is because of a reason'),
  ('about', 'subject_of', 'a fact, when, claim or question is about a concept'),
  ('same_as', 'same_as', 'two concepts found to be one'),
  ('cites', 'cited_by', 'rests on a source or a claim')
on conflict (name) do nothing;

-- Handlers: each actor at its own address.
insert into when_fire.handlers (name, address, note) values
  ('watch', 'https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/watch', 'the Watch: readings on worded whens'),
  ('reconciler', 'https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/reconciler', 'the Reconciler: episodes, days, snapshots'),
  ('thinker', 'https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/thinker', 'the Thinker: glance and settle'),
  ('doer', 'https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/doer', 'the Doer: writes tasks to the outbox and performs the mechanical ones'),
  ('librarian', 'https://xmdrzegrkjdeibvxihih.supabase.co/functions/v1/librarian', 'the Librarian: learn and ask')
on conflict (name) do update set address = excluded.address, note = excluded.note;

-- Shared concepts: body parts, movements, measures.  Owned by the system, read by every owner.
do $$
declare s uuid := when_fire.system_id(); a uuid; b uuid; r record;
begin
  -- body parts and their parts
  for r in select * from (values
      ('body', null), ('legs', 'body'), ('arms', 'body'), ('core', 'body'), ('back', 'body'), ('chest', 'body'), ('shoulders', 'body'), ('neck', 'body'), ('hips', 'body'),
      ('calves', 'legs'), ('achilles', 'legs'), ('knees', 'legs'), ('quads', 'legs'), ('hamstrings', 'legs'), ('glutes', 'hips'), ('ankles', 'legs'), ('feet', 'legs'),
      ('lower back', 'back'), ('upper back', 'back'), ('lats', 'back'),
      ('triceps', 'arms'), ('biceps', 'arms'), ('forearms', 'arms'), ('wrists', 'arms'), ('elbows', 'arms'),
      ('abs', 'core'), ('obliques', 'core'),
      ('rotator cuff', 'shoulders')) as t(name, parent) loop
    a := when_fire.concept(s, 'seed', 'body_part', r.name);
    if r.parent is not null then
      b := when_fire.concept(s, 'seed', 'body_part', r.parent);
      perform when_fire.link(s, 'seed', 'concept', a, 'part_of', b, 'anatomy');
    end if;
  end loop;
  -- movements and what they work
  for r in select * from (values
      ('dip', 'chest,triceps,shoulders'), ('pull-up', 'back,lats,biceps'), ('decline push-up', 'chest,triceps,shoulders'), ('push-up', 'chest,triceps,shoulders'),
      ('air squat', 'quads,glutes,hamstrings'), ('jump rope', 'calves,achilles,ankles'), ('seated calf raise', 'calves'), ('standing calf raise', 'calves'),
      ('leg press', 'quads,glutes'), ('leg extension', 'quads'), ('seated leg curl', 'hamstrings'), ('glute glide', 'glutes'),
      ('chest press', 'chest,triceps'), ('overhead press', 'shoulders,triceps'), ('lateral raise', 'shoulders'), ('triceps extension', 'triceps'),
      ('ab machine', 'abs'), ('ab twist', 'obliques'), ('walk', 'legs'), ('run', 'legs,calves')) as t(name, works) loop
    a := when_fire.concept(s, 'seed', 'movement', r.name);
    foreach b in array (select array_agg(when_fire.concept(s, 'seed', 'body_part', x)) from unnest(string_to_array(r.works, ',')) x) loop
      perform when_fire.link(s, 'seed', 'concept', a, 'works', b, 'general knowledge');
    end loop;
  end loop;
  -- kinds of movement
  b := when_fire.concept(s, 'seed', 'movement', 'push');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'dip'), 'kind_of', b, 'general knowledge');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'decline push-up'), 'kind_of', b, 'general knowledge');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'push-up'), 'kind_of', b, 'general knowledge');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'chest press'), 'kind_of', b, 'general knowledge');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'overhead press'), 'kind_of', b, 'general knowledge');
  b := when_fire.concept(s, 'seed', 'movement', 'pull');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'pull-up'), 'kind_of', b, 'general knowledge');
  perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', 'seated leg curl'), 'kind_of', b, 'general knowledge');
  b := when_fire.concept(s, 'seed', 'movement', 'exercise');
  for r in select name from when_fire.concepts where owner = s and kind = 'movement' and name <> 'exercise' loop
    perform when_fire.link(s, 'seed', 'concept', when_fire.concept(s, 'seed', 'movement', r.name), 'kind_of', b, 'general knowledge');
  end loop;
  -- measures
  perform when_fire.concept(s, 'seed', 'measure', 'calories');
  perform when_fire.concept(s, 'seed', 'measure', 'minutes');
  perform when_fire.concept(s, 'seed', 'measure', 'reps');
  perform when_fire.concept(s, 'seed', 'measure', 'weight');
  perform when_fire.concept(s, 'seed', 'measure', 'body mass');
  perform when_fire.concept(s, 'seed', 'measure', 'heart rate');
end $$;

-- The system's own whens, on the first person's record, each signed by its actor.
do $$
declare o uuid := (select id from when_fire.people where kind = 'person' and name = 'Stacy'); r jsonb;
begin
  if o is null then return; end if;
  if exists (select 1 from when_fire.whens where owner = o and asserted_by = 'watch') then return; end if;

  perform when_fire.assert(o, 'watch', jsonb_build_object('whens', jsonb_build_array(jsonb_build_object(
    'words', 'Look at the worded whens against the record and give each a reading: met, silence, open, or met later.',
    'condition_words', 'every three hours between six and eleven; every thirty minutes while turbo is on; and at every episode close',
    'condition', jsonb_build_object('every', 180, 'hours', '06-23', 'turbo_every', 30),
    'handler', 'watch'))));

  perform when_fire.assert(o, 'thinker', jsonb_build_object('whens', jsonb_build_array(jsonb_build_object(
    'words', 'Glance at what just landed: link its concepts, mark surprise, write a note only if it surprises or asks a question.',
    'condition_words', 'whenever a fact from the world lands',
    'condition', jsonb_build_object('after', 'world'),
    'handler', 'thinker', 'bounds', jsonb_build_object('mode', 'glance')))));

  perform when_fire.assert(o, 'reconciler', jsonb_build_object('whens', jsonb_build_array(
    jsonb_build_object(
      'words', 'Close the episode: the Watch reads the worded whens, then one snapshot per stale subject and one for the episode; then the Thinker settles.',
      'condition_words', 'when the record has been quiet for thirty minutes',
      'condition', jsonb_build_object('quiet', 'world', 'minutes', 30),
      'handler', 'reconciler', 'bounds', jsonb_build_object('mode', 'episode', 'then', 'thinker')),
    jsonb_build_object(
      'words', 'Close the day: a snapshot of the day, the health line, the day''s cost.',
      'condition_words', 'at four in the morning, until sleep from the wrist closes it instead',
      'condition', jsonb_build_object('at', '04:00'),
      'handler', 'reconciler', 'bounds', jsonb_build_object('mode', 'day')))));

  perform when_fire.assert(o, 'doer', jsonb_build_object('whens', jsonb_build_array(
    jsonb_build_object(
      'words', 'Write the morning page into the outbox: today''s whens in his words and last night''s reconciliation.',
      'condition_words', 'at half past five in the morning',
      'condition', jsonb_build_object('at', '05:30'),
      'handler', 'doer', 'bounds', jsonb_build_object('kind', 'morning_page')),
    jsonb_build_object(
      'words', 'Copy the record and the shelf off the database into the copies bucket, and ask the Doer to carry the record to Drive.',
      'condition_words', 'at three in the morning',
      'condition', jsonb_build_object('at', '03:00'),
      'handler', 'doer', 'bounds', jsonb_build_object('kind', 'copy')))));
end $$;
