import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { signJWT } from '@/lib/jwt';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, error: 'Missing email or password' }, { status: 400 });
    }

    // 1. Authenticate with Supabase Auth (using shared auth database)
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: password,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: 'Invalid email or password' }, { status: 401 });
    }

    const userId = authData.user.id;
    const userEmail = authData.user.email || email;

    // 2. Check if user is Superadmin (tbl_users check)
    const { data: dbUser } = await supabase
      .from('tbl_users')
      .select('tu_role')
      .eq('tu_auth_user_id', userId)
      .eq('tu_deleted_flag', false)
      .maybeSingle();

    if (dbUser && dbUser.tu_role === 'admin') {
      // Superadmin token (signed with JWT_SECRET)
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

    // 3. Check if user is Client (tbl_clients check)
    const { data: client } = await supabase
      .from('tbl_clients')
      .select('tc_id, tc_client_name')
      .eq('tc_auth_user_id', userId)
      .eq('tc_deleted_flag', false)
      .maybeSingle();

    if (client) {
      // Fetch their active chat project
      const { data: project } = await supabase
        .from('tbl_chat_projects')
        .select('tp_id, tp_api_key')
        .eq('tp_client_id', client.tc_id)
        .eq('tp_deleted_flag', false)
        .maybeSingle();

      if (!project) {
        return NextResponse.json({
          success: false,
          error: 'Support Chat is not enabled for your account. Please contact Zorvik Tech Support.',
        }, { status: 403 });
      }

      // Client token (signed with their own project secret tp_api_key!)
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

    return NextResponse.json({ success: false, error: 'Access denied: Profile not found.' }, { status: 403 });
  } catch (error) {
    console.error('[Login API Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
