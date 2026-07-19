import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyJWT } from '@/lib/jwt';

// Helper to authenticate superadmin requests using headers
async function authenticateAdmin(req: NextRequest): Promise<any | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return null;

    const decoded = verifyJWT(token, process.env.JWT_SECRET || 'fallback-secret-key-12345');
    if (!decoded || decoded.role !== 'admin') return null;

    return decoded;
  } catch (err) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await authenticateAdmin(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized admin session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    // 1. Fetch all registered projects
    if (!action || action === 'projects') {
      const { data: projects, error } = await supabase
        .from('tbl_chat_projects')
        .select('*')
        .eq('tp_deleted_flag', false)
        .order('tp_created_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, projects: projects || [] });
    }

    // 2. Fetch all clients from management.tbl_clients (to link to support projects)
    if (action === 'clients') {
      const { data: clients, error } = await supabase
        .from('tbl_clients')
        .select('tc_id, tc_client_name, tc_contact_email, tc_domain, tc_status_flag')
        .eq('tc_deleted_flag', false)
        .order('tc_client_name', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, clients: clients || [] });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Secure Superadmin API GET Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await authenticateAdmin(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized admin session' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    // 1. Create Project
    if (action === 'create_project') {
      const { name, domain, clientUUID } = body;
      if (!name || !domain) {
        return NextResponse.json({ success: false, error: 'Missing name or domain' }, { status: 400 });
      }

      // Check if project already exists for this client
      if (clientUUID) {
        const { data: existing } = await supabase
          .from('tbl_chat_projects')
          .select('tp_id')
          .eq('tp_client_id', clientUUID)
          .eq('tp_deleted_flag', false)
          .maybeSingle();

        if (existing) {
          return NextResponse.json({ success: false, error: 'A support widget is already active for this client.' }, { status: 409 });
        }
      }

      const { data: newProj, error } = await supabase
        .from('tbl_chat_projects')
        .insert({
          tp_name: name,
          tp_domain: domain,
          tp_client_id: clientUUID || null,
        })
        .select('*')
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, project: newProj });
    }

    // 2. Update Project configuration
    if (action === 'update_config') {
      const { projectId, widgetConfig } = body;
      if (!projectId || !widgetConfig) {
        return NextResponse.json({ success: false, error: 'Missing projectId or widgetConfig' }, { status: 400 });
      }

      const { error } = await supabase
        .from('tbl_chat_projects')
        .update({
          tp_widget_config: widgetConfig,
          tp_updated_at: new Date().toISOString(),
        })
        .eq('tp_id', projectId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 3. Delete Project
    if (action === 'delete_project') {
      const { projectId } = body;
      if (!projectId) {
        return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 });
      }

      const { error } = await supabase
        .from('tbl_chat_projects')
        .update({
          tp_deleted_flag: true,
          tp_updated_at: new Date().toISOString(),
        })
        .eq('tp_id', projectId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Secure Superadmin API POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
