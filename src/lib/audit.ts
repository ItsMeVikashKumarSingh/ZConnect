import { supabase } from './supabase';

interface AuditLogParams {
  projectId: string;
  adminId: string;
  action: string;
  entity: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog({
  projectId,
  adminId,
  action,
  entity,
  metadata = {},
  ipAddress = null,
  userAgent = null,
}: AuditLogParams) {
  try {
    // 1. Fetch client ID associated with the project (optional)
    const { data: project } = await supabase
      .from('tbl_projects')
      .select('tp_client_id')
      .eq('tp_id', projectId)
      .maybeSingle();

    // 2. Insert record into zconnect.tbl_audit_logs
    const { error } = await supabase
      .from('tbl_audit_logs')
      .insert({
        tal_admin_id: adminId,
        tal_client_id: project?.tp_client_id || null,
        tal_project_id: projectId,
        tal_action: action,
        tal_entity: entity,
        tal_metadata: metadata,
        tal_ip_address: ipAddress,
        tal_user_agent: userAgent,
        tal_created_at: new Date().toISOString(),
      });

    if (error) {
      console.error('Failed to insert audit log row in zconnect.tbl_audit_logs:', error);
    }
  } catch (err) {
    console.error('writeAuditLog exception:', err);
  }
}
