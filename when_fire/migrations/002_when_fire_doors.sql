-- when fire, the rewrite.  002: the doors.  Sunday, October 25, 2026.
-- Every actor reaches the record through these functions and nothing else.  They run as the database
-- owner (security definer) and take the owner as their first argument; the caller has already turned a
-- token into an owner with owner_for_token.  Each writes one row, or reads one slice.

-- ---------------------------------------------------------------------------------------------
-- Lookups.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.setting(p_owner uuid, p_key text) returns text
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select coalesce(
    (select value from when_fire.settings where owner = p_owner and key = p_key),
    (select value from when_fire.settings where owner = when_fire.system_id() and key = p_key))
$$;

create or replace function when_fire.cap(p_owner uuid, p_actor text, p_name text) returns text
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select coalesce(
    (select value from when_fire.caps where owner = p_owner and actor = p_actor and name = p_name),
    (select value from when_fire.caps where owner = p_owner and actor = '*' and name = p_name),
    (select value from when_fire.caps where owner = when_fire.system_id() and actor = p_actor and name = p_name),
    (select value from when_fire.caps where owner = when_fire.system_id() and actor = '*' and name = p_name))
$$;

create or replace function when_fire.owner_for_token(p_token text) returns uuid
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select id from when_fire.people
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') and kind = 'person'
  limit 1
$$;

create or replace function when_fire.tz(p_owner uuid) returns text
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select coalesce((select tz from when_fire.people where id = p_owner), 'UTC')
$$;

create or replace function when_fire.local_now(p_owner uuid) returns timestamp
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select now() at time zone when_fire.tz(p_owner)
$$;

-- lineage: a when and every when it comes after, oldest last.  Facts about an earlier when in the chain count for the current one.
create or replace function when_fire.lineage(p_when uuid) returns uuid[]
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  with recursive chain as (
    select id, supersedes, 0 as depth from when_fire.whens where id = p_when
    union all
    select w.id, w.supersedes, c.depth + 1 from chain c join when_fire.whens w on w.id = c.supersedes where c.depth < 50
  )
  select array_agg(id order by depth) from chain
$$;

-- ---------------------------------------------------------------------------------------------
-- record: a fact.  Two times.  Late facts are welcome; a correction is a new fact pointing at the old.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.record(
  p_owner uuid, p_said text, p_said_by text,
  p_happened_at timestamptz default null, p_about uuid default null, p_corrects uuid default null,
  p_cites uuid default null, p_shape jsonb default null, p_kind text default 'world')
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare fid uuid;
begin
  if p_said is null or btrim(p_said) = '' then raise exception 'record: said is empty'; end if;
  insert into when_fire.facts (owner, happened_at, recorded_at, said_by, kind, said, about, corrects, cites, shape)
  values (p_owner, coalesce(p_happened_at, now()), now(), p_said_by, coalesce(p_kind, 'world'), p_said, p_about, p_corrects, p_cites, p_shape)
  returning id into fid;
  return fid;
end $$;

-- ---------------------------------------------------------------------------------------------
-- assert: a bundle of whens, each with the condition that makes it due, and the reason behind them.
-- p is {"bundle": {...} | null, "whens": [{...}], "reason": {"words": "...", "name": "..."} | null}.
-- A when is {words, condition_words, condition, handler, bounds, until_words, until_condition, supersedes, bundle, shape, asserted_by}.
-- Kind is read off the condition: null is worded; at or every is tick; after is after; quiet is quiet; on is on.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.kind_of(p_condition jsonb) returns text
language sql immutable set search_path = pg_catalog as $$
  select case
    when p_condition is null or p_condition = 'null'::jsonb or p_condition = '{}'::jsonb then 'worded'
    when p_condition ? 'on' then 'on'
    when p_condition ? 'at' or p_condition ? 'every' then 'tick'
    when p_condition ? 'after' then 'after'
    when p_condition ? 'quiet' then 'quiet'
    else 'worded' end
$$;

create or replace function when_fire.until_of(p_owner uuid, p_until jsonb) returns timestamptz
language plpgsql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
begin
  if p_until is null or p_until = 'null'::jsonb then return null; end if;
  if p_until ? 'at' then return (p_until->>'at')::timestamptz; end if;
  if p_until ? 'date' then
    -- the horizon is the end of that local day
    return ((p_until->>'date')::date + 1) ::timestamp at time zone when_fire.tz(p_owner);
  end if;
  return null;
