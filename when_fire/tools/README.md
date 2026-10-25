# tools

Build and operations helpers, October 25, 2026.  They expect two files beside them that are not kept here: copy_secret (the value of the vault secret when_fire_listener_secret, used as x-copy-secret and x-when-fire-secret) and mcp_token (the value of the vault secret when_fire_mcp_token).  Read both from the database vault when needed.

- wf.py: export or load a table through the copy door (out and in); its run and sql verbs stopped working when the run verb was removed from the copy door on October 25, 2026.  --next substitutes when_fire with wf_next.
- q.py: run one statement and print rows in full.
- call.py: post to an actor with the shared secret.
- mcp_call.py: call a connector verb over the protocol, with --schema for scratch work.
- carry.py: carry the first build's copies (whens, facts, bridges, sources, claims) into a schema of the new shape.
- replay_loop.py: loop the Reconciler's replay one step per call until more is false.
- clean_derived.sql: clear what the actors derived in a scratch schema, keeping the record.
- cutover.py: the cutover of October 25, step by step.
- bundle.py: print a function's files for a deploy.
- copy_out.py: export the first build's tables.
- md2docx.py: markdown to a Word file.
- read_door.sql, dispatch_door.sql: the two doors re-applied by hand on cutover day.
