import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDownloadPresignedUrl } from '@/lib/b2';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limit';

function verifySignature(apiKey: string, userId: string, email: string, signature: string): boolean {
  if (userId.startsWith('anon:') && signature === 'anonymous') return true;
  const message = `${userId}:${email}`;
  const computedSignature = crypto.createHmac('sha256', apiKey).update(message).digest('hex');
  return computedSignature === signature;
}

/**
 * GET /api/widget/messages?projectId=&conversationId=&userId=&email=&signature=
 * Fetch message history for a specific conversation, used when switching tickets in the history drawer.
 */
export async function GET(req: NextRequest) {
  try {
    const rateLimit = checkRateLimit(req, 60, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests.' }, { status: 429 });
    }

    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const signature = searchParams.get('signature');

    if (!projectId || !conversationId || !userId || !email || !signature) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // Verify project exists and get api key
    const { data: project, error: projectErr } = await supabase
      .from('tbl_chat_projects')
      .select('tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .single();

    if (projectErr || !project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Project not found or inactive' }, { status: 404 });
    }

    // Verify identity
    const isVerified = verifySignature(project.tp_api_key, userId, email, signature);
    if (!isVerified) {
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    // Verify the conversation belongs to this user and project
    const { data: conversation, error: convErr } = await supabase
      .from('tbl_chat_conversations')
      .select('tc_id, tc_user_id, tc_project_id, tc_status, tc_subject')
      .eq('tc_id', conversationId)
      .eq('tc_project_id', projectId)
      .eq('tc_user_id', userId)
      .eq('tc_deleted_flag', false)
      .maybeSingle();

    if (convErr || !conversation) {
      return NextResponse.json({ success: false, error: 'Conversation not found or access denied' }, { status: 404 });
    }

    // Fetch messages
    const { data: messageLogs, error: msgErr } = await supabase
      .from('tbl_chat_messages')
      .select('tm_id, tm_sender_id, tm_sender_role, tm_message, tm_attachments, tm_created_at')
      .eq('tm_conversation_id', conversationId)
      .eq('tm_deleted_flag', false)
      .order('tm_created_at', { ascending: true });

    if (msgErr) throw msgErr;

    let messages = messageLogs || [];
    if (messages.length > 0) {
      messages = await Promise.all(
        messages.map(async (m) => {
          const attachments = Array.isArray(m.tm_attachments) ? m.tm_attachments : [];
          const updatedAttachments = await Promise.all(
            attachments.map(async (att: any) => {
              if (att.key) {
                const url = await getDownloadPresignedUrl(att.key, 3600);
                return { ...att, url };
              }
              return att;
            })
          );
          return { ...m, tm_attachments: updatedAttachments };
        })
      );
    }

    return NextResponse.json({ success: true, messages, conversation });
  } catch (err) {
    console.error('[API Widget Messages GET Error]:', err);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
