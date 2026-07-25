import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { checkRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';

function generateSignature(apiKey: string, userId: string, email: string): string {
  const message = `${userId}:${email}`;
  return crypto.createHmac('sha256', apiKey).update(message).digest('hex');
}

/**
 * GET /api/widget/authorize?projectId=&targetUrl=&userId=&email=&name=
 * One-Click Auto-Authentication & Site Authorization Helper
 * Validates site domain against tp_domain and returns pre-signed identity signature & SSO embed ticket.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many authorization requests.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const targetUrl = searchParams.get('targetUrl') || req.headers.get('referer') || '';
    const userId = searchParams.get('userId') || `anon:${crypto.randomBytes(6).toString('hex')}`;
    const email = searchParams.get('email') || `user_${userId.slice(-6)}@visitor.local`;
    const name = searchParams.get('name') || 'Website Visitor';

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId parameter' }, { status: 400 });
    }

    const db = createAdminClient();
    const { data: project, error: projectErr } = await db
      .schema('management')
      .from('tbl_chat_projects')
      .select('tp_id, tp_name, tp_domain, tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .maybeSingle();

    if (projectErr || !project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Support project not found or inactive' }, { status: 404 });
    }

    // Origin Domain Validation
    let targetHost = '';
    try {
      if (targetUrl) {
        const parsed = new URL(targetUrl.startsWith('http') ? targetUrl : `https://${targetUrl}`);
        targetHost = parsed.hostname.toLowerCase();
      }
    } catch (_) {
      targetHost = targetUrl.toLowerCase();
    }

    const allowedDomains = (project.tp_domain || '')
      .split(',')
      .map((d: string) => d.trim().toLowerCase())
      .filter(Boolean);

    const isDomainAllowed =
      allowedDomains.length === 0 ||
      allowedDomains.includes('*') ||
      allowedDomains.some((domain: string) => {
        let cleanDomain = domain;
        try {
          if (cleanDomain.startsWith('http')) {
            cleanDomain = new URL(cleanDomain).hostname;
          }
        } catch (_) {}
        return targetHost.endsWith(cleanDomain) || cleanDomain.endsWith(targetHost) || targetHost === 'localhost';
      });

    if (!isDomainAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Domain '${targetHost}' is not authorized for support project '${project.tp_name}'. Authorized domains: ${project.tp_domain}`,
        },
        { status: 403 }
      );
    }

    // Generate pre-signed HMAC signature using tp_api_key
    const signature = generateSignature(project.tp_api_key, userId, email);

    // Pre-built SSO embed snippet for the client
    const embedScript = `<!-- ZConnect One-Click Auto-Auth Embed -->
<script src="${new URL(req.url).origin}/widget.js" 
        data-project-id="${project.tp_id}"
        data-user-id="${userId}"
        data-user-email="${email}"
        data-user-name="${name}"
        data-signature="${signature}"></script>`;

    return NextResponse.json({
      success: true,
      projectId: project.tp_id,
      projectName: project.tp_name,
      targetHost,
      identity: {
        userId,
        email,
        name,
        signature,
      },
      embedScript,
      authorizedDomains: allowedDomains,
    });
  } catch (err) {
    console.error('[API Widget Authorize Error]:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
