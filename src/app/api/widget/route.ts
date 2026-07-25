import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDownloadPresignedUrl } from '@/lib/b2';
import { triggerIntegrations } from '@/lib/integrations';
import crypto from 'crypto';

import { checkRateLimit } from '@/lib/rate-limit';

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
    const rateLimit = checkRateLimit(req, 120, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json({ success: false, error: 'Too many requests. Please try again later.' }, { status: 429 });
    }

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
    let userConversations: any[] = [];
    let messages: any[] = [];
    let isVerified = false;

    if (userId && email && signature) {
      isVerified = verifySignature(project.tp_api_key, userId, email, signature);
      if (isVerified) {
        // Fetch all past conversations for this user in the project
        const { data: conversations } = await supabase
          .from('tbl_chat_conversations')
          .select('tc_id, tc_subject, tc_category, tc_status, tc_is_priority, tc_metadata, tc_created_at, tc_updated_at')
          .eq('tc_project_id', projectId)
          .eq('tc_user_id', userId)
          .eq('tc_deleted_flag', false)
          .order('tc_created_at', { ascending: false });

        userConversations = conversations || [];
        if (userConversations.length > 0) {
          // Default to latest conversation
          activeConversation = userConversations[0];
          // Fetch message history for this conversation
          const { data: messageLogs } = await supabase
            .from('tbl_chat_messages')
            .select('tm_id, tm_sender_id, tm_sender_role, tm_message, tm_attachments, tm_created_at')
            .eq('tm_conversation_id', activeConversation.tc_id)
            .eq('tm_deleted_flag', false)
            .order('tm_created_at', { ascending: true });

          let parsedMessages = messageLogs || [];
          if (parsedMessages.length > 0) {
            parsedMessages = await Promise.all(
              parsedMessages.map(async (m) => {
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
          messages = parsedMessages;
        }
      }
    }

    const response = NextResponse.json({
      success: true,
      widgetConfig: project.tp_widget_config,
      faqs: faqs || [],
      isVerified,
      activeConversation,
      userConversations,
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

    // Fetch project to retrieve API Key and Name
    const { data: project, error: projectError } = await supabase
      .from('tbl_chat_projects')
      .select('tp_name, tp_api_key, tp_status_flag, tp_deleted_flag')
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
      const { subject, category, message, isPriority, metadata, attachments } = body;
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
          tm_attachments: attachments || [],
        });

      if (msgError) throw msgError;

      let responseAttachments = attachments || [];
      if (responseAttachments.length > 0) {
        responseAttachments = await Promise.all(
          responseAttachments.map(async (att: any) => {
            if (att.key) {
              const url = await getDownloadPresignedUrl(att.key, 3600);
              return { ...att, url };
            }
            return att;
          })
        );
      }

      // Dispatch Webhook alerts asynchronously (fire and forget)
      triggerIntegrations(projectId, 'chat_started', {
        projectName: project?.tp_name || 'ZConnect Project',
        conversationId: newConv.tc_id,
        userName: name || 'User',
        userEmail: email,
        subject,
        category,
        messageText: message,
        attachments: responseAttachments,
      }).catch((e) => console.error('Integration trigger failed:', e));

      return NextResponse.json({
        success: true,
        conversation: newConv,
        message: {
          tm_sender_id: userId,
          tm_sender_role: 'user',
          tm_message: message,
          tm_attachments: responseAttachments,
          tm_created_at: new Date().toISOString(),
        },
      });
    }

    // Action: Send follow-up message
    if (action === 'send_message') {
      const { conversationId, message, senderRole, attachments } = body;
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
          tm_attachments: attachments || [],
        })
        .select('*')
        .single();

      if (msgError) throw msgError;

      // Update conversation updated timestamp
      await supabase
        .from('tbl_chat_conversations')
        .update({ tc_updated_at: new Date().toISOString() })
        .eq('tc_id', conversationId);

      let responseMsg = newMsg;
      if (responseMsg && Array.isArray(responseMsg.tm_attachments) && responseMsg.tm_attachments.length > 0) {
        const updatedAttachments = await Promise.all(
          responseMsg.tm_attachments.map(async (att: any) => {
            if (att.key) {
              const url = await getDownloadPresignedUrl(att.key, 3600);
              return { ...att, url };
            }
            return att;
          })
        );
        responseMsg = { ...responseMsg, tm_attachments: updatedAttachments };
      }

      // Fetch conversation info and project name to trigger message webhook asynchronously
      Promise.all([
        supabase
          .from('tbl_chat_conversations')
          .select('tc_user_name, tc_user_email, tc_subject, tc_category')
          .eq('tc_id', conversationId)
          .single(),
        supabase
          .from('tbl_chat_projects')
          .select('tp_name')
          .eq('tp_id', projectId)
          .single()
      ]).then(([convRes, projRes]) => {
        const conv = convRes.data;
        const projName = projRes.data?.tp_name || 'ZConnect Project';
        if (conv) {
          triggerIntegrations(projectId, 'message_received', {
            projectName: projName,
            conversationId,
            userName: conv.tc_user_name,
            userEmail: conv.tc_user_email,
            subject: conv.tc_subject,
            category: conv.tc_category,
            messageText: message,
            attachments: responseMsg?.tm_attachments || [],
          });
        }
      }).catch((e) => console.error('Integration trigger failed:', e));

      return NextResponse.json({ success: true, message: responseMsg });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[API Widget POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
