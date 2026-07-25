import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyJWT } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';
import { encrypt, decrypt } from '@/lib/crypto';
import crypto from 'crypto';

// Helper to authenticate client operator JWT token from Bearer header
async function authenticateOperator(req: NextRequest): Promise<{ projectId: string; userId: string } | null> {
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.split(' ')[1];
  if (!token) return null;

  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    if (!payload.projectId || payload.role !== 'client') return null;

    const db = createAdminClient();
    const { data: project } = await db
      .schema('management')
      .from('tbl_chat_projects')
      .select('tp_api_key')
      .eq('tp_id', payload.projectId)
      .maybeSingle();

    if (!project) return null;

    const decoded = verifyJWT(token, project.tp_api_key);
    if (!decoded) return null;

    return { projectId: payload.projectId, userId: decoded.userId };
  } catch (err) {
    return null;
  }
}

/**
 * GET /api/integrations?projectId=...
 * Fetch configured integrations for a chat project
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const session = await authenticateOperator(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const db = createAdminClient();
    const { data: integrations, error } = await db
      .schema('chat')
      .from('tbl_integrations')
      .select('*')
      .eq('ti_project_id', session.projectId)
      .eq('ti_deleted_flag', false)
      .order('ti_created_at', { ascending: false });

    if (error) throw error;

    // Decrypt credentials/urls for client dashboard display
    const formatted = (integrations || []).map((ti: any) => {
      let webhookUrl = ti.ti_config?.webhook_url || '';
      if (ti.ti_credentials) {
        try {
          webhookUrl = decrypt(ti.ti_credentials);
        } catch (_) {}
      }
      return {
        ...ti,
        webhookUrl,
      };
    });

    return NextResponse.json({ success: true, integrations: formatted });
  } catch (err) {
    console.error('[API Integrations GET Error]:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/integrations
 * Create, Update, or Test an integration (Slack, Discord, MS Teams, Telegram, Custom Webhook)
 */
export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 30, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests' }, { status: 429 });
    }

    const session = await authenticateOperator(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const body = await req.json();
    const { action, integrationId, platform, type, webhookUrl, events, statusFlag } = body;
    const db = createAdminClient();

    // 1. Dispatch Test Event ("⚡ Send Test Payload")
    if (action === 'test') {
      if (!webhookUrl) {
        return NextResponse.json({ success: false, error: 'Missing Webhook URL' }, { status: 400 });
      }

      const dummyPayload = {
        event: 'test_dispatch',
        timestamp: new Date().toISOString(),
        projectId: session.projectId,
        message: 'This is a test notification from ZConnect Integrations Hub.',
        testData: {
          platform: platform || 'custom_webhook',
          operatorId: session.userId,
          status: 'success',
        },
      };

      const startTime = Date.now();
      let responseStatus = 0;
      let responseText = '';

      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };

        if (platform === 'custom_webhook') {
          const { data: proj } = await db
            .schema('management')
            .from('tbl_chat_projects')
            .select('tp_api_key')
            .eq('tp_id', session.projectId)
            .maybeSingle();

          if (proj) {
            const signature = crypto
              .createHmac('sha256', proj.tp_api_key)
              .update(JSON.stringify(dummyPayload))
              .digest('hex');
            headers['X-ZConnect-Signature'] = `sha256=${signature}`;
          }
        }

        let postBody: any = dummyPayload;
        if (platform === 'slack') {
          postBody = {
            text: '⚡ *[ZConnect Test Notification]* Integrations connection verified successfully!',
          };
        } else if (platform === 'discord') {
          postBody = {
            content: '⚡ **[ZConnect Test Notification]** Integrations connection verified successfully!',
          };
        } else if (platform === 'teams') {
          postBody = {
            title: 'ZConnect Integration Test',
            text: '⚡ Integrations connection verified successfully!',
          };
        }

        const fetchRes = await fetch(webhookUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(postBody),
        });

        responseStatus = fetchRes.status;
        responseText = await fetchRes.text();
      } catch (err: any) {
        responseStatus = 500;
        responseText = err.message || 'Connection timeout or failed to reach host.';
      }

      const durationMs = Date.now() - startTime;

      return NextResponse.json({
        success: responseStatus >= 200 && responseStatus < 300,
        status: responseStatus,
        durationMs,
        response: responseText.slice(0, 300),
      });
    }

    // 2. Create or Update Integration
    if (!platform || !webhookUrl) {
      return NextResponse.json({ success: false, error: 'Missing platform or webhook URL' }, { status: 400 });
    }

    const encryptedCredentials = encrypt(webhookUrl);
    const selectedEvents = Array.isArray(events) && events.length > 0
      ? events
      : ['chat_started', 'message_received', 'ticket_resolved'];

    const config = {
      events: selectedEvents,
      webhook_url: webhookUrl,
      updated_at: new Date().toISOString(),
    };

    if (integrationId) {
      // Update existing
      const { data, error } = await db
        .schema('chat')
        .from('tbl_integrations')
        .update({
          ti_platform: platform,
          ti_type: type || 'webhook',
          ti_config: config,
          ti_credentials: encryptedCredentials,
          ti_status_flag: statusFlag !== undefined ? statusFlag : true,
          ti_updated_at: new Date().toISOString(),
        })
        .eq('ti_id', integrationId)
        .eq('ti_project_id', session.projectId)
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, integration: { ...data, webhookUrl } });
    } else {
      // Create new
      const { data, error } = await db
        .schema('chat')
        .from('tbl_integrations')
        .insert({
          ti_project_id: session.projectId,
          ti_platform: platform,
          ti_type: type || 'webhook',
          ti_config: config,
          ti_credentials: encryptedCredentials,
          ti_status_flag: statusFlag !== undefined ? statusFlag : true,
        })
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json({ success: true, integration: { ...data, webhookUrl } });
    }
  } catch (err) {
    console.error('[API Integrations POST Error]:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/integrations?integrationId=...
 * Soft delete an integration
 */
export async function DELETE(req: NextRequest) {
  try {
    const session = await authenticateOperator(req);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized operator session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const integrationId = searchParams.get('integrationId');

    if (!integrationId) {
      return NextResponse.json({ success: false, error: 'Missing integrationId' }, { status: 400 });
    }

    const db = createAdminClient();
    const { error } = await db
      .schema('chat')
      .from('tbl_integrations')
      .update({
        ti_deleted_flag: true,
        ti_updated_at: new Date().toISOString(),
      })
      .eq('ti_id', integrationId)
      .eq('ti_project_id', session.projectId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[API Integrations DELETE Error]:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
