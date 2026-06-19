
CREATE OR REPLACE FUNCTION public.admin_delete_athlete(_athlete_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_name text;
  v_deleted jsonb := '{}'::jsonb;
  v_count int;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT (public.has_role(v_caller, 'master_admin') OR public.has_role(v_caller, 'admin')) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  IF _athlete_id = v_caller THEN
    RAISE EXCEPTION 'You cannot delete your own account through this action';
  END IF;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = _athlete_id;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Athlete not found';
  END IF;

  -- Delete from leaf tables first (those without cascading from parents)
  DELETE FROM public.completed_sessions WHERE athlete_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('completed_sessions', v_count);

  DELETE FROM public.session_substitutions WHERE athlete_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('session_substitutions', v_count);

  DELETE FROM public.planned_sessions WHERE athlete_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('planned_sessions', v_count);

  -- Plans created for or by the athlete
  DELETE FROM public.plan_versions WHERE created_by = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('plan_versions', v_count);

  DELETE FROM public.training_plans WHERE created_by = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('training_plans', v_count);

  DELETE FROM public.coach_athlete_assignments WHERE athlete_id = _athlete_id OR coach_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('coach_athlete_assignments', v_count);

  DELETE FROM public.direct_messages WHERE sender_id = _athlete_id OR recipient_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('direct_messages', v_count);

  DELETE FROM public.ai_messages WHERE thread_id IN (SELECT id FROM public.ai_threads WHERE user_id = _athlete_id);
  DELETE FROM public.ai_threads WHERE user_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('ai_threads', v_count);

  DELETE FROM public.race_results WHERE athlete_id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('race_results', v_count);

  DELETE FROM public.parq_responses WHERE athlete_id = _athlete_id;
  DELETE FROM public.fitness_assessments WHERE athlete_id = _athlete_id;
  DELETE FROM public.garmin_activities WHERE user_id = _athlete_id;
  DELETE FROM public.garmin_dailies WHERE user_id = _athlete_id;
  DELETE FROM public.garmin_sleep WHERE user_id = _athlete_id;
  DELETE FROM public.garmin_connections WHERE user_id = _athlete_id;
  DELETE FROM public.strava_connections WHERE user_id = _athlete_id;
  DELETE FROM public.user_roles WHERE user_id = _athlete_id;

  DELETE FROM public.profiles WHERE id = _athlete_id;
  GET DIAGNOSTICS v_count = ROW_COUNT; v_deleted := v_deleted || jsonb_build_object('profiles', v_count);

  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, details)
  VALUES (v_caller, 'admin.delete_athlete', 'profile', _athlete_id::text,
          jsonb_build_object('athlete_name', v_name, 'deleted', v_deleted));

  RETURN jsonb_build_object('success', true, 'athlete_id', _athlete_id, 'athlete_name', v_name, 'deleted', v_deleted);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_athlete(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_athlete(uuid) TO authenticated;
