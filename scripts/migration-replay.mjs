// =============================================================================
// Replays the ENTIRE migration history against a real (throwaway) Postgres,
// seeding production-shaped data at three points so the historical data
// migrations run against real rows, then asserts the resulting schema behaves.
//
// This catches the class of defect that `tsc`, eslint and the Supabase linter
// cannot see: a backfill that drops rows, a trigger that rejects legitimate
// writes, an RLS policy that opens or closes too far. It found exactly that
// during the 20260802110001 restructure — an events-wide BEFORE UPDATE trigger
// calling is_admin() would have rejected every future migration and
// service-role write, because those carry no end-user JWT.
//
// Run it with `npm run db:test`, and always before `npm run db:push`. CI runs
// it automatically on any change under supabase/migrations/ (see
// .github/workflows/db-migrations.yml). No Docker and no Supabase project
// required — embedded-postgres ships the server binary in its npm tarball.
//
// Exits non-zero if any assertion fails. Nothing here touches the real
// database — the cluster is created in a temp dir and destroyed on exit.
//
// When you add a migration that changes the shape of the seeded data, the
// end-state assertions below are what you update; treat them as the spec.
// =============================================================================
import EmbeddedPostgres from 'embedded-postgres';
import pgModule from 'pg';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// int8 arrives as a string by default; every id here fits in a JS number.
// Must be set on the same pg instance embedded-postgres builds its client from.
pgModule.types.setTypeParser(20, Number);

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const DATA_DIR = mkdtempSync(join(tmpdir(), 'lpl-migration-replay-'));

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: 'postgres',
  password: 'postgres',
  port: 54999,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase('app');
const db = pg.getPgClient('app');
await db.connect();

// NOTE: `process.exitCode` alone does NOT work here. embedded-postgres depends
// on async-exit-hook, which patches process.exit and forces status 0 on a
// natural exit — so a failing run would report success and CI would pass a
// broken migration. The finally block below calls process.exit() explicitly.
// Verified empirically: exitCode -> 0, process.exit() -> 1.
let failures = 0;
const fail = (msg) => { console.error(`\n✗ ${msg}`); failures++; };

