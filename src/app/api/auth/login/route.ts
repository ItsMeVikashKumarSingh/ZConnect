import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signJWT } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 20, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many login attempts. Please try again in a minute.' },
        { status: 429 }
      );
    }

    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Missing email or password' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 1. Authenticate with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || cleanEmail;

    // 2. Step A: Check tbl_users (Internal Zorvik Tech Team & Staff)
    let { data: dbUser } = await supabase
      .from('tbl_users')
      .select('tu_id, tu_auth_user_id, tu_role, tu_permissions, tu_status_flag, tu_deleted_flag')
      .eq('tu_deleted_flag', false)
      .eq('tu_auth_user_id', userId)
      .maybeSingle();

    if (!dbUser) {
      // Email fallback lookup
      const { data: userByEmail } = await supabase
        .from('tbl_users')
        .select('tu_id, tu_auth_user_id, tu_role, tu_permissions, tu_status_flag, tu_deleted_flag')
        .eq('tu_deleted_flag', false)
        .ilike('tu_email', userEmail)
        .maybeSingle();

      if (userByEmail) {
        dbUser = userByEmail;
        // Self-heal: backfill tu_auth_user_id if null or mismatched
        if (!userByEmail.tu_auth_user_id || userByEmail.tu_auth_user_id !== userId) {
          await supabase
            .from('tbl_users')
            .update({ tu_auth_user_id: userId, tu_updated_at: new Date().toISOString() })
            .eq('tu_id', userByEmail.tu_id);
        }
      }
    }

    if (dbUser) {
      if (dbUser.tu_status_flag === false) {
        return NextResponse.json(
          { success: false, error: 'Your account has been disabled. Please contact Administrator.' },
          { status: 403 }
        );
      }

      const roleStr = (dbUser.tu_role || '').toLowerCase();
      const permissions: string[] = Array.isArray(dbUser.tu_permissions) ? dbUser.tu_permissions : [];
      const isAdmin = roleStr === 'admin' || roleStr === 'superadmin' || permissions.includes('*') || permissions.includes('admin');

      if (isAdmin) {
        const token = signJWT(
          { userId, email: userEmail, role: 'admin' },
          process.env.JWT_SECRET || 'fallback-secret-key-12345',
          7200 // 2 hours
        );

        return NextResponse.json({
          success: true,
          token,
          role: 'admin',
          redirectTo: '/superadmin',
        });
      }
    }

    // 3. Step B: Check tbl_clients (Super Admin & Tenant Clients)
    let { data: client } = await supabase
      .from('tbl_clients')
      .select('tc_id, tc_client_name, tc_auth_user_id, tc_role, tc_status_flag, tc_deleted_flag')
      .eq('tc_deleted_flag', false)
      .eq('tc_auth_user_id', userId)
      .maybeSingle();

    if (!client) {
      // Email fallback lookup
      const { data: clientByEmail } = await supabase
        .from('tbl_clients')
        .select('tc_id, tc_client_name, tc_auth_user_id, tc_role, tc_status_flag, tc_deleted_flag')
        .eq('tc_deleted_flag', false)
        .ilike('tc_contact_email', userEmail)
        .maybeSingle();

      if (clientByEmail) {
        client = clientByEmail;
        // Self-heal: backfill tc_auth_user_id if null or mismatched
        if (!clientByEmail.tc_auth_user_id || clientByEmail.tc_auth_user_id !== userId) {
          await supabase
            .from('tbl_clients')
            .update({ tc_auth_user_id: userId, tc_updated_at: new Date().toISOString() })
            .eq('tc_id', clientByEmail.tc_id);
        }
      }
    }

    if (client) {
      if (client.tc_status_flag === false) {
        return NextResponse.json(
          { success: false, error: 'Your client account is suspended or disabled. Please contact Zorvik Tech Support.' },
          { status: 403 }
        );
      }

      const clientRole = (client.tc_role || '').toLowerCase();
      if (clientRole === 'superadmin' || clientRole === 'admin') {
        const token = signJWT(
          { userId, email: userEmail, role: 'admin' },
          process.env.JWT_SECRET || 'fallback-secret-key-12345',
          7200
        );

        return NextResponse.json({
          success: true,
          token,
          role: 'admin',
          redirectTo: '/superadmin',
        });
      }

      // Regular Client: Fetch active chat project
      const { data: project } = await supabase
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key')
        .eq('tp_client_id', client.tc_id)
        .eq('tp_status_flag', true)
        .eq('tp_deleted_flag', false)
        .maybeSingle();

      if (!project) {
        return NextResponse.json(
          {
            success: false,
            error: 'Support Chat is not enabled for your account. Please contact Zorvik Tech Support.',
          },
          { status: 403 }
        );
      }

      // Client Operator token (signed with project secret tp_api_key)
      const token = signJWT(
        { userId, email: userEmail, role: 'client', projectId: project.tp_id },
        project.tp_api_key,
        14400 // 4 hours
      );

      return NextResponse.json({
        success: true,
        token,
        role: 'client',
        redirectTo: '/dashboard',
      });
    }

    // 4. Fallthrough
    return NextResponse.json({ success: false, error: 'Access denied: Profile not found.' }, { status: 403 });
  } catch (error) {
    console.error('[Login API Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
