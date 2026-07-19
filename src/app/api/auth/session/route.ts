import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyJWT } from '@/lib/jwt';

// Helper to decode base64url payload without verification first (to read project/role keys)
function decodeUnverified(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
  } catch (err) {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();
    if (!token) {
      return NextResponse.json({ success: false, error: 'Missing session token' }, { status: 400 });
    }

    const unverified = decodeUnverified(token);
    if (!unverified || !unverified.role) {
      return NextResponse.json({ success: false, error: 'Malformed token payload' }, { status: 400 });
    }

    // 1. Verify Superadmin Session
    if (unverified.role === 'admin') {
      const secret = process.env.JWT_SECRET || 'fallback-secret-key-12345';
      const decoded = verifyJWT(token, secret);
      if (!decoded) {
        return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
      }

      return NextResponse.json({ success: true, session: decoded });
    }

    // 2. Verify Client Session
    if (unverified.role === 'client') {
      const projectId = unverified.projectId;
      if (!projectId) {
        return NextResponse.json({ success: false, error: 'Missing projectId in token' }, { status: 400 });
      }

      // Fetch project to retrieve the secret key tp_api_key
      const { data: project, error } = await supabase
        .from('tbl_chat_projects')
        .select('tp_api_key')
        .eq('tp_id', projectId)
        .single();

      if (error || !project) {
        return NextResponse.json({ success: false, error: 'Associated project not found' }, { status: 401 });
      }

      const decoded = verifyJWT(token, project.tp_api_key);
      if (!decoded) {
        return NextResponse.json({ success: false, error: 'Invalid or expired session' }, { status: 401 });
      }

      return NextResponse.json({ success: true, session: decoded });
    }

    return NextResponse.json({ success: false, error: 'Invalid session role' }, { status: 403 });
  } catch (error) {
    console.error('[Session API Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
