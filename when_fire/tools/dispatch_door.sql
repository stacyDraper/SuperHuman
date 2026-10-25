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
