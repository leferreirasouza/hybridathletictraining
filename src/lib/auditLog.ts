import { supabase } from '@/integrations/supabase/client';

type AuditAction =
  | 'session.completed'
  | 'session.deleted'
  | 'plan.created'
  | 'plan.imported'
  | 'plan.ai_generated'
  | 'substitution.created'
  | 'substitution.approved'
  | 'substitution.rejected'
  | 'assignment.created'
  | 'race.added'
  | 'race.deleted'
  | 'auth.login'
  | 'auth.signup'
  | 'auth.password_reset';

export async function logAudit(
  action: AuditAction,
  entityType?: string,
  entityId?: string,
  details?: Record<string, unknown>
) {
  try {
    await supabase.from('audit_logs').insert([{
      action,
      entity_type: entityType || null,
      entity_id: entityId || null,
      details: (details as any) || null,
    }]);
  } catch (e) {
    // Non-blocking — never let audit logging break the app
    console.warn('Audit log failed:', e);
  }
}
