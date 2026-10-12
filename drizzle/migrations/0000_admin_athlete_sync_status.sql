CREATE OR REPLACE FUNCTION public.admin_athlete_sync_status()
RETURNS TABLE(athlete_id uuid, full_name text, organization_name text, strava_connected boolean, strava_athlete_name text, last_sync_at timestamptz, last_sync_status text, last_sync_count int, strava_activities bigint, last_activity_received_at timestamptz, last_activity_start timestamptz, unmatched_activities bigint, load_date date, ctl numeric, atl numeric, tsb numeric, load_computed_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller uuid := auth.uid(); v_master boolean;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  v_master := public.has_role(v_caller, 'master_admin');
  IF NOT (v_master OR public.has_role(v_caller, 'admin')) THEN RAISE EXCEPTION 'Access denied'; END IF;
  RETURN QUERY
  WITH ath AS (
    SELECT DISTINCT ON (ur.user_id) ur.user_id, o.name AS org_name
    FROM public.user_roles ur JOIN public.organizations o ON o.id = ur.organization_id
    WHERE ur.role = 'athlete'
      AND (v_master OR ur.organization_id IN (SELECT organization_id FROM public.user_roles WHERE user_id = v_caller AND role = 'admin'))
    ORDER BY ur.user_id, o.name
  )
  SELECT a.user_id, p.full_name, a.org_name,
    sc.id IS NOT NULL, sc.athlete_name, sc.last_sync_at, sc.last_sync_status, sc.last_sync_count,
    (SELECT count(*) FROM public.strava_activities s WHERE s.user_id = a.user_id),
    (SELECT max(s.created_at) FROM public.strava_activities s WHERE s.user_id = a.user_id),
    (SELECT max(s.start_date_utc) FROM public.strava_activities s WHERE s.user_id = a.user_id),
    (SELECT count(*) FROM public.strava_activities s WHERE s.user_id = a.user_id AND s.completed_session_id IS NULL AND NOT s.ignored),
    tl.date, tl.ctl, tl.atl, tl.tsb, tl.computed_at
  FROM ath a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.strava_connections sc ON sc.user_id = a.user_id
  LEFT JOIN LATERAL (SELECT t.date, t.ctl, t.atl, t.tsb, t.computed_at FROM public.training_load_daily t WHERE t.athlete_id = a.user_id ORDER BY t.date DESC LIMIT 1) tl ON true
  ORDER BY p.full_name;
END $$;

CREATE OR REPLACE FUNCTION public.admin_recompute_training_load(_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller uuid := auth.uid(); v_row record;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT (public.has_role(v_caller, 'master_admin') OR EXISTS (
    SELECT 1 FROM public.user_roles a JOIN public.user_roles t ON t.organization_id = a.organization_id
    WHERE a.user_id = v_caller AND a.role = 'admin' AND t.user_id = _athlete_id)) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  PERFORM public.recompute_training_load(_athlete_id);
  SELECT date, ctl, atl, tsb, computed_at INTO v_row FROM public.training_load_daily WHERE athlete_id = _athlete_id ORDER BY date DESC LIMIT 1;
  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (v_caller, 'admin.recompute_training_load', 'profile', _athlete_id, '{}'::jsonb);
  RETURN jsonb_build_object('date', v_row.date, 'ctl', v_row.ctl, 'atl', v_row.atl, 'tsb', v_row.tsb, 'computed_at', v_row.computed_at);
END $$;

REVOKE ALL ON FUNCTION public.admin_athlete_sync_status() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_recompute_training_load(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_athlete_sync_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_recompute_training_load(uuid) TO authenticated;