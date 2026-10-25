-- Clear what the actors derived in wf_next, keeping the record itself (whens, facts by people, stated bridges, sources, claims).
delete from wf_next.snapshots;
delete from wf_next.episodes;
delete from wf_next.fires where fired_by in ('watch', 'reconciler', 'thinker', 'replay');
delete from wf_next.links where created_by in ('watch', 'reconciler', 'thinker', 'replay');
delete from wf_next.bridges where made_by in ('watch', 'reconciler', 'thinker', 'replay');
delete from wf_next.concepts c where c.created_by in ('reconciler', 'thinker') and not exists (select 1 from wf_next.links l where l.to_concept = c.id or (l.from_kind = 'concept' and l.from_id = c.id));
delete from wf_next.question_events qe using wf_next.questions q where qe.question_id = q.id and q.asked_by in ('thinker', 'reconciler') and q.asked_at > '2026-10-25';
delete from wf_next.questions where asked_by in ('thinker', 'reconciler') and asked_at > '2026-10-25';
delete from wf_next.task_events te using wf_next.tasks t where te.task_id = t.id and t.created_by in ('thinker', 'doer', 'reconciler') and t.created_at > '2026-10-25';
delete from wf_next.tasks where created_by in ('thinker', 'doer', 'reconciler') and created_at > '2026-10-25';
delete from wf_next.facts where said_by like 'error:%' or (said_by in ('thinker', 'reconciler', 'watch') and recorded_at > '2026-10-25');
delete from wf_next.settings where key in ('replay_cursor', 'turbo_until') and owner <> wf_next.system_id();
select (select count(*) from wf_next.snapshots) snapshots, (select count(*) from wf_next.episodes) episodes, (select count(*) from wf_next.fires) fires,
       (select count(*) from wf_next.links) links, (select count(*) from wf_next.bridges) bridges, (select count(*) from wf_next.facts) facts, (select count(*) from wf_next.concepts) concepts;
