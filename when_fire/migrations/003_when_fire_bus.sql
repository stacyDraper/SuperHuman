-- when fire, the rewrite.  003: the bus.  Sunday, October 25, 2026.
-- The Heartbeat runs once a minute and computes the crisp conditions: tick and quiet.  A fact landing
-- computes after.  A fire landing wakes the whens that listen for it (on).  Any fire on a when that names a
-- handler is dispatched to that handler's own address with the shared secret.  Worded whens are never polled
-- here; the Watch reads them.

do $$ begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then create extension pg_cron with schema pg_catalog; end if;
  if not exists (select 1 from pg_extension where extname = 'pg_net') then create extension pg_net with schema extensions; end if;
end $$;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- ---------------------------------------------------------------------------------------------
-- dispatch: send a fire to its handler.  Asynchronous; the request leaves after commit.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.dispatch(p_fire uuid, p_handler text) returns bigint
language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare h record; secret text; req bigint; fr record;
begin
  select * into h from when_fire.handlers where name = p_handler and enabled;
  if h is null then
    perform when_fire.record((select owner from when_fire.fires where id = p_fire),
      format('no handler named %s is enabled; fire %s was not dispatched', p_handler, p_fire), 'error:bus', null, null, null, null, null, 'note');
    return null;
  end if;
  select * into fr from when_fire.fires where id = p_fire;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'when_fire_listener_secret';
  select net.http_post(
    url := h.address,
    headers := jsonb_build_object('Content-Type', 'application/json', 'X-When-Fire-Secret', secret),
    body := jsonb_build_object('fire', p_fire, 'handler', p_handler, 'owner', fr.owner, 'when', fr.when_id, 'kind', fr.kind, 'schema', 'when_fire'),
    timeout_milliseconds := 150000   -- an actor may think for a couple of minutes; the bus waits for the answer
  ) into req;
  return req;
end $$;

-- ---------------------------------------------------------------------------------------------
-- A fire lands: wake the listeners (kind on), and dispatch if the when names a handler.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.on_fire_insert() returns trigger
language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare
  w record; l record; depth integer; max_depth integer; lf uuid;
begin
  select * into w from when_fire.whens where id = new.when_id;
  max_depth := coalesce(when_fire.setting(new.owner, 'max_depth')::integer, 5);
  depth := coalesce((new.context->>'depth')::integer, 0);

  if w.handler is not null then
    perform when_fire.dispatch(new.id, w.handler);
  end if;

  if depth + 1 > max_depth then return new; end if;
  for l in
    select * from when_fire.active_whens
    where owner = new.owner and kind = 'on' and (condition->>'on')::uuid = new.when_id and id <> new.when_id
  loop
    if exists (select 1 from when_fire.fires x where x.when_id = l.id and x.by_fire = new.id) then continue; end if;
    insert into when_fire.fires (owner, when_id, kind, fired_by, by_fire, by_fact, context)
    values (new.owner, l.id, 'heard', 'listener', new.id, new.by_fact,
            jsonb_build_object('depth', depth + 1, 'heard', new.kind, 'of', new.when_id))
    returning id into lf;
  end loop;
  return new;
end $$;

drop trigger if exists fires_wake on when_fire.fires;
create trigger fires_wake after insert on when_fire.fires for each row execute function when_fire.on_fire_insert();

-- ---------------------------------------------------------------------------------------------
-- A fact lands: raise land on every active when of kind after that it satisfies.
--   {"after": "world"}                  any world fact of this owner
--   {"after": "world", "said_by": "x"}  world facts said by x
--   {"after": "<when id>"}              a fact about that when
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.on_fact_insert() returns trigger
language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare w record; target text;
begin
  if new.kind <> 'world' then return new; end if;
  for w in select * from when_fire.active_whens where owner = new.owner and kind = 'after' loop
    target := w.condition->>'after';
    if target = 'world' then
      if w.condition ? 'said_by' and w.condition->>'said_by' <> new.said_by then continue; end if;
    elsif target ~ '^[0-9a-f-]{36}$' then
      if new.about is null or new.about <> target::uuid then continue; end if;
    else
      continue;
    end if;
    if new.recorded_at < w.asserted_at then continue; end if;
    insert into when_fire.fires (owner, when_id, kind, fired_by, by_fact, context)
    values (new.owner, w.id, 'land', 'landing', new.id, jsonb_build_object('said_by', new.said_by));
  end loop;
  return new;
end $$;

drop trigger if exists facts_land on when_fire.facts;
create trigger facts_land after insert on when_fire.facts for each row execute function when_fire.on_fact_insert();

