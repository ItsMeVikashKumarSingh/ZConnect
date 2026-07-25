import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signJWT } from '@/lib/jwt';
import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 30, 60000);
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
      console.warn('[Login Auth Error]:', authError?.message || 'No user data');
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const userId = authData.user.id;
    const userEmail = (authData.user.email || cleanEmail).trim().toLowerCase();

    // 2. Step A: Check management.tbl_users (Internal Zorvik Tech Team & Staff)
    const { data: userMatches, error: userErr } = await supabase
      .schema('management')
      .from('tbl_users')
      .select('tu_id, tu_auth_user_id, tu_role, tu_permissions, tu_status_flag, tu_deleted_flag, tu_email')
      .or(`tu_auth_user_id.eq.${userId},tu_email.ilike.${userEmail}`);

    if (userErr) {
      console.warn('[Login DB Error - tbl_users]:', userErr.message);
    }

    const dbUser = (userMatches || []).find((u) => !u.tu_deleted_flag) || null;

    if (dbUser) {
      // Self-heal: backfill tu_auth_user_id if null or mismatched
      if (!dbUser.tu_auth_user_id || dbUser.tu_auth_user_id !== userId) {
        await supabase
          .schema('management')
          .from('tbl_users')
          .update({ tu_auth_user_id: userId, tu_updated_at: new Date().toISOString() })
          .eq('tu_id', dbUser.tu_id);
      }

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
          7200
        );

        return NextResponse.json({
          success: true,
          token,
          role: 'admin',
          redirectTo: '/superadmin',
        });
      }
    }

    // 3. Step B: Check management.tbl_clients (Super Admin & Tenant Clients)
    const { data: clientMatches, error: clientErr } = await supabase
      .schema('management')
      .from('tbl_clients')
      .select('tc_id, tc_client_name, tc_auth_user_id, tc_role, tc_status_flag, tc_deleted_flag, tc_contact_email')
      .or(`tc_auth_user_id.eq.${userId},tc_contact_email.ilike.${userEmail}`);

    if (clientErr) {
      console.warn('[Login DB Error - tbl_clients]:', clientErr.message);
    }

    const client = (clientMatches || []).find((c) => !c.tc_deleted_flag) || null;

    if (client) {
      // Self-heal: backfill tc_auth_user_id if null or mismatched
      if (!client.tc_auth_user_id || client.tc_auth_user_id !== userId) {
        await supabase
          .schema('management')
          .from('tbl_clients')
          .update({ tc_auth_user_id: userId, tc_updated_at: new Date().toISOString() })
          .eq('tc_id', client.tc_id);
      }

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
      const { data: projects, error: projErr } = await supabase
        .schema('management')
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key, tp_status_flag, tp_deleted_flag')
        .eq('tp_client_id', client.tc_id);

      if (projErr) {
        console.warn('[Login DB Error - tbl_chat_projects]:', projErr.message);
      }

      const project = (projects || []).find((p) => !p.tp_deleted_flag && p.tp_status_flag) || null;

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

    // 4. Step C: Fallback check for user in tbl_users assigned to any active project directly
    if (dbUser) {
      const { data: allProjects } = await supabase
        .schema('management')
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key, tp_status_flag, tp_deleted_flag, tp_created_at')
        .order('tp_created_at', { ascending: false });

      const userProject = (allProjects || []).find((p) => !p.tp_deleted_flag && p.tp_status_flag) || null;

      if (userProject) {
        const token = signJWT(
          { userId, email: userEmail, role: 'client', projectId: userProject.tp_id },
          userProject.tp_api_key,
          14400
        );

        return NextResponse.json({
          success: true,
          token,
          role: 'client',
          redirectTo: '/dashboard',
        });
      }
    }

    // 5. Fallthrough Log & Response
    console.error('[Login Auth Profile Resolution Failed]:', { userId, userEmail, dbUserFound: !!dbUser, clientFound: !!client });
    return NextResponse.json({ success: false, error: 'Access denied: Profile not found.' }, { status: 403 });
  } catch (error) {
    console.error('[Login API Internal Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
