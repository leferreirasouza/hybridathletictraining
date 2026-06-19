
-- Job overview
CREATE OR REPLACE FUNCTION public.admin_get_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  last_run_at timestamptz,
  last_status text,
  last_duration_ms bigint,
  last_message text,
  success_count bigint,
  failure_count bigint,
  total_runs bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  WITH stats AS (
    SELECT
      d.jobid,
      count(*) AS total_runs,
      count(*) FILTER (WHERE d.status = 'succeeded') AS success_count,
      count(*) FILTER (WHERE d.status = 'failed') AS failure_count
    FROM cron.job_run_details d
    GROUP BY d.jobid
  ),
  last_run AS (
    SELECT DISTINCT ON (d.jobid)
      d.jobid,
      d.start_time,
      d.end_time,
      d.status,
      d.return_message
    FROM cron.job_run_details d
    ORDER BY d.jobid, d.start_time DESC
  )
  SELECT
    j.jobid,
    j.jobname,
    j.schedule,
    j.active,
    l.start_time AS last_run_at,
    l.status AS last_status,
    CASE WHEN l.end_time IS NOT NULL AND l.start_time IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (l.end_time - l.start_time)) * 1000)::bigint
         ELSE NULL END AS last_duration_ms,
    l.return_message AS last_message,
    COALESCE(s.success_count, 0) AS success_count,
    COALESCE(s.failure_count, 0) AS failure_count,
    COALESCE(s.total_runs, 0) AS total_runs
  FROM cron.job j
  LEFT JOIN stats s ON s.jobid = j.jobid
  LEFT JOIN last_run l ON l.jobid = j.jobid
  ORDER BY j.jobname;
END;
$$;

-- Run history for a single job
CREATE OR REPLACE FUNCTION public.admin_get_cron_runs(_jobname text, _limit int DEFAULT 20)
RETURNS TABLE (
  runid bigint,
  start_time timestamptz,
  end_time timestamptz,
  status text,
  return_message text,
  duration_ms bigint
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, cron
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'master_admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  RETURN QUERY
  SELECT
    d.runid,
    d.start_time,
    d.end_time,
    d.status,
    d.return_message,
    CASE WHEN d.end_time IS NOT NULL AND d.start_time IS NOT NULL
         THEN (EXTRACT(EPOCH FROM (d.end_time - d.start_time)) * 1000)::bigint
         ELSE NULL END AS duration_ms
  FROM cron.job_run_details d
  JOIN cron.job j ON j.jobid = d.jobid
  WHERE j.jobname = _jobname
  ORDER BY d.start_time DESC
  LIMIT GREATEST(1, LEAST(_limit, 200));
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_cron_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_get_cron_runs(text, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_runs(text, int) TO authenticated;