-- ---------------------------------------------------------------------------------------------
-- The Heartbeat.  Once a minute.  tick and quiet, per owner, in the owner's time zone.
--   tick {"at": "HH:MM"}, with optional "days": ["mon", ...] or "dates": ["YYYY-MM-DD", ...]; once per local day.
--   tick {"every": N} minutes, with optional "hours": "06-23"; while turbo_until is in the future, "turbo_every" or the owner's setting.
--   quiet {"quiet": "world", "minutes": N}: the latest world fact is N minutes old and this when has not fired since it landed.
-- ---------------------------------------------------------------------------------------------
create or replace function when_fire.heartbeat() returns integer
language plpgsql security definer set search_path = when_fire, pg_catalog, pg_temp as $$
declare
  p record; w record; fired integer := 0;
  tz text; local_now timestamp; local_date date; moment timestamp;
  every integer; last_fire timestamptz; hours text; turbo_until timestamptz;
  last_fact record; quiet integer;
begin
  for p in select * from when_fire.people where kind = 'person' loop
    tz := p.tz; local_now := now() at time zone tz; local_date := local_now::date;

    for w in select * from when_fire.active_whens where owner = p.id and kind = 'tick' loop
      if w.condition ? 'at' then
        if w.condition ? 'days' and not ((w.condition->'days') ? lower(to_char(local_now, 'dy'))) then continue; end if;
        if w.condition ? 'dates' and not ((w.condition->'dates') ? local_date::text) then continue; end if;
        moment := local_date + (w.condition->>'at')::time;
        if local_now < moment then continue; end if;
        if (w.asserted_at at time zone tz) > moment then continue; end if;
        if exists (select 1 from when_fire.fires x where x.when_id = w.id and x.kind = 'tick' and x.context->>'moment' = local_date::text) then continue; end if;
        insert into when_fire.fires (owner, when_id, kind, fired_by, context)
        values (p.id, w.id, 'tick', 'heartbeat', jsonb_build_object('moment', local_date::text, 'at', w.condition->>'at', 'tz', tz));
        fired := fired + 1;
      elsif w.condition ? 'every' then
        hours := coalesce(w.condition->>'hours', when_fire.setting(p.id, 'hours'), '00-24');
        if extract(hour from local_now) < split_part(hours, '-', 1)::integer or extract(hour from local_now) >= split_part(hours, '-', 2)::integer then continue; end if;
        turbo_until := coalesce(when_fire.setting(p.id, 'turbo_until')::timestamptz, 'epoch'::timestamptz);
        every := case when turbo_until > now()
                      then coalesce((w.condition->>'turbo_every')::integer, when_fire.setting(p.id, 'turbo_every')::integer, 30)
                      else (w.condition->>'every')::integer end;
        select max(fired_at) into last_fire from when_fire.fires where when_id = w.id and kind = 'tick';
        if last_fire is not null and last_fire + make_interval(mins => every) > now() then continue; end if;
        insert into when_fire.fires (owner, when_id, kind, fired_by, context)
        values (p.id, w.id, 'tick', 'heartbeat', jsonb_build_object('every', every, 'turbo', turbo_until > now()));
        fired := fired + 1;
      end if;
    end loop;

    select id, recorded_at into last_fact from when_fire.facts
    where owner = p.id and kind = 'world' order by recorded_at desc limit 1;
    if last_fact.id is not null then
      for w in select * from when_fire.active_whens where owner = p.id and kind = 'quiet' loop
        quiet := coalesce((w.condition->>'minutes')::integer, 30);
        if last_fact.recorded_at < w.asserted_at then continue; end if;
        if last_fact.recorded_at + make_interval(mins => quiet) > now() then continue; end if;
        if exists (select 1 from when_fire.fires x where x.when_id = w.id and x.fired_at >= last_fact.recorded_at) then continue; end if;
        insert into when_fire.fires (owner, when_id, kind, fired_by, by_fact, context)
        values (p.id, w.id, 'quiet', 'heartbeat', last_fact.id, jsonb_build_object('minutes', quiet, 'after_fact', last_fact.id));
        fired := fired + 1;
      end loop;
    end if;
  end loop;
  return fired;
end $$;

-- Once a minute.  The job name carries the schema so a second copy of the schema gets its own job.
do $$
begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'when_fire.heartbeat';
exception when others then null;
end $$;
select cron.schedule('when_fire.heartbeat', '* * * * *', 'select when_fire.heartbeat()');
