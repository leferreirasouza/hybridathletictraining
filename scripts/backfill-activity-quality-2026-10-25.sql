-- One-off backfill for supabase/migrations/20261025000000_activity_data_quality.sql.
--
-- Re-derives discipline / duration / data_flags for every stored Strava
-- activity from its raw payload, merges recordings of the same effort into a
-- single completion, and recomputes training load once per athlete.
-- Mirrors supabase/functions/_shared/activityQuality.ts and the duplicate
-- step of matchStravaActivity() — new imports get the same treatment there.
--
-- Run with _dry_run := true first: everything (including the training-load
-- recompute) executes inside the block and is then rolled back by raising
-- the report as an exception, so the report shows exactly what the real run
-- would do. Then set _dry_run := false and run again.
--
-- The per-row trigger recompute_training_load_on_session_change recomputes
-- an athlete's whole history on every row change; it is disabled for the
-- duration of the block (transactionally) and replaced by one recompute per
-- athlete at the end.

DO $backfill$
DECLARE
  _dry_run boolean := true;
  _report text := '';
  _part text;
  _n int;
  _r record;
BEGIN
  ALTER TABLE public.completed_sessions DISABLE TRIGGER recompute_training_load_on_session_change;

  CREATE TEMP TABLE _load_before ON COMMIT DROP AS
    SELECT athlete_id, date, trimp, ctl, atl, tsb FROM public.training_load_daily;
  CREATE TEMP TABLE _cs_before ON COMMIT DROP AS
    SELECT id, athlete_id, date, discipline::text AS discipline, actual_duration_min, actual_distance_km
    FROM public.completed_sessions;

  -- 1) Activity-level classification from the stored payload.
  CREATE TEMP TABLE _aq ON COMMIT DROP AS
  WITH a AS (
    SELECT s.id, s.user_id, s.name, s.start_date_utc, s.start_date_local, s.ignored,
           s.discipline::text AS old_disc, s.duration_sec AS old_dur, s.completed_session_id,
           s.avg_hr, s.max_hr, NULLIF(p.max_hr, 0) AS ath_max,
           COALESCE(s.raw->>'external_id', '') AS ext,
           COALESCE(s.raw->>'name', s.name, '') AS nm,
           COALESCE(NULLIF(s.raw->>'sport_type', ''), s.raw->>'type', '') AS sport,
           CASE WHEN s.raw->>'workout_type' ~ '^\d+$' THEN (s.raw->>'workout_type')::int END AS wt,
           COALESCE((s.raw->>'trainer')::boolean, false) AS trainer,
           COALESCE((s.raw->>'manual')::boolean, false) AS manual,
           round((s.raw->>'moving_time')::numeric)::int AS mov,
           round((s.raw->>'elapsed_time')::numeric)::int AS el,
           COALESCE((s.raw->>'distance')::numeric, 0) AS dist,
           round((s.raw->>'average_heartrate')::numeric)::int AS ahr,
           round((s.raw->>'max_heartrate')::numeric)::int AS mhr
    FROM public.strava_activities s
    LEFT JOIN public.profiles p ON p.id = s.user_id
  ), b AS (
    SELECT a.*, (ext ~* '^roxfit-hyrox-' OR nm ~ '^HYROX - .+ - \d{1,2}:\d{2}:\d{2}$') AS race_import FROM a
  ), c AS (
    SELECT b.*,
           (race_import OR (sport IN ('Run', 'TrailRun', 'VirtualRun') AND nm ~* 'hyrox|simulad'
                            AND GREATEST(COALESCE(el, 0), COALESCE(mov, 0)) >= 2400)) AS hyrox_effort
    FROM b
  )
  SELECT c.*,
         CASE WHEN hyrox_effort THEN 'hyrox_station'
              WHEN sport IN ('Workout', 'HighIntensityIntervalTraining', 'Crossfit')
                   AND nm ~* 'hyrox|simulad|brick|sled|wall\s*ball|sandbag' THEN 'hyrox_station'
              ELSE old_disc END AS new_disc,
         CASE WHEN race_import THEN COALESCE(el, mov) ELSE COALESCE(mov, el) END AS new_dur,
         GREATEST(COALESCE(el, 0), COALESCE(mov, 0), COALESCE(old_dur, 0)) AS span,
         array_remove(ARRAY[
           CASE WHEN race_import OR wt IN (1, 11) THEN 'race' END,
           CASE WHEN dist > 0 AND (trainer OR sport IN ('VirtualRun', 'VirtualRide') OR race_import)
                THEN 'distance_estimated' END,
           CASE WHEN manual THEN 'manual_entry' END
         ], NULL) AS base_flags,
         array_remove(ARRAY[
           CASE WHEN mhr > COALESCE(ath_max + 10, 220) THEN 'max_hr_artifact' END,
           CASE WHEN ahr > 0 AND (ahr > COALESCE(ath_max, 200) OR ahr < 40 OR (mhr > 0 AND ahr > mhr))
                THEN 'hr_artifact' END
         ], NULL) AS hr_flags
  FROM c;

  SELECT string_agg(format('  %s  %s: %s -> %s', left(start_date_local::text, 10), name, old_disc, new_disc),
                    E'\n' ORDER BY start_date_local)
    INTO _part FROM _aq WHERE new_disc IS DISTINCT FROM old_disc;
  _report := _report || E'RECLASSIFIED ACTIVITIES\n' || COALESCE(_part, '  (none)') || E'\n';

  SELECT string_agg(format('  %s: %s', f, n), E'\n' ORDER BY f) INTO _part
    FROM (SELECT f, count(*) n FROM _aq, unnest(base_flags || hr_flags) f GROUP BY f) x;
  _report := _report || E'ACTIVITY FLAGS\n' || COALESCE(_part, '  (none)') || E'\n';

  UPDATE public.strava_activities s
     SET discipline = q.new_disc::public.discipline,
         duration_sec = q.new_dur,
         data_flags = q.base_flags || q.hr_flags
    FROM _aq q
   WHERE q.id = s.id
     AND (s.discipline::text IS DISTINCT FROM q.new_disc
          OR s.duration_sec IS DISTINCT FROM q.new_dur
          OR s.data_flags IS DISTINCT FROM q.base_flags || q.hr_flags);
  GET DIAGNOSTICS _n = ROW_COUNT;
  _report := _report || format(E'strava_activities rows updated: %s\n', _n);

  -- 2) Same effort recorded twice: overlapping >= 50 % of the shorter
  -- recording, both >= 5 min, both already linked to a completion.
  CREATE TEMP TABLE _edges ON COMMIT DROP AS
  SELECT x.id AS a, y.id AS b
    FROM _aq x
    JOIN _aq y ON x.user_id = y.user_id AND x.id <> y.id
   WHERE x.span >= 300 AND y.span >= 300
     AND x.start_date_utc IS NOT NULL AND y.start_date_utc IS NOT NULL
     AND NOT x.ignored AND NOT y.ignored
     AND x.completed_session_id IS NOT NULL AND y.completed_session_id IS NOT NULL
     AND EXTRACT(epoch FROM (
           LEAST(x.start_date_utc + make_interval(secs => x.span), y.start_date_utc + make_interval(secs => y.span))
           - GREATEST(x.start_date_utc, y.start_date_utc))) >= 0.5 * LEAST(x.span, y.span);

  CREATE TEMP TABLE _cluster ON COMMIT DROP AS
  WITH RECURSIVE reach(id, root) AS (
    SELECT a, a FROM _edges
    UNION
    SELECT e.b, r.root FROM reach r JOIN _edges e ON e.a = r.id
  )
  SELECT id, min(root::text)::uuid AS cluster FROM reach GROUP BY id;

  -- Survivor: the completion tied to a planned session, else a non-Strava
  -- one, else the recording with heart rate, else the longest.
  CREATE TEMP TABLE _surv ON COMMIT DROP AS
  SELECT DISTINCT ON (c.cluster) c.cluster, q.id AS survivor_id, q.completed_session_id AS survivor_cs
    FROM _cluster c
    JOIN _aq q ON q.id = c.id
    JOIN public.completed_sessions cs ON cs.id = q.completed_session_id
   ORDER BY c.cluster, (cs.planned_session_id IS NOT NULL) DESC, (cs.source <> 'strava') DESC,
            (q.avg_hr IS NOT NULL) DESC, q.new_dur DESC NULLS LAST, q.start_date_utc, q.id;

  SELECT string_agg(line, E'\n' ORDER BY d) INTO _part FROM (
    SELECT min(q.start_date_local) AS d,
           format('  %s  keep "%s"  <- merge %s', left(min(q.start_date_local)::text, 10),
                  max(q.name) FILTER (WHERE q.id = sv.survivor_id),
                  string_agg(format('"%s"', q.name), ', ' ORDER BY q.start_date_utc) FILTER (WHERE q.id <> sv.survivor_id)) AS line
      FROM _cluster c JOIN _aq q ON q.id = c.id JOIN _surv sv ON sv.cluster = c.cluster
     GROUP BY c.cluster) x;
  _report := _report || E'DUPLICATE RECORDINGS MERGED\n' || COALESCE(_part, '  (none)') || E'\n';

  UPDATE public.strava_activities s
     SET completed_session_id = sv.survivor_cs, duplicate_of = sv.survivor_id
    FROM _cluster c JOIN _surv sv ON sv.cluster = c.cluster
   WHERE s.id = c.id AND s.id <> sv.survivor_id;

  -- Orphaned completions: only ones the import itself created, with nothing
  -- the athlete typed in and no planned session attached.
  DELETE FROM public.completed_sessions cs
   WHERE cs.id IN (SELECT q.completed_session_id FROM _cluster c JOIN _aq q ON q.id = c.id)
     AND cs.source = 'strava' AND cs.planned_session_id IS NULL
     AND cs.rpe IS NULL AND cs.soreness IS NULL AND NOT cs.pain_flag AND cs.pain_notes IS NULL
     AND NOT EXISTS (SELECT 1 FROM public.strava_activities s WHERE s.completed_session_id = cs.id);
  GET DIAGNOSTICS _n = ROW_COUNT;
  _report := _report || format(E'Duplicate completions deleted: %s\n', _n);

  -- 3) Completion-level values from everything now linked to it.
  CREATE TEMP TABLE _ct ON COMMIT DROP AS
  SELECT s.completed_session_id AS cs_id,
         bool_or(q.new_disc = 'hyrox_station') AS any_hyrox,
         max(q.new_dur) FILTER (WHERE q.race_import) AS race_dur,
         max(q.ahr) AS any_avg_hr,
         max(q.mhr) AS any_max_hr,
         COALESCE((SELECT array_agg(DISTINCT f ORDER BY f)
                     FROM public.strava_activities s2 JOIN _aq q2 ON q2.id = s2.id, unnest(q2.base_flags) f
                    WHERE s2.completed_session_id = s.completed_session_id), '{}') AS flags
    FROM public.strava_activities s
    JOIN _aq q ON q.id = s.id
   WHERE s.completed_session_id IS NOT NULL
   GROUP BY s.completed_session_id;

  UPDATE public.completed_sessions cs
     SET discipline = CASE WHEN cs.source = 'strava' AND t.any_hyrox THEN 'hyrox_station'::public.discipline
                           ELSE cs.discipline END,
         actual_duration_min = CASE WHEN cs.source = 'strava' AND t.race_dur IS NOT NULL
                                    THEN round(t.race_dur / 60.0) ELSE cs.actual_duration_min END,
         avg_hr = COALESCE(cs.avg_hr, t.any_avg_hr),
         max_hr = COALESCE(cs.max_hr, t.any_max_hr),
         data_flags = (SELECT COALESCE(array_agg(DISTINCT f ORDER BY f), '{}')
                         FROM unnest(cs.data_flags || t.flags) f)
    FROM _ct t
   WHERE t.cs_id = cs.id;

  -- HR plausibility on each completion's final values, for every athlete.
  UPDATE public.completed_sessions cs
     SET data_flags = (SELECT COALESCE(array_agg(DISTINCT f ORDER BY f), '{}') FROM unnest(
           cs.data_flags || array_remove(ARRAY[
             CASE WHEN cs.max_hr > COALESCE(NULLIF(p.max_hr, 0) + 10, 220) THEN 'max_hr_artifact' END,
             CASE WHEN cs.avg_hr > 0 AND (cs.avg_hr > COALESCE(NULLIF(p.max_hr, 0), 200) OR cs.avg_hr < 40
                                          OR (cs.max_hr > 0 AND cs.avg_hr > cs.max_hr))
                  THEN 'hr_artifact' END
           ], NULL)) f)
    FROM public.profiles p
   WHERE p.id = cs.athlete_id;

  SELECT string_agg(format('  %s: %s', f, n), E'\n' ORDER BY f) INTO _part
    FROM (SELECT f, count(*) n FROM public.completed_sessions, unnest(data_flags) f GROUP BY f) x;
  _report := _report || E'COMPLETION FLAGS\n' || COALESCE(_part, '  (none)') || E'\n';

  SELECT string_agg(format('  %s  %s -> %s, %s -> %s min', left(b.date::text, 10), b.discipline, cs.discipline,
                           b.actual_duration_min, cs.actual_duration_min), E'\n' ORDER BY b.date)
    INTO _part
    FROM _cs_before b JOIN public.completed_sessions cs ON cs.id = b.id
   WHERE b.discipline <> cs.discipline::text OR b.actual_duration_min IS DISTINCT FROM cs.actual_duration_min;
  _report := _report || E'COMPLETIONS CHANGED (discipline, duration)\n' || COALESCE(_part, '  (none)') || E'\n';

  ALTER TABLE public.completed_sessions ENABLE TRIGGER recompute_training_load_on_session_change;

  FOR _r IN SELECT DISTINCT athlete_id FROM public.completed_sessions LOOP
    PERFORM public.recompute_training_load(_r.athlete_id);
  END LOOP;

  -- Run km over the trailing 8 weeks, before vs after (what generate-plan ramps from).
  SELECT string_agg(format('  athlete %s: %s km -> %s km', left(x.athlete_id::text, 8), x.before_km, x.after_km), E'\n')
    INTO _part FROM (
      SELECT b.athlete_id,
             round(sum(b.actual_distance_km) FILTER (WHERE b.discipline = 'run'), 1) AS before_km,
             (SELECT round(sum(actual_distance_km), 1) FROM public.completed_sessions c
               WHERE c.athlete_id = b.athlete_id AND c.discipline = 'run' AND c.date > CURRENT_DATE - 56) AS after_km
        FROM _cs_before b WHERE b.date > CURRENT_DATE - 56
       GROUP BY b.athlete_id) x
   WHERE x.before_km IS DISTINCT FROM x.after_km;
  _report := _report || E'RUN KM, LAST 8 WEEKS\n' || COALESCE(_part, '  (unchanged)') || E'\n';

  SELECT string_agg(format('  %s  trimp %s -> %s', b.date, round(b.trimp), round(t.trimp)), E'\n' ORDER BY b.date)
    INTO _part
    FROM _load_before b JOIN public.training_load_daily t ON t.athlete_id = b.athlete_id AND t.date = b.date
   WHERE abs(COALESCE(b.trimp, 0) - COALESCE(t.trimp, 0)) >= 1;
  _report := _report || E'DAILY TRIMP CHANGES\n' || COALESCE(_part, '  (none)') || E'\n';

  SELECT string_agg(format('  athlete %s on %s: CTL %s -> %s, ATL %s -> %s, TSB %s -> %s',
                           left(b.athlete_id::text, 8), b.date, round(b.ctl, 1), round(t.ctl, 1),
                           round(b.atl, 1), round(t.atl, 1), round(b.tsb, 1), round(t.tsb, 1)), E'\n')
    INTO _part
    FROM _load_before b JOIN public.training_load_daily t ON t.athlete_id = b.athlete_id AND t.date = b.date
   WHERE b.date = (SELECT max(date) FROM _load_before l WHERE l.athlete_id = b.athlete_id)
     AND (round(b.ctl, 1) IS DISTINCT FROM round(t.ctl, 1) OR round(b.atl, 1) IS DISTINCT FROM round(t.atl, 1));
  _report := _report || E'LATEST LOAD\n' || COALESCE(_part, '  (unchanged)') || E'\n';

  IF _dry_run THEN
    RAISE EXCEPTION E'DRY RUN — rolled back, nothing written.\n%', _report;
  END IF;
  RAISE NOTICE '%', _report;
END
$backfill$;