try {
  // ─── Supabase environment stubs ──────────────────────────────────────────
  await db.query(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE ROLE service_role NOLOGIN;
    CREATE SCHEMA extensions;
    CREATE EXTENSION pgcrypto SCHEMA extensions;
    -- Supabase puts pgcrypto in extensions but also exposes it unqualified via
    -- the default search_path; mirror that so unpinned callers resolve.
    CREATE SCHEMA auth;
    -- Session-settable stand-ins for the real GoTrue helpers.
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT COALESCE(NULLIF(current_setting('test.jwt', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT NULLIF(current_setting('test.uid', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA public, extensions, auth TO anon, authenticated, service_role;
    ALTER DATABASE app SET search_path TO public, extensions;
  `);
  await db.query(`SET search_path TO public, extensions`);

  // Supabase grants anon/authenticated a broad default SELECT on new tables in
  // public — the exact behavior CLAUDE.md warns about. Reproduce it so RLS is
  // the only boundary here too.
  await db.query(`
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
  `);

  // ─── Replay history ──────────────────────────────────────────────────────
  // Data is seeded at three points so the historical data-migration paths run
  // against real rows (the matchday→events restructure, the award-column →
  // resolutions seeding, the finances split), not just an empty schema.
  const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql')).sort();
  const seedPoints = new Map([
    [files.find((f) => f.startsWith('20260212013729')), seedPlayers],
    [files.find((f) => f.startsWith('20260323003602')), seedMatchdayEra],
    [files.find((f) => f.startsWith('20260802100003')), seed],
  ]);
  let seeded = 0;

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8');
    try {
      await db.query('BEGIN');
      await db.query(sql);
      await db.query('COMMIT');
    } catch (e) {
      await db.query('ROLLBACK');
      fail(`migration ${file} failed: ${e.message}`);
      throw e;
    }
    const seeder = seedPoints.get(file);
    if (seeder) { await seeder(db); seeded++; }
  }
  if (seeded !== 3) fail(`only ${seeded}/3 seed points reached — check migration ordering`);

  await assertions(db);
} finally {
  await db.end();
  await pg.stop();
  rmSync(DATA_DIR, { recursive: true, force: true });
  // Write through the callback so the summary is flushed before exiting; a
  // bare process.exit() can truncate output when stdout is a pipe (i.e. CI).
  const summary = failures === 0
    ? '\nAll migration-replay assertions passed.\n'
    : `\n${failures} assertion(s) FAILED — do not push these migrations.\n`;
  process.stdout.write(summary, () => process.exit(failures === 0 ? 0 : 1));
}

// ─── Seed 1: players, at the very first migration ─────────────────────────
async function seedPlayers(db) {
  await db.query(`
    INSERT INTO players (id, name, gender, rating) OVERRIDING SYSTEM VALUE VALUES
      (1,'Ana','female',7),
      (2,'Beto','male',6),
      (3,'Caro','female',5),
      (4,'Dani','male',4),
      (5,'Eva','female',8),
      (6,'Fede','male',6);
    SELECT setval(pg_get_serial_sequence('players','id'), 6);
  `);
}

// ─── Seed 2: a matchday, in the pre-events schema ─────────────────────────
// Exercises the matchday→events restructure and the award-column→resolutions
// seeding on real rows. This matchday becomes event 1 (a 'match').
async function seedMatchdayEra(db) {
  await db.query(`
    INSERT INTO locations (id, name, maps_url) OVERRIDING SYSTEM VALUE VALUES
      (1,'Cancha Uno','https://maps.example/1'),
      (2,'Cancha Dos','https://maps.example/2');
    SELECT setval(pg_get_serial_sequence('locations','id'), 2);

    INSERT INTO matchdays (id, name, played_at, played_at_time, location_id, short_id, cost, payee_alias_cbu, mvp_id)
      OVERRIDING SYSTEM VALUE
      VALUES (1,'Partido','2026-01-10','20:00',1,'aaaaaa1',20000,'ana.mp',1);
    SELECT setval(pg_get_serial_sequence('matchdays','id'), 1);

    INSERT INTO matchday_teams (id, matchday_id, name, shirt_color) OVERRIDING SYSTEM VALUE VALUES
      (1,1,'Claros','light'), (2,1,'Oscuros','dark');
    SELECT setval(pg_get_serial_sequence('matchday_teams','id'), 2);

    INSERT INTO matchday_team_players (matchday_team_id, player_id) VALUES (1,1),(1,2),(2,3),(2,4);
    INSERT INTO matchday_reserves (matchday_id, player_id) VALUES (1,5);
    UPDATE matchdays SET winning_team_id = 1 WHERE id = 1;
  `);
}

// ─── Seed 3: the remaining event types, just before the restructure ───────
async function seed(db) {
  await db.query(`
    UPDATE players SET tier='core',     email='ana@x.com',  role='admin'     WHERE id=1;
    UPDATE players SET tier='core',     email='beto@x.com', role='moderator' WHERE id=2;
    UPDATE players SET tier='sporadic'                                       WHERE id=3;
    UPDATE players SET tier='guest',    rating=NULL                          WHERE id=4;

    -- played_at in the past so vote windows are closed.
    INSERT INTO events (id, short_id, name, type, played_at, played_at_time, location_id)
      OVERRIDING SYSTEM VALUE VALUES
      (2,'aaaaaa2','Entrena','training','2026-01-11','19:00',1),
      (3,'aaaaaa3','Torneo','tournament','2026-01-12','18:00',2),
      (4,'aaaaaa4','Externo','external_match','2026-01-13','21:00',2),
      (5,'aaaaaa5','Asado','social','2026-01-14','22:00',NULL);
    SELECT setval(pg_get_serial_sequence('events','id'), 5);

    -- Training: attendees + coaches.
    INSERT INTO trainings (id, event_id) OVERRIDING SYSTEM VALUE VALUES (1,2);
    SELECT setval(pg_get_serial_sequence('trainings','id'), 1);
    INSERT INTO training_attendees (training_id, player_id) VALUES (1,1),(1,3);
    INSERT INTO training_coaches (training_id, player_id) VALUES (1,2);

    -- Tournament: three teams (ids overlapping match_teams ids on purpose —
    -- this is exactly what the tagged-source backfill mapping must survive),
    -- fixtures, a winner and a reserve.
    INSERT INTO tournaments (id, event_id) OVERRIDING SYSTEM VALUE VALUES (1,3);
    SELECT setval(pg_get_serial_sequence('tournaments','id'), 1);
    INSERT INTO tournament_teams (id, tournament_id, name) OVERRIDING SYSTEM VALUE VALUES
      (1,1,'Rojo'), (2,1,'Verde'), (3,1,'Azul');
    SELECT setval(pg_get_serial_sequence('tournament_teams','id'), 3);
    INSERT INTO tournament_team_players (tournament_team_id, player_id) VALUES (1,1),(2,2),(3,3);
    INSERT INTO tournament_reserves (tournament_id, player_id) VALUES (1,6);
    INSERT INTO tournament_matches (id, tournament_id, team_a_id, team_b_id, score_a, score_b)
      OVERRIDING SYSTEM VALUE VALUES (1,1,1,2,3,1), (2,1,2,3,NULL,NULL);
    SELECT setval(pg_get_serial_sequence('tournament_matches','id'), 2);
    UPDATE tournaments SET winning_team_id = 2 WHERE id = 1;

    -- External match: roster with goals + reserves with goals.
    INSERT INTO external_teams (id, name) OVERRIDING SYSTEM VALUE VALUES (1,'Los Pibes');
    SELECT setval(pg_get_serial_sequence('external_teams','id'), 1);
    INSERT INTO external_matches (id, event_id, external_team_id, our_score, their_score)
      OVERRIDING SYSTEM VALUE VALUES (1,4,1,3,2);
    SELECT setval(pg_get_serial_sequence('external_matches','id'), 1);
    INSERT INTO external_match_players (external_match_id, player_id, goals) VALUES (1,1,2),(1,2,1);
    INSERT INTO external_match_reserves (external_match_id, player_id, goals) VALUES (1,5,0);

    -- Award history: the mvp resolution for event 1 was seeded by the historical
    -- migration from matchdays.mvp_id. Add votes so the removal guard has both
    -- kinds of protected participant (award holder AND vote candidate).
    INSERT INTO event_award_votes (event_id, award_type, voter_player_id, candidate_player_id, cast_at)
      VALUES (1,'top_scorer',2,3,now());

    -- Media with tags, to exercise the tag dedup path.
    INSERT INTO media (id, event_id, storage_path, thumbnail_path, taken_at, media_type, aspect_ratio)
      OVERRIDING SYSTEM VALUE VALUES
      (1,1,'full/00000000-0000-4000-8000-000000000001.jpg',
           'thumb/00000000-0000-4000-8000-000000000001.jpg','2026-01-10','image',1.5),
      (2,1,'full/00000000-0000-4000-8000-000000000002.jpg',
           'thumb/00000000-0000-4000-8000-000000000002.jpg','2026-01-10','image',1.5);
    SELECT setval(pg_get_serial_sequence('media','id'), 2);
    INSERT INTO media_tags (id, name) OVERRIDING SYSTEM VALUE VALUES (1,'asado'),(2,'Asado'),(3,'gol');
    SELECT setval(pg_get_serial_sequence('media_tags','id'), 3);
    -- media 1 carries BOTH case variants: the merge must not create a duplicate PK.
    INSERT INTO media_tag_assignments (media_id, tag_id) VALUES (1,1),(1,2),(2,2),(2,3);
    INSERT INTO media_player_tags (media_id, player_id) VALUES (1,1);
  `);

  // Duplicate location names, inserted separately so the earlier block stays
  // valid if a future migration adds the unique index sooner.
  await db.query(`
    INSERT INTO locations (id, name, maps_url) OVERRIDING SYSTEM VALUE
      VALUES (3,'cancha uno','https://maps.example/dup');
    SELECT setval(pg_get_serial_sequence('locations','id'), 3);
    UPDATE events SET location_id = 3 WHERE id = 5;
  `);
  console.log('seeded pre-restructure data');
}

// ─── Post-migration assertions ────────────────────────────────────────────
async function assertions(db) {
  const one = async (sql, params) => (await db.query(sql, params)).rows[0];
  const all = async (sql, params) => (await db.query(sql, params)).rows;
  const check = (name, ok, detail = '') => {
    if (ok) console.log(`  ✓ ${name}`);
    else fail(`${name}${detail ? ` — ${detail}` : ''}`);
  };

  console.log('\nStructure:');
  const gone = await all(`
    SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename = ANY($1)`,
    [['matches','trainings','tournaments','match_teams','tournament_teams',
      'match_team_players','match_reserves','training_attendees','training_coaches',
      'tournament_team_players','tournament_reserves','external_match_players',
      'external_match_reserves']]);
  check('old per-type tables dropped', gone.length === 0, gone.map((r) => r.tablename).join(','));

  const kind = await one(`SELECT relkind FROM pg_class WHERE relname='event_participants'`);
  check('event_participants is a TABLE', kind.relkind === 'r', `relkind=${kind.relkind}`);

  const funcs = await all(`
    SELECT proname FROM pg_proc WHERE proname LIKE '\\_check%removal'`);
  check('one removal trigger function remains',
    funcs.length === 1 && funcs[0].proname === '_check_event_participant_removal',
    funcs.map((f) => f.proname).join(','));

  console.log('\nBackfill:');
  const counts = await one(`
    SELECT
      (SELECT count(*) FROM event_participants) AS participants,
      (SELECT count(*) FROM event_participants WHERE kind='team_member') AS team_members,
      (SELECT count(*) FROM event_participants WHERE kind='reserve') AS reserves,
      (SELECT count(*) FROM event_participants WHERE kind='attendee') AS attendees,
      (SELECT count(*) FROM event_participants WHERE kind='coach') AS coaches,
      (SELECT count(*) FROM event_teams) AS teams`);
  // 4 match team players + 3 tournament + 2 external = 9 team_members;
  // 1 match + 1 tournament + 1 external = 3 reserves; 2 attendees; 1 coach.
  check('team_member count', Number(counts.team_members) === 9, `got ${counts.team_members}`);
  check('reserve count', Number(counts.reserves) === 3, `got ${counts.reserves}`);
  check('attendee count', Number(counts.attendees) === 2, `got ${counts.attendees}`);
  check('coach count', Number(counts.coaches) === 1, `got ${counts.coaches}`);
  check('event_teams count', Number(counts.teams) === 5, `got ${counts.teams}`);

  // The overlapping old team ids (match_teams 1,2 vs tournament_teams 1,2,3)
  // must have landed on the right events.
  const teamEvents = await all(`SELECT event_id, name, shirt_color FROM event_teams ORDER BY id`);
  check('match teams kept shirt colors and event',
    teamEvents.filter((t) => t.event_id === 1).every((t) => t.shirt_color !== null)
    && teamEvents.filter((t) => t.event_id === 1).length === 2);
  check('tournament teams have no shirt color',
    teamEvents.filter((t) => t.event_id === 3).every((t) => t.shirt_color === null)
    && teamEvents.filter((t) => t.event_id === 3).length === 3);

  const winners = await all(`
    SELECT e.id, e.winning_team_id, t.name FROM events e
    LEFT JOIN event_teams t ON t.id = e.winning_team_id ORDER BY e.id`);
  check('match winner remapped to Claros',
    winners.find((w) => w.id === 1)?.name === 'Claros',
    JSON.stringify(winners.find((w) => w.id === 1)));
  check('tournament winner remapped to Verde',
    winners.find((w) => w.id === 3)?.name === 'Verde',
    JSON.stringify(winners.find((w) => w.id === 3)));

  const goals = await all(`
    SELECT player_id, kind, goals FROM event_participants WHERE event_id=4 ORDER BY player_id`);
  check('external-match goals preserved',
    goals.length === 3 && goals[0].goals === 2 && goals[1].goals === 1
    && goals.find((g) => g.player_id === 5)?.kind === 'reserve',
    JSON.stringify(goals));

  const fixtures = await all(`
    SELECT tm.event_id, a.name AS a, b.name AS b, tm.score_a FROM tournament_matches tm
    JOIN event_teams a ON a.id = tm.team_a_id JOIN event_teams b ON b.id = tm.team_b_id
    ORDER BY tm.id`);
  check('fixtures re-keyed to event with correct teams',
    fixtures.length === 2 && fixtures[0].event_id === 3
    && fixtures[0].a === 'Rojo' && fixtures[0].b === 'Verde' && fixtures[0].score_a === 3
    && fixtures[1].a === 'Verde' && fixtures[1].b === 'Azul',
    JSON.stringify(fixtures));

  console.log('\nWinner RPC:');
  // Mods have no direct UPDATE on events; the RPC owns this one column.
  // is_mod_or_admin() reads the caller's JWT email, so act as the seeded mod.
  const asMod = `SET test.jwt = '{"email":"beto@x.com"}'`;
  const eventTeam1 = (await one(`SELECT id FROM event_teams WHERE event_id=1 ORDER BY id DESC LIMIT 1`)).id;
  await db.query(asMod);
  check('a mod can set a winner via the RPC',
    await succeeds(db, `SELECT set_event_winner(1, $1)`, [eventTeam1]));
  check('winner actually changed',
    (await one(`SELECT winning_team_id FROM events WHERE id=1`)).winning_team_id === eventTeam1);
  check('set_event_winner(NULL) clears it', await succeeds(db, `SELECT set_event_winner(1, NULL)`));
  check('winner cleared',
    (await one(`SELECT winning_team_id FROM events WHERE id=1`)).winning_team_id === null);

  const foreignTeam = (await one(`SELECT id FROM event_teams WHERE event_id=3 LIMIT 1`)).id;
  check("set_event_winner rejects another event's team",
    await rejects(db, `SELECT set_event_winner(1, $1)`, [foreignTeam]));

  // Restore the original winner while still acting as the mod.
  await db.query(`SELECT set_event_winner(1, $1)`, [
    (await one(`SELECT id FROM event_teams WHERE event_id=1 AND name='Claros'`)).id]);

  await db.query(`SET test.jwt = '{"email":"caro@nobody.com"}'`);
  const refusedBasic = await rejects(db, `SELECT set_event_winner(1, $1)`, [eventTeam1]);
  await db.query(`SET test.jwt = ''`);
  const refusedAnon = await rejects(db, `SELECT set_event_winner(1, $1)`, [eventTeam1]);
  check('set_event_winner refuses a basic user', refusedBasic);
  check('set_event_winner refuses a caller with no JWT', refusedAnon);

  // A mod must still have NO direct write path to events.
  await db.query(asMod);
  await db.query(`SET ROLE authenticated`);
  const modDirect = await rejectsOrNoop(db, `UPDATE events SET name='hacked' WHERE id=1`);
  const modFinances = await all(`SELECT count(*)::int AS n FROM event_finances`);
  await db.query(`RESET ROLE`);
  await db.query(`SET test.jwt = ''`);
  check('a mod cannot UPDATE events directly', modDirect);
  check('a mod can still read event_finances', modFinances[0].n > 0);

  console.log('\nPlayer deletion never erases history silently:');
  // Player 3 is a match team member AND a photo-tagged player; player 1 holds
  // the historical mvp resolution. Both must refuse deletion with a reason.
  const blocked = await rejectsWith(db, `DELETE FROM players WHERE id=3`);
  check('deleting a player with history is refused', blocked.rejected);
  check('refusal names the player and the reason in Spanish',
    /No se puede eliminar a Caro porque participó en 3 fechas/.test(blocked.message),
    blocked.message);
  check('refusal mentions only what actually blocks',
    !/foto/.test(blocked.message), blocked.message);
  check('refusal uses no gendered pronoun',
    !/\b(quitalo|quitala|etiquetad[oa])\b/i.test(blocked.message), blocked.message);

  const awarded = await rejectsWith(db, `DELETE FROM players WHERE id=1`);
  check('an award holder is refused too, citing every reason',
    awarded.rejected && /ganó 1 premio,/.test(awarded.message)
    && /tiene 1 etiqueta en fotos/.test(awarded.message), awarded.message);

  // A player with no history at all must still be deletable, or admins can
  // never clean up a mistyped roster entry.
  await db.query(
    `INSERT INTO players (name, gender, tier) VALUES ('Tipo Error', 'male', 'guest')`);
  check('a player with no history still deletes',
    await succeeds(db, `DELETE FROM players WHERE name='Tipo Error'`));

  const fks = await all(`
    SELECT c.conname, c.confdeltype FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE c.contype='f' AND c.confrelid='players'::regclass
      AND t.relname IN ('event_participants','media_player_tags','event_award_resolutions')`);
  check('history FKs are RESTRICT (r), not CASCADE',
    fks.length === 3 && fks.every((f) => f.confdeltype === 'r'),
    JSON.stringify(fks));

  console.log('\nMaintenance writes are not blocked:');
  // Regression: an events-wide BEFORE UPDATE trigger calling is_admin() would
  // reject every migration/service-role write, since those carry no JWT.
  check('owner can UPDATE events directly',
    await succeeds(db, `UPDATE events SET name = name WHERE id = 1`));
  // The delete guard is an integrity check, not a permission check, so it must
  // not consult is_admin() — that is what made the events trigger unusable.
  const guardSrc = (await one(
    `SELECT prosrc FROM pg_proc WHERE proname='_explain_player_delete_block'`)).prosrc;
  check('player delete guard does not depend on the caller identity',
    !/is_admin|is_mod_or_admin|auth\./.test(guardSrc));
  const triggers = await all(`
    SELECT tgname FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
    WHERE c.relname='events' AND NOT t.tgisinternal`);
  check('no user trigger left on events', triggers.length === 0,
    triggers.map((t) => t.tgname).join(','));
  const deadFn = await all(`
    SELECT proname FROM pg_proc WHERE proname='restrict_non_admin_to_winning_team_id_only'`);
  check('dead column-restriction function dropped', deadFn.length === 0);

  console.log('\nIntegrity constraints:');
  // A team from another event must not be acceptable as a winner.
  const otherTeam = foreignTeam;
  check('cross-event winner rejected',
    await rejects(db, `UPDATE events SET winning_team_id=$1 WHERE id=1`, [otherTeam]));
  check('cross-event participant team rejected',
    await rejects(db,
      `INSERT INTO event_participants (event_id, player_id, kind, team_id) VALUES (1,6,'team_member',$1)`,
      [otherTeam]));
  check('non-team_member with a team rejected',
    await rejects(db,
      `INSERT INTO event_participants (event_id, player_id, kind, team_id)
       SELECT 1, 6, 'reserve', id FROM event_teams WHERE event_id=1 LIMIT 1`));
  check('duplicate participant rejected',
    await rejects(db,
      `INSERT INTO event_participants (event_id, player_id, kind) VALUES (1,1,'reserve')`));
  check('unknown event type rejected',
    await rejects(db,
      `INSERT INTO events (short_id,type,played_at,played_at_time) VALUES ('zzzzzz1','bbq','2026-02-01','20:00')`));

  console.log('\nAward-removal guard (one trigger for every kind):');
  // Player 1 holds a resolved MVP on event 1: removal must raise, move must not.
  check('removing an awarded participant raises',
    await rejects(db, `DELETE FROM event_participants WHERE event_id=1 AND player_id=1`));
  check('removing a vote-receiving candidate raises',
    await rejects(db, `DELETE FROM event_participants WHERE event_id=1 AND player_id=3`));
  check('moving an awarded participant is allowed', await succeeds(db, `
    UPDATE event_participants SET kind='reserve', team_id=NULL WHERE event_id=1 AND player_id=1`));
  check('removing an unawarded participant is allowed', await succeeds(db,
    `DELETE FROM event_participants WHERE event_id=1 AND player_id=4`));
  check('deleting the whole event still cascades', await succeeds(db,
    `DELETE FROM events WHERE id=1`));

  console.log('\nCapabilities table drives the vote window:');
  const windows = await all(`
    SELECT e.id, e.type, w.state FROM events e
    CROSS JOIN LATERAL _event_vote_window(e.id) w ORDER BY e.id`);
  const stateOf = (id) => windows.find((w) => w.id === id)?.state;
  check('tournament votable → closed window', stateOf(3) === 'closed', stateOf(3));
  check('training not votable → n/a', stateOf(2) === 'n/a', stateOf(2));
  check('external_match not votable → n/a', stateOf(4) === 'n/a', stateOf(4));
  check('social not votable → n/a', stateOf(5) === 'n/a', stateOf(5));

  // Flip a capability and confirm the window follows the data, not code.
  await db.query(`UPDATE event_types SET votable=true WHERE type='training'`);
  const flipped = await one(`SELECT state FROM _event_vote_window(2)`);
  check('flipping event_types.votable changes the window', flipped.state === 'closed', flipped.state);
  await db.query(`UPDATE event_types SET votable=false WHERE type='training'`);

  console.log('\nHardening:');
  const tags = await all(`SELECT id, name FROM media_tags ORDER BY id`);
  check('case-duplicate tag merged', tags.length === 2, JSON.stringify(tags));
  const assigns = await all(`SELECT media_id, tag_id FROM media_tag_assignments ORDER BY media_id, tag_id`);
  check('tag assignments re-pointed without duplicates',
    assigns.length === 3 && assigns.filter((a) => a.media_id === 1).length === 1,
    JSON.stringify(assigns));
  check('case-insensitive tag uniqueness enforced',
    await rejects(db, `INSERT INTO media_tags (name) VALUES ('ASADO')`));

  const locs = await all(`SELECT id, name FROM locations ORDER BY id`);
  check('case-duplicate location merged', locs.length === 2, JSON.stringify(locs));
  const movedEvent = await one(`SELECT location_id FROM events WHERE id=5`);
  check('event re-pointed to surviving location', movedEvent.location_id === 1,
    `location_id=${movedEvent.location_id}`);
  check('case-insensitive location uniqueness enforced',
    await rejects(db, `INSERT INTO locations (name, maps_url) VALUES ('CANCHA UNO','https://x')`));

  const audited = await all(`
    SELECT table_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name='created_at' ORDER BY table_name`);
  check('created_at added broadly', audited.length === 10, `${audited.length} tables`);

  const short = await one(`
    INSERT INTO events (name,type,played_at,played_at_time) VALUES ('X','social','2026-03-01','20:00')
    RETURNING short_id`);
  check('short_id default still generates', /^[0-9a-f]{7}$/.test(short.short_id), short.short_id);

  console.log('\nRLS / exposure:');
  const rlsOff = await all(`
    SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND NOT c.relrowsecurity`);
  check('every public table has RLS enabled', rlsOff.length === 0,
    rlsOff.map((r) => r.relname).join(','));

  const etPolicies = await all(`SELECT policyname FROM pg_policies WHERE tablename='event_types'`);
  check('event_types is deny-all (no policies)', etPolicies.length === 0);

  // Read event_types as anon: RLS with zero policies must yield nothing even
  // though the default grant lets the role reach the table.
  await db.query(`SET ROLE anon`);
  const anonRows = await all(`SELECT * FROM event_types`);
  const anonParticipants = await all(`SELECT count(*)::int AS n FROM event_participants`);
  await db.query(`RESET ROLE`);
  check('anon cannot read event_types', anonRows.length === 0, `${anonRows.length} rows`);
  check('anon can still read event_participants', anonParticipants[0].n > 0);
}

async function rejects(db, sql, params) {
  try {
    await db.query('BEGIN');
    await db.query(sql, params);
    await db.query('COMMIT');
    return false;
  } catch {
    await db.query('ROLLBACK');
    return true;
  }
}

// Like rejects(), but keeps the error text so assertions can check the message
// an admin would actually read.
async function rejectsWith(db, sql, params) {
  try {
    await db.query('BEGIN');
    await db.query(sql, params);
    await db.query('COMMIT');
    return { rejected: false, message: '(no error raised)' };
  } catch (e) {
    await db.query('ROLLBACK');
    return { rejected: true, message: e.message };
  }
}

// RLS makes a forbidden UPDATE affect zero rows rather than raise; either
// outcome means "no write happened".
async function rejectsOrNoop(db, sql, params) {
  try {
    await db.query('BEGIN');
    const res = await db.query(sql, params);
    await db.query('ROLLBACK');
    return res.rowCount === 0;
  } catch {
    await db.query('ROLLBACK');
    return true;
  }
}

async function succeeds(db, sql, params) {
  try {
    await db.query('BEGIN');
    await db.query(sql, params);
    await db.query('COMMIT');
    return true;
  } catch (e) {
    await db.query('ROLLBACK');
    console.error(`    (${e.message})`);
    return false;
  }
}
