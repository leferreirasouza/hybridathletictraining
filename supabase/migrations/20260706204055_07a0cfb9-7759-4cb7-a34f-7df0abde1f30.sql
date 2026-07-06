
DROP POLICY IF EXISTS "Coaches and admins manage documents" ON public.knowledge_documents;
CREATE POLICY "Coaches and admins manage documents"
ON public.knowledge_documents
FOR ALL
USING (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'coach'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'master_admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'coach'::app_role)
);

DROP POLICY IF EXISTS "Coaches and admins manage chunks" ON public.knowledge_chunks;
CREATE POLICY "Coaches and admins manage chunks"
ON public.knowledge_chunks
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd
    WHERE kd.id = knowledge_chunks.document_id
      AND (
        has_role(auth.uid(), 'master_admin'::app_role)
        OR has_org_role(auth.uid(), kd.organization_id, 'admin'::app_role)
        OR has_org_role(auth.uid(), kd.organization_id, 'coach'::app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.knowledge_documents kd
    WHERE kd.id = knowledge_chunks.document_id
      AND (
        has_role(auth.uid(), 'master_admin'::app_role)
        OR has_org_role(auth.uid(), kd.organization_id, 'admin'::app_role)
        OR has_org_role(auth.uid(), kd.organization_id, 'coach'::app_role)
      )
  )
);