end $$;

create or replace function when_fire.assert(p_owner uuid, p_asserted_by text, p jsonb)
returns jsonb language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare
  b jsonb := p->'bundle';
  w jsonb;
  bundle_id uuid;
  wid uuid;
  ids uuid[] := '{}';
  reason_id uuid;
  cond jsonb;
begin
  if p->'reason' is not null and p->'reason' <> 'null'::jsonb and coalesce(p->'reason'->>'words', '') <> '' then
    reason_id := when_fire.concept(p_owner, p_asserted_by, 'reason',
                   coalesce(p->'reason'->>'name', left(p->'reason'->>'words', 60)), p->'reason'->>'words', null);
  end if;

  if b is not null and b <> 'null'::jsonb then
    cond := case when b->'condition' = 'null'::jsonb then null else b->'condition' end;
    insert into when_fire.whens (owner, asserted_by, words, condition_words, condition, kind, handler, bounds, bundle, until_words, until_at, supersedes, shape)
    values (p_owner, coalesce(b->>'asserted_by', p_asserted_by), b->>'words', b->>'condition_words', cond, when_fire.kind_of(cond),
            coalesce(b->>'handler', cond->>'handler'), b->'bounds', nullif(b->>'bundle', '')::uuid, b->>'until_words',
            when_fire.until_of(p_owner, b->'until_condition'), nullif(b->>'supersedes', '')::uuid, b->'shape')
    returning id into bundle_id;
    ids := ids || bundle_id;
    if reason_id is not null then
      perform when_fire.link(p_owner, p_asserted_by, 'when', bundle_id, 'because', reason_id, 'asserted together', null);
    end if;
  end if;

  for w in select * from jsonb_array_elements(coalesce(p->'whens', '[]'::jsonb)) loop
    cond := case when w->'condition' = 'null'::jsonb then null else w->'condition' end;
    insert into when_fire.whens (owner, asserted_by, words, condition_words, condition, kind, handler, bounds, bundle, until_words, until_at, supersedes, shape)
    values (p_owner, coalesce(w->>'asserted_by', p_asserted_by), w->>'words', w->>'condition_words', cond, when_fire.kind_of(cond),
            coalesce(w->>'handler', cond->>'handler'), w->'bounds', coalesce(nullif(w->>'bundle', '')::uuid, bundle_id), w->>'until_words',
            when_fire.until_of(p_owner, w->'until_condition'), nullif(w->>'supersedes', '')::uuid, w->'shape')
    returning id into wid;
    ids := ids || wid;
    if reason_id is not null then
      perform when_fire.link(p_owner, p_asserted_by, 'when', wid, 'because', reason_id, 'asserted together', null);
    end if;
  end loop;

  return jsonb_build_object('bundle', bundle_id, 'whens', to_jsonb(ids), 'reason', reason_id);
end $$;

