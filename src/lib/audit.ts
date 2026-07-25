import { supabase } from './supabase';

interface AuditLogParams {
  projectId: string;
  adminId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'RESOLVE';
  entity: 'FAQ' | 'CANNED_RESPONSE' | 'INTEGRATION' | 'CONVERSATION';
  metadata?: any;
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
    // 1. Fetch client ID associated with the project
    const { data: project } = await supabase
      .from('tbl_chat_projects')
      .select('tp_client_id')
      .eq('tp_id', projectId)
      .single();

    if (!project || !project.tp_client_id) {
      console.warn(`Audit Log: No client ID found for project ${projectId}`);
      return;
    }

    // 2. Insert record into management.tbl_audit_logs
    const { error } = await supabase
      .from('tbl_audit_logs')
      .insert({
        tal_admin_id: adminId,
        tal_client_id: project.tp_client_id,
        tal_action: action,
        tal_entity: entity,
        tal_metadata: metadata,
        tal_ip_address: ipAddress,
        tal_user_agent: userAgent,
      });

    if (error) {
      console.error('Failed to insert audit log row:', error);
    }
  } catch (err) {
    console.error('writeAuditLog exception:', err);
  }
}
