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
    const { data: initialDbUser, error: dbUserError } = await supabase
      .schema('management')
      .from('tbl_users')
      .select('tu_id, tu_auth_user_id, tu_role, tu_permissions, tu_status_flag, tu_deleted_flag')
      .eq('tu_deleted_flag', false)
      .eq('tu_auth_user_id', userId)
      .maybeSingle();

    let dbUser = initialDbUser;

    if (dbUserError) {
      console.warn('[Login DB Warning - tbl_users UUID query]:', dbUserError.message);
    }

    if (!dbUser) {
      const { data: userByEmail, error: userEmailErr } = await supabase
        .schema('management')
        .from('tbl_users')
        .select('tu_id, tu_auth_user_id, tu_role, tu_permissions, tu_status_flag, tu_deleted_flag')
        .eq('tu_deleted_flag', false)
        .ilike('tu_email', userEmail)
        .maybeSingle();

      if (userEmailErr) {
        console.warn('[Login DB Warning - tbl_users Email query]:', userEmailErr.message);
      }

      if (userByEmail) {
        dbUser = userByEmail;
        if (!userByEmail.tu_auth_user_id || userByEmail.tu_auth_user_id !== userId) {
          await supabase
            .schema('management')
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
    const { data: initialClient, error: clientUuidErr } = await supabase
      .schema('management')
      .from('tbl_clients')
      .select('tc_id, tc_client_name, tc_auth_user_id, tc_role, tc_status_flag, tc_deleted_flag')
      .eq('tc_deleted_flag', false)
      .eq('tc_auth_user_id', userId)
      .maybeSingle();

    let client = initialClient;

    if (clientUuidErr) {
      console.warn('[Login DB Warning - tbl_clients UUID query]:', clientUuidErr.message);
    }

    if (!client) {
      const { data: clientByEmail, error: clientEmailErr } = await supabase
        .schema('management')
        .from('tbl_clients')
        .select('tc_id, tc_client_name, tc_auth_user_id, tc_role, tc_status_flag, tc_deleted_flag')
        .eq('tc_deleted_flag', false)
        .ilike('tc_contact_email', userEmail)
        .maybeSingle();

      if (clientEmailErr) {
        console.warn('[Login DB Warning - tbl_clients Email query]:', clientEmailErr.message);
      }

      if (clientByEmail) {
        client = clientByEmail;
        if (!clientByEmail.tc_auth_user_id || clientByEmail.tc_auth_user_id !== userId) {
          await supabase
            .schema('management')
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
      const { data: project, error: projErr } = await supabase
        .schema('management')
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key')
        .eq('tp_client_id', client.tc_id)
        .eq('tp_status_flag', true)
        .eq('tp_deleted_flag', false)
        .maybeSingle();

      if (projErr) {
        console.warn('[Login DB Warning - tbl_chat_projects query]:', projErr.message);
      }

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
      const { data: userProject } = await supabase
        .schema('management')
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key')
        .eq('tp_status_flag', true)
        .eq('tp_deleted_flag', false)
        .order('tp_created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

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
