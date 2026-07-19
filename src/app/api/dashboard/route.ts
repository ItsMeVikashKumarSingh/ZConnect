import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyJWT } from '@/lib/jwt';

// Helper to authenticate client requests and check project ID scope
async function authenticateClient(req: NextRequest, targetProjectId: string | null): Promise<any | null> {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.split(' ')[1];
    if (!token) return null;

    // Decode unverified payload to extract projectId
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));

    const projectId = payload.projectId;
    if (!projectId || (targetProjectId && targetProjectId !== projectId)) {
      return null; // Enforce project scope check!
    }

    // Retrieve project secret key
    const { data: project } = await supabase
      .from('tbl_chat_projects')
      .select('tp_api_key')
      .eq('tp_id', projectId)
      .single();

    if (!project) return null;

    // Verify token signature using the project's secret key
    const decoded = verifyJWT(token, project.tp_api_key);
    if (!decoded || decoded.role !== 'client') return null;

    return decoded;
  } catch (err) {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const action = searchParams.get('action');

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 });
    }

    // Authenticate and check tenant project ID boundary
    const session = await authenticateClient(req, projectId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized client session' }, { status: 401 });
    }

    // 1. Get conversations
    if (action === 'conversations') {
      const { data: convs, error } = await supabase
        .from('tbl_chat_conversations')
        .select('*')
        .eq('tc_project_id', projectId)
        .eq('tc_deleted_flag', false)
        .order('tc_updated_at', { ascending: false });

      if (error) throw error;
      return NextResponse.json({ success: true, conversations: convs || [] });
    }

    // 2. Get messages for conversation
    if (action === 'messages') {
      const conversationId = searchParams.get('conversationId');
      if (!conversationId) {
        return NextResponse.json({ success: false, error: 'Missing conversationId' }, { status: 400 });
      }

      // Verify conversation belongs to the project
      const { data: conv } = await supabase
        .from('tbl_chat_conversations')
        .select('tc_id')
        .eq('tc_id', conversationId)
        .eq('tc_project_id', projectId)
        .single();

      if (!conv) {
        return NextResponse.json({ success: false, error: 'Access denied to this conversation' }, { status: 403 });
      }

      const { data: messages, error } = await supabase
        .from('tbl_chat_messages')
        .select('*')
        .eq('tm_conversation_id', conversationId)
        .eq('tm_deleted_flag', false)
        .order('tm_created_at', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, messages: messages || [] });
    }

    // 3. Get FAQs
    if (action === 'faqs') {
      const { data: faqs, error } = await supabase
        .from('tbl_chat_faqs')
        .select('*')
        .eq('tf_project_id', projectId)
        .eq('tf_deleted_flag', false)
        .order('tf_sort_order', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, faqs: faqs || [] });
    }

    // 4. Get Canned Responses
    if (action === 'canned') {
      const { data: canned, error } = await supabase
        .from('tbl_chat_canned_responses')
        .select('*')
        .eq('tcr_project_id', projectId)
        .eq('tcr_deleted_flag', false)
        .order('tcr_shortcut', { ascending: true });

      if (error) throw error;
      return NextResponse.json({ success: true, canned: canned || [] });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Secure Dashboard API GET Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, action } = body;

    if (!projectId) {
      return NextResponse.json({ success: false, error: 'Missing projectId' }, { status: 400 });
    }

    // Authenticate and check tenant project ID boundary
    const session = await authenticateClient(req, projectId);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized client session' }, { status: 401 });
    }

    // 1. Send Agent Reply
    if (action === 'send_reply') {
      const { conversationId, message, senderId } = body;
      if (!conversationId || !message || !senderId) {
        return NextResponse.json({ success: false, error: 'Missing conversationId, message, or senderId' }, { status: 400 });
      }

      // Verify conversation ownership
      const { data: conv } = await supabase
        .from('tbl_chat_conversations')
        .select('tc_id')
        .eq('tc_id', conversationId)
        .eq('tc_project_id', projectId)
        .single();

      if (!conv) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      // Insert message as role 'client'
      const { data: newMsg, error: msgError } = await supabase
        .from('tbl_chat_messages')
        .insert({
          tm_conversation_id: conversationId,
          tm_sender_id: senderId,
          tm_sender_role: 'client',
          tm_message: message,
        })
        .select('*')
        .single();

      if (msgError) throw msgError;

      // Update conversation timestamp and mark status open
      await supabase
        .from('tbl_chat_conversations')
        .update({
          tc_updated_at: new Date().toISOString(),
          tc_status: 'open',
        })
        .eq('tc_id', conversationId);

      return NextResponse.json({ success: true, message: newMsg });
    }

    // 2. Resolve Conversation
    if (action === 'resolve') {
      const { conversationId } = body;
      if (!conversationId) {
        return NextResponse.json({ success: false, error: 'Missing conversationId' }, { status: 400 });
      }

      // Verify conversation ownership
      const { data: conv } = await supabase
        .from('tbl_chat_conversations')
        .select('tc_id')
        .eq('tc_id', conversationId)
        .eq('tc_project_id', projectId)
        .single();

      if (!conv) {
        return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
      }

      const { error } = await supabase
        .from('tbl_chat_conversations')
        .update({
          tc_status: 'resolved',
          tc_updated_at: new Date().toISOString(),
        })
        .eq('tc_id', conversationId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 3. Upsert FAQ
    if (action === 'upsert_faq') {
      const { faqId, question, answer, category, sortOrder } = body;
      if (!question || !answer) {
        return NextResponse.json({ success: false, error: 'Missing question or answer' }, { status: 400 });
      }

      const payload = {
        tf_project_id: projectId,
        tf_question: question,
        tf_answer: answer,
        tf_category: category || 'General',
        tf_sort_order: sortOrder || 0,
        tf_updated_at: new Date().toISOString(),
      };

      if (faqId) {
        // Verify FAQ belongs to project
        const { data: faq } = await supabase
          .from('tbl_chat_faqs')
          .select('tf_id')
          .eq('tf_id', faqId)
          .eq('tf_project_id', projectId)
          .single();

        if (!faq) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

        const { error } = await supabase
          .from('tbl_chat_faqs')
          .update(payload)
          .eq('tf_id', faqId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tbl_chat_faqs')
          .insert(payload);
        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    // 4. Delete FAQ
    if (action === 'delete_faq') {
      const { faqId } = body;
      if (!faqId) {
        return NextResponse.json({ success: false, error: 'Missing faqId' }, { status: 400 });
      }

      // Verify FAQ ownership
      const { data: faq } = await supabase
          .from('tbl_chat_faqs')
          .select('tf_id')
          .eq('tf_id', faqId)
          .eq('tf_project_id', projectId)
          .single();

      if (!faq) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

      const { error } = await supabase
        .from('tbl_chat_faqs')
        .update({
          tf_deleted_flag: true,
          tf_updated_at: new Date().toISOString(),
        })
        .eq('tf_id', faqId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 5. Upsert Canned Response
    if (action === 'upsert_canned') {
      const { cannedId, shortcut, response } = body;
      if (!shortcut || !response) {
        return NextResponse.json({ success: false, error: 'Missing shortcut or response' }, { status: 400 });
      }

      const formattedShortcut = shortcut.startsWith('/') ? shortcut : `/${shortcut}`;
      const payload = {
        tcr_project_id: projectId,
        tcr_shortcut: formattedShortcut,
        tcr_response: response,
        tcr_updated_at: new Date().toISOString(),
      };

      if (cannedId) {
        // Verify canned response ownership
        const { data: canned } = await supabase
          .from('tbl_chat_canned_responses')
          .select('tcr_id')
          .eq('tcr_id', cannedId)
          .eq('tcr_project_id', projectId)
          .single();

        if (!canned) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

        const { error } = await supabase
          .from('tbl_chat_canned_responses')
          .update(payload)
          .eq('tcr_id', cannedId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('tbl_chat_canned_responses')
          .insert(payload);
        if (error) throw error;
      }

      return NextResponse.json({ success: true });
    }

    // 6. Delete Canned Response
    if (action === 'delete_canned') {
      const { cannedId } = body;
      if (!cannedId) {
        return NextResponse.json({ success: false, error: 'Missing cannedId' }, { status: 400 });
      }

      // Verify canned response ownership
      const { data: canned } = await supabase
          .from('tbl_chat_canned_responses')
          .select('tcr_id')
          .eq('tcr_id', cannedId)
          .eq('tcr_project_id', projectId)
          .single();

      if (!canned) return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });

      const { error } = await supabase
        .from('tbl_chat_canned_responses')
        .update({
          tcr_deleted_flag: true,
          tcr_updated_at: new Date().toISOString(),
        })
        .eq('tcr_id', cannedId);

      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('[Secure Dashboard API POST Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
