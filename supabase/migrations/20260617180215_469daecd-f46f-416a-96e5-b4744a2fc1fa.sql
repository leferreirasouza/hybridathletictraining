CREATE TABLE public.garmin_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  garmin_user_id TEXT,
  access_token TEXT,
  access_token_secret TEXT,
  request_token TEXT,
  request_token_secret TEXT,
  scopes TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.garmin_connections TO authenticated;
GRANT ALL ON public.garmin_connections TO service_role;

ALTER TABLE public.garmin_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own garmin connection"
ON public.garmin_connections
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_garmin_connections_updated_at
BEFORE UPDATE ON public.garmin_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();