-- ---------------------------------------------------------------------------------------------
-- raise: a fire on a when.  The Watch's door, and the heartbeat's.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.raise(
  p_owner uuid, p_when uuid, p_kind text, p_fired_by text,
  p_context jsonb default null, p_by_fact uuid default null, p_by_fire uuid default null, p_fired_at timestamptz default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare fid uuid;
begin
  insert into when_fire.fires (owner, when_id, kind, fired_by, by_fact, by_fire, context, fired_at)
  values (p_owner, p_when, p_kind, p_fired_by, p_by_fact, p_by_fire, p_context, coalesce(p_fired_at, now()))
  returning id into fid;
  return fid;
end $$;

-- ---------------------------------------------------------------------------------------------
-- The graph.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.concept(
  p_owner uuid, p_created_by text, p_kind text, p_name text, p_words text default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare cid uuid; nm text := lower(btrim(p_name));
begin
  -- reuse before create: the owner's own, then the system's shared
  select id into cid from when_fire.concepts
  where supersedes is null and kind = p_kind and lower(name) = nm and owner in (p_owner, when_fire.system_id())
  order by (owner = p_owner) desc limit 1;
  if cid is not null then return cid; end if;
  insert into when_fire.concepts (owner, created_by, kind, name, words, shape)
  values (p_owner, p_created_by, p_kind, nm, p_words, p_shape) returning id into cid;
  return cid;
end $$;

create or replace function when_fire.link(
  p_owner uuid, p_created_by text, p_from_kind text, p_from_id uuid, p_relation text, p_to_concept uuid,
  p_cites text default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare lid uuid;
begin
  if not exists (select 1 from when_fire.relations where name = p_relation and admitted) then
    raise exception 'link: relation "%" is not in the list', p_relation;
  end if;
  -- the same link twice is one link
  select id into lid from when_fire.links
  where owner = p_owner and from_kind = p_from_kind and from_id = p_from_id and relation = p_relation and to_concept = p_to_concept and negates is null
    and not exists (select 1 from when_fire.links n where n.negates = links.id);
  if lid is not null then return lid; end if;
  insert into when_fire.links (owner, created_by, from_kind, from_id, relation, to_concept, cites, shape)
  values (p_owner, p_created_by, p_from_kind, p_from_id, p_relation, p_to_concept, p_cites, p_shape) returning id into lid;
  return lid;
end $$;

-- Walk down: every concept under p_concept through the given relations (defaults: part_of, kind_of), plus itself.
create or replace function when_fire.under(p_owner uuid, p_concept uuid, p_relations text[] default array['part_of', 'kind_of'], p_depth integer default 6)
returns table (concept uuid, depth integer)
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  with recursive down as (
    select p_concept as concept, 0 as depth
    union
    select l.from_id, d.depth + 1
    from down d
    join when_fire.links l on l.from_kind = 'concept' and l.to_concept = d.concept and l.relation = any (p_relations)
      and l.owner in (p_owner, when_fire.system_id())
      and not exists (select 1 from when_fire.links n where n.negates = l.id)
    where d.depth < p_depth
  )
  select concept, min(depth) from down group by concept
$$;

-- Everything to do with a concept: facts and whens linked to it or to anything under it.
create or replace function when_fire.about_concept(p_owner uuid, p_concept uuid, p_relations text[] default array['part_of', 'kind_of', 'works'])
returns table (from_kind text, from_id uuid, relation text, concept uuid, depth integer)
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select l.from_kind, l.from_id, l.relation, u.concept, u.depth
  from when_fire.under(p_owner, p_concept, p_relations) u
  join when_fire.links l on l.to_concept = u.concept and l.from_kind in ('fact', 'when', 'claim', 'question')
    and l.owner = p_owner and not exists (select 1 from when_fire.links n where n.negates = l.id)
$$;

-- Walk out from a reason: every when and fact that is because of it.
create or replace function when_fire.because_of(p_owner uuid, p_reason uuid)
returns table (from_kind text, from_id uuid)
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select l.from_kind, l.from_id from when_fire.links l
  where l.to_concept = p_reason and l.relation = 'because' and l.owner = p_owner
    and not exists (select 1 from when_fire.links n where n.negates = l.id)
$$;

-- ---------------------------------------------------------------------------------------------
-- Bridges and tallies.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.bridge(
  p_owner uuid, p_made_by text, p_fact uuid, p_when uuid, p_amount numeric default null, p_cites text default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare bid uuid;
begin
  select id into bid from when_fire.bridges b
  where owner = p_owner and fact_id = p_fact and when_id = p_when and negates is null
    and not exists (select 1 from when_fire.bridges n where n.negates = b.id);
  if bid is not null then return bid; end if;
  insert into when_fire.bridges (owner, made_by, fact_id, when_id, amount, cites, shape)
  values (p_owner, p_made_by, p_fact, p_when, p_amount, p_cites, p_shape) returning id into bid;
  return bid;
end $$;

create or replace function when_fire.tally(p_owner uuid, p_when uuid, p_since timestamptz default null, p_until timestamptz default null)
returns jsonb language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select jsonb_build_object('facts', count(*), 'amount', coalesce(sum(b.amount), 0))
  from when_fire.bridges b
  join when_fire.facts f on f.id = b.fact_id
  where b.owner = p_owner and b.when_id = any (when_fire.lineage(p_when)) and b.negates is null
    and not exists (select 1 from when_fire.bridges n where n.negates = b.id)
    and (p_since is null or f.happened_at >= p_since) and (p_until is null or f.happened_at < p_until)
$$;

-- ---------------------------------------------------------------------------------------------
-- Snapshots.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.snap(
  p_owner uuid, p_subject_kind text, p_subject_id uuid, p_watermark timestamptz, p_written_by text, p_says text, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare prev uuid; sid uuid;
begin
  select id into prev from when_fire.current_snapshots
  where owner = p_owner and subject_kind = p_subject_kind and (subject_id = p_subject_id or (subject_id is null and p_subject_id is null))
  order by written_at desc limit 1;
  insert into when_fire.snapshots (owner, subject_kind, subject_id, watermark, written_by, says, replaces, shape)
  values (p_owner, p_subject_kind, p_subject_id, p_watermark, p_written_by, p_says, prev, p_shape) returning id into sid;
  return sid;
end $$;

-- A subject is stale when a fact about it was recorded after its current watermark.
create or replace function when_fire.stale_whens(p_owner uuid)
returns table (when_id uuid, watermark timestamptz, latest timestamptz)
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select w.id, s.watermark, max(f.recorded_at)
  from when_fire.active_whens w
  left join when_fire.current_snapshots s on s.subject_kind = 'when' and s.subject_id = w.id
  join when_fire.facts f on f.owner = p_owner and f.kind = 'world'
    and (f.about = w.id or exists (select 1 from when_fire.bridges b where b.fact_id = f.id and b.when_id = w.id and b.negates is null))
  where w.owner = p_owner
  group by w.id, s.watermark
  having s.watermark is null or max(f.recorded_at) > s.watermark
$$;

-- ---------------------------------------------------------------------------------------------
-- Questions, tasks, costs.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.question(
  p_owner uuid, p_asked_by text, p_words text, p_about_kind text default null, p_about_id uuid default null,
  p_ask_of text default 'shelf', p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare qid uuid;
begin
  insert into when_fire.questions (owner, asked_by, words, about_kind, about_id, ask_of, shape)
  values (p_owner, p_asked_by, p_words, p_about_kind, p_about_id, coalesce(p_ask_of, 'shelf'), p_shape) returning id into qid;
  insert into when_fire.question_events (question_id, kind, by, words) values (qid, 'asked', p_asked_by, p_words);
  return qid;
end $$;

create or replace function when_fire.question_event(
  p_question uuid, p_kind text, p_by text, p_words text default null, p_cites text default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare eid uuid;
begin
  insert into when_fire.question_events (question_id, kind, by, words, cites, shape)
  values (p_question, p_kind, p_by, p_words, p_cites, p_shape) returning id into eid;
  if p_kind = 'tried' and p_shape ? 'ask_of' then
    update when_fire.questions set ask_of = p_shape->>'ask_of' where id = p_question;
  end if;
  return eid;
end $$;

create or replace function when_fire.task(
  p_owner uuid, p_created_by text, p_kind text, p_words text, p_due_at timestamptz default null, p_fire uuid default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare tid uuid;
begin
  insert into when_fire.tasks (owner, created_by, kind, words, due_at, fire_id, shape)
  values (p_owner, p_created_by, p_kind, p_words, p_due_at, p_fire, p_shape) returning id into tid;
  insert into when_fire.task_events (task_id, kind, by, words) values (tid, 'requested', p_created_by, p_words);
  return tid;
end $$;

create or replace function when_fire.task_event(p_task uuid, p_kind text, p_by text, p_words text default null, p_shape jsonb default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare eid uuid;
begin
  insert into when_fire.task_events (task_id, kind, by, words, shape) values (p_task, p_kind, p_by, p_words, p_shape) returning id into eid;
  return eid;
end $$;

create or replace function when_fire.cost(
  p_owner uuid, p_actor text, p_model text, p_in integer, p_out integer, p_thinking integer, p_cached integer,
  p_dollars numeric, p_stop text default null, p_seconds numeric default null, p_fire uuid default null, p_note text default null)
returns uuid language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare cid uuid;
begin
  insert into when_fire.costs (owner, actor, model, tokens_in, tokens_out, tokens_thinking, tokens_cached, dollars, stop_reason, seconds, fire_id, note)
  values (p_owner, p_actor, p_model, coalesce(p_in, 0), coalesce(p_out, 0), coalesce(p_thinking, 0), coalesce(p_cached, 0), coalesce(p_dollars, 0), p_stop, p_seconds, p_fire, p_note)
  returning id into cid;
  return cid;
end $$;

create or replace function when_fire.spent_today(p_owner uuid, p_actor text default null) returns numeric
language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  select coalesce(sum(dollars), 0) from when_fire.costs
  where owner = p_owner and (p_actor is null or actor = p_actor)
    and at >= (date_trunc('day', when_fire.local_now(p_owner)) at time zone when_fire.tz(p_owner))
$$;

-- ---------------------------------------------------------------------------------------------
-- read: the slice of the record an actor needs.
-- p: {"since": iso, "until": iso, "limit": n | "all", "bundle": id or words, "include_inactive": bool, "notes": bool, "fires": bool}
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.read(p_owner uuid, p jsonb default '{}'::jsonb)
returns jsonb language plpgsql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare
  since timestamptz := coalesce((p->>'since')::timestamptz, now() - interval '7 days');
  until_ timestamptz := coalesce((p->>'until')::timestamptz, now() + interval '1 day');
  lim integer := case when p->>'limit' = 'all' then 100000 else coalesce((p->>'limit')::integer, 500) end;
  notes boolean := coalesce((p->>'notes')::boolean, false);
  with_fires boolean := coalesce((p->>'fires')::boolean, true);
  inactive boolean := coalesce((p->>'include_inactive')::boolean, false);
  bundle_filter text := p->>'bundle';
  as_of timestamptz := (p->>'as_of')::timestamptz;   -- whens as they stood at that moment (replay)
  bundle_ids uuid[];
  whens_j jsonb; facts_j jsonb; fires_j jsonb; snaps_j jsonb; questions_j jsonb; tasks_j jsonb; reasons_j jsonb;
begin
  if bundle_filter is not null then
    if bundle_filter ~ '^[0-9a-f-]{36}$' then
      bundle_ids := array[bundle_filter::uuid];
    else
      select array_agg(id) into bundle_ids from when_fire.active_whens
      where owner = p_owner and bundle is null and (words ilike '%' || bundle_filter || '%' or condition_words ilike '%' || bundle_filter || '%');
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(w) order by w.asserted_at), '[]'::jsonb) into whens_j
  from (select w.*,
               (select jsonb_agg(jsonb_build_object('reason', c.id, 'name', c.name, 'words', c.words))
                  from when_fire.links l join when_fire.concepts c on c.id = l.to_concept
                 where l.from_kind = 'when' and l.from_id = w.id and l.relation = 'because'
                   and not exists (select 1 from when_fire.links n where n.negates = l.id)) as reasons,
               (select to_jsonb(array_remove(when_fire.lineage(w.id), w.id))) as after
        from (select * from when_fire.whens where inactive
              union all select * from when_fire.active_whens where not inactive and as_of is null
              union all select x.* from when_fire.whens x
                         where not inactive and as_of is not null and x.asserted_at <= as_of
                           and (x.until_at is null or x.until_at > as_of)
                           and not exists (select 1 from when_fire.whens s where s.supersedes = x.id and s.asserted_at <= as_of)) w
        where w.owner = p_owner
          and (bundle_ids is null or w.id = any (bundle_ids) or w.bundle = any (bundle_ids))) w;

  select coalesce(jsonb_agg(to_jsonb(f) order by f.happened_at), '[]'::jsonb) into facts_j
  from (select * from when_fire.facts
        where owner = p_owner and (kind = 'world' or notes)
          and (happened_at >= since or recorded_at >= since) and happened_at < until_
          and (bundle_ids is null or about = any (bundle_ids) or about in (select id from when_fire.whens where bundle = any (bundle_ids)))
        order by recorded_at desc limit lim) f;

  if with_fires then
    select coalesce(jsonb_agg(to_jsonb(x) order by x.fired_at), '[]'::jsonb) into fires_j
    from (select * from when_fire.fires
          where owner = p_owner and fired_at >= since and kind in ('met', 'silence', 'tick')
            and (bundle_ids is null or when_id = any (bundle_ids) or when_id in (select id from when_fire.whens where bundle = any (bundle_ids)))
          order by fired_at desc limit lim) x;
  else
    fires_j := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(to_jsonb(s) order by s.written_at), '[]'::jsonb) into snaps_j
  from (select id, subject_kind, subject_id, watermark, written_at, written_by, says, shape from when_fire.current_snapshots
        where owner = p_owner and written_at >= since - interval '7 days' order by written_at desc limit lim) s;

  select coalesce(jsonb_agg(to_jsonb(q) order by q.asked_at), '[]'::jsonb) into questions_j
  from (select * from when_fire.open_questions where owner = p_owner) q;

  select coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) into tasks_j
  from (select * from when_fire.open_tasks where owner = p_owner) t;

  return jsonb_build_object(
    'owner', p_owner, 'tz', when_fire.tz(p_owner), 'local_now', to_char(when_fire.local_now(p_owner), 'YYYY-MM-DD HH24:MI'),
    'person', (select jsonb_build_object('name', name, 'words', words) from when_fire.people where id = p_owner),
    'since', since, 'whens', whens_j, 'facts', facts_j, 'fires', fires_j,
    'snapshots', snaps_j, 'questions', questions_j, 'tasks', tasks_j);
end $$;

-- ---------------------------------------------------------------------------------------------
-- health: the system's own state, for the Reconciler's health line and the client.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.health(p_owner uuid) returns jsonb
language plpgsql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare out jsonb;
begin
  select jsonb_build_object(
    'heartbeat_last', (select max(end_time) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname like '%heartbeat%' and d.status = 'succeeded'),
    'heartbeat_errors_24h', (select count(*) from cron.job_run_details d join cron.job j on j.jobid = d.jobid where j.jobname like '%heartbeat%' and d.status <> 'succeeded' and d.start_time > now() - interval '24 hours'),
    'fires_24h', (select count(*) from when_fire.fires where owner = p_owner and fired_at > now() - interval '24 hours'),
    'notes_24h', (select count(*) from when_fire.facts where owner = p_owner and kind = 'note' and recorded_at > now() - interval '24 hours'),
    'errors_24h', (select coalesce(jsonb_agg(jsonb_build_object('at', recorded_at, 'by', said_by, 'said', left(said, 200))), '[]'::jsonb)
                   from when_fire.facts where owner = p_owner and kind = 'note' and said_by like 'error:%' and recorded_at > now() - interval '24 hours'),
    'spent_today_usd', when_fire.spent_today(p_owner),
    'open_questions', (select count(*) from when_fire.open_questions where owner = p_owner),
    'open_tasks', (select count(*) from when_fire.open_tasks where owner = p_owner),
    'last_world_fact', (select max(recorded_at) from when_fire.facts where owner = p_owner and kind = 'world'))
  into out;
  return out;
end $$;

-- ---------------------------------------------------------------------------------------------
-- ask: the shelf, by words and by meaning together.  The caller embeds the question.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.ask(p_owner uuid, p_words text, p_embedding extensions.vector(384) default null, p_limit integer default 12)
returns jsonb language sql stable security definer set search_path = when_fire, pg_catalog, pg_temp as $$
  with current as (
    select c.* from when_fire.claims c
    where c.owner in (p_owner, when_fire.system_id())
      and not exists (select 1 from when_fire.claims n where n.supersedes = c.id)
  ),
  by_words as (
    select id, ts_rank(tsv, websearch_to_tsquery('english', p_words)) as score
    from current where tsv @@ websearch_to_tsquery('english', p_words)
    order by score desc limit p_limit * 2
  ),
  by_meaning as (
    select id, 1 - (embedding operator(extensions.<=>) p_embedding) as score
    from current where p_embedding is not null and embedding is not null
    order by embedding operator(extensions.<=>) p_embedding limit p_limit * 2
  ),
  merged as (
    select id, sum(score) as score from (
      select id, score * 0.5 as score from by_words
      union all
      select id, score from by_meaning) x
    group by id order by score desc limit p_limit
  )
  select coalesce(jsonb_agg(jsonb_build_object(
      'claim', c.id, 'said', c.said, 'about', c.about_words, 'made_at', c.made_at,
      'source', jsonb_build_object('id', s.id, 'origin', s.origin, 'title', s.title, 'kind', s.kind, 'happened_at', s.happened_at),
      'score', round(m.score::numeric, 3)) order by m.score desc), '[]'::jsonb)
  from merged m join when_fire.claims c on c.id = m.id join when_fire.sources s on s.id = c.source_id
$$;
