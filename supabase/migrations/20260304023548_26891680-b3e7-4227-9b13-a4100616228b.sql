
-- Enable pgvector extension for semantic search
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Exercise Library: curated, coach-approved exercise database
CREATE TABLE public.exercise_library (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  created_by uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  subcategory text,
  discipline text NOT NULL DEFAULT 'custom',
  muscle_groups text[] DEFAULT '{}',
  equipment_required text[] DEFAULT '{}',
  hyrox_station text,
  difficulty_level text NOT NULL DEFAULT 'intermediate',
  description text,
  coaching_cues text,
  contraindications text,
  progression_from text,
  progression_to text,
  video_url text,
  is_approved boolean NOT NULL DEFAULT false,
  approved_by uuid,
  approved_at timestamptz,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exercise_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view exercises" ON public.exercise_library
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = exercise_library.organization_id AND ur.user_id = auth.uid())
  );

CREATE POLICY "Coaches and admins manage exercises" ON public.exercise_library
  FOR ALL USING (
    has_org_role(auth.uid(), organization_id, 'coach') OR
    has_org_role(auth.uid(), organization_id, 'admin') OR
    has_org_role(auth.uid(), organization_id, 'master_admin')
  ) WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'coach') OR
    has_org_role(auth.uid(), organization_id, 'admin') OR
    has_org_role(auth.uid(), organization_id, 'master_admin')
  );

-- Knowledge Documents: uploaded PDFs, articles, manual entries
CREATE TABLE public.knowledge_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  uploaded_by uuid NOT NULL,
  title text NOT NULL,
  source_type text NOT NULL DEFAULT 'manual',
  source_url text,
  file_path text,
  content_text text,
  status text NOT NULL DEFAULT 'pending',
  total_chunks integer DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view documents" ON public.knowledge_documents
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.organization_id = knowledge_documents.organization_id AND ur.user_id = auth.uid())
  );

CREATE POLICY "Coaches and admins manage documents" ON public.knowledge_documents
  FOR ALL USING (
    has_org_role(auth.uid(), organization_id, 'coach') OR
    has_org_role(auth.uid(), organization_id, 'admin') OR
    has_org_role(auth.uid(), organization_id, 'master_admin')
  ) WITH CHECK (
    has_org_role(auth.uid(), organization_id, 'coach') OR
    has_org_role(auth.uid(), organization_id, 'admin') OR
    has_org_role(auth.uid(), organization_id, 'master_admin')
  );

-- Knowledge Chunks: vectorized content for RAG retrieval
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid REFERENCES public.knowledge_documents(id) ON DELETE CASCADE NOT NULL,
  chunk_index integer NOT NULL DEFAULT 0,
  content text NOT NULL,
  embedding vector(768),
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view chunks" ON public.knowledge_chunks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents kd
      JOIN public.user_roles ur ON ur.organization_id = kd.organization_id
      WHERE kd.id = knowledge_chunks.document_id AND ur.user_id = auth.uid()
    )
  );

CREATE POLICY "Coaches and admins manage chunks" ON public.knowledge_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents kd
      WHERE kd.id = knowledge_chunks.document_id AND (
        has_org_role(auth.uid(), kd.organization_id, 'coach') OR
        has_org_role(auth.uid(), kd.organization_id, 'admin') OR
        has_org_role(auth.uid(), kd.organization_id, 'master_admin')
      )
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.knowledge_documents kd
      WHERE kd.id = knowledge_chunks.document_id AND (
        has_org_role(auth.uid(), kd.organization_id, 'coach') OR
        has_org_role(auth.uid(), kd.organization_id, 'admin') OR
        has_org_role(auth.uid(), kd.organization_id, 'master_admin')
      )
    )
  );

-- Index for vector similarity search
CREATE INDEX ON public.knowledge_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Trigger for updated_at
CREATE TRIGGER update_exercise_library_updated_at BEFORE UPDATE ON public.exercise_library
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_documents_updated_at BEFORE UPDATE ON public.knowledge_documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
