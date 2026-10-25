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
