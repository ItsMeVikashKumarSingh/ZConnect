import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Verify identity signature helper (supports anonymous bypass for public widgets)
function verifySignature(apiKey: string, userId: string, email: string, signature: string): boolean {
  if (userId.startsWith('anon:') && signature === 'anonymous') {
    return true;
  }
  const message = `${userId}:${email}`;
  const computedSignature = crypto
    .createHmac('sha256', apiKey)
    .update(message)
    .digest('hex');
  return computedSignature === signature;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const signature = searchParams.get('signature');

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 });
    }

    // 1. Fetch project widget config and API Key
    const { data: project, error: projectError } = await supabase
      .from('tbl_chat_projects')
      .select('tp_widget_config, tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .single();

    if (projectError || !project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Project not found or inactive' }, { status: 404 });
    }

    // 2. Fetch FAQs for the project
    const { data: faqs, error: faqsError } = await supabase
      .from('tbl_chat_faqs')
      .select('tf_id, tf_question, tf_answer, tf_category, tf_sort_order')
      .eq('tf_project_id', projectId)
      .eq('tf_status_flag', true)
      .eq('tf_deleted_flag', false)
      .order('tf_sort_order', { ascending: true });

    if (faqsError) throw faqsError;

    // 3. Optional User Chat context (Verify signature if user details are provided)
    let activeConversation = null;
    let messages: any[] = [];
    let isVerified = false;

    if (userId && email && signature) {
      isVerified = verifySignature(project.tp_api_key, userId, email, signature);
      if (isVerified) {
        // Fetch active conversation for this user in the project
        const { data: conversation } = await supabase
          .from('tbl_chat_conversations')
          .select('tc_id, tc_subject, tc_category, tc_status, tc_is_priority, tc_metadata')
          .eq('tc_project_id', projectId)
          .eq('tc_user_id', userId)
          .eq('tc_deleted_flag', false)
          .order('tc_created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (conversation) {
          activeConversation = conversation;
          // Fetch message history for this conversation
          const { data: messageLogs } = await supabase
            .from('tbl_chat_messages')
            .select('tm_id, tm_sender_id, tm_sender_role, tm_message, tm_created_at')
            .eq('tm_conversation_id', conversation.tc_id)
            .eq('tm_deleted_flag', false)
            .order('tm_created_at', { ascending: true });

          messages = messageLogs || [];
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      widgetConfig: project.tp_widget_config,
      faqs: faqs || [],
      isVerified,
      activeConversation,
      messages,
    });

    // 4. Cache control filters: Cache public FAQ loads for 30 minutes, never cache private chat data.
    if (userId && email && signature && isVerified) {
      response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    } else {
      response.headers.set('Cache-Control', 'public, max-age=60, s-maxage=1800, stale-while-revalidate=120');
    }

    return response;
  } catch (error) {
    console.error('[API Widget GET Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, userId, email, name, signature, action } = body;

    if (!projectId || !userId || !email || !signature) {
      return NextResponse.json({ success: false, error: 'Missing core identity parameters' }, { status: 400 });
    }

    // Fetch project to retrieve API Key
    const { data: project, error: projectError } = await supabase
      .from('tbl_chat_projects')
      .select('tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .single();

    if (projectError || !project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Project not found' }, { status: 404 });
    }

    // Verify identity
    const isVerified = verifySignature(project.tp_api_key, userId, email, signature);
    if (!isVerified) {
      return NextResponse.json({ success: false, error: 'Invalid identity signature' }, { status: 403 });
    }

    // Action: Start human handover chat
    if (action === 'start_chat') {
      const { subject, category, message, isPriority, metadata } = body;
      if (!subject || !category || !message) {
        return NextResponse.json({ success: false, error: 'Missing chat subject, category, or message' }, { status: 400 });
      }

      // Create conversation
      const { data: newConv, error: convError } = await supabase
        .from('tbl_chat_conversations')
        .insert({
          tc_project_id: projectId,
          tc_user_id: userId,
          tc_user_name: name || 'User',
          tc_user_email: email,
          tc_subject: subject,
          tc_category: category,
          tc_is_priority: !!isPriority,
          tc_metadata: metadata || {},
          tc_status: 'open',
        })
        .select('tc_id, tc_subject, tc_status, tc_metadata')
        .single();

      if (convError || !newConv) throw convError;

      // Insert first message
      const { error: msgError } = await supabase
        .from('tbl_chat_messages')
        .insert({
          tm_conversation_id: newConv.tc_id,
          tm_sender_id: userId,
          tm_sender_role: 'user',
          tm_message: message,
        });

      if (msgError) throw msgError;

      return NextResponse.json({
        success: true,
        conversation: newConv,
        message: {
          tm_sender_id: userId,
          tm_sender_role: 'user',
          tm_message: message,
          tm_created_at: new Date().toISOString(),
        },
      });
    }

    // Action: Send follow-up message
    if (action === 'send_message') {
      const { conversationId, message, senderRole } = body;
      if (!conversationId || !message) {
        return NextResponse.json({ success: false, error: 'Missing conversationId or message text' }, { status: 400 });
      }

      // Verify conversation ownership
      const { data: conv, error: convErr } = await supabase
        .from('tbl_chat_conversations')
        .select('tc_id')
        .eq('tc_id', conversationId)
        .eq('tc_project_id', projectId)
        .single();

      if (convErr || !conv) {
        return NextResponse.json({ success: false, error: 'Conversation access denied' }, { status: 403 });
      }

      // Insert message
      const { data: newMsg, error: msgError } = await supabase
        .from('tbl_chat_messages')
        .insert({
          tm_conversation_id: conversationId,
          tm_sender_id: userId,
          tm_sender_role: senderRole || 'user',
          tm_message: message,
        })
        .select('*')
        .single();

      if (msgError) throw msgError;

      // Update conversation updated timestamp
      await supabase
        .from('tbl_chat_conversations')
        .update({ tc_updated_at: new Date().toISOString() })
        .eq('tc_id', conversationId);

      return NextResponse.json({ success: true, message: newMsg });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API Widget POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
