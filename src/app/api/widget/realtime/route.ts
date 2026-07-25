import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getDownloadPresignedUrl } from '@/lib/b2';
import crypto from 'crypto';

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
    const conversationId = searchParams.get('conversationId');
    const userId = searchParams.get('userId');
    const email = searchParams.get('email');
    const signature = searchParams.get('signature');

    if (!projectId || !conversationId || !userId || !email || !signature) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Fetch project to verify signature
    const { data: project } = await supabase
      .from('tbl_chat_projects')
      .select('tp_api_key, tp_status_flag, tp_deleted_flag')
      .eq('tp_id', projectId)
      .single();

    if (!project || !project.tp_status_flag || project.tp_deleted_flag) {
      return NextResponse.json({ success: false, error: 'Project inactive' }, { status: 404 });
    }

    // 2. Verify identity
    const isVerified = verifySignature(project.tp_api_key, userId, email, signature);
    if (!isVerified) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Verify conversation ownership
    const { data: conv } = await supabase
      .from('tbl_chat_conversations')
      .select('tc_id')
      .eq('tc_id', conversationId)
      .eq('tc_project_id', projectId)
      .single();

    if (!conv) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const encoder = new TextEncoder();
    let channel: any = null;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': ping\n\n'));

        // Subscribe to database changes
        channel = supabase
          .channel(`widget-room:${conversationId}`)
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'management',
            table: 'tbl_chat_messages',
            filter: `tm_conversation_id=eq.${conversationId}`,
          }, async (payload) => {
            try {
              let msg = payload.new;
              const attachments = Array.isArray(msg.tm_attachments) ? msg.tm_attachments : [];
              const updatedAttachments = await Promise.all(
                attachments.map(async (att: any) => {
                  if (att.key) {
                    const url = await getDownloadPresignedUrl(att.key, 3600);
                    return { ...att, url };
                  }
                  return att;
                })
              );
              msg = { ...msg, tm_attachments: updatedAttachments };

              controller.enqueue(encoder.encode(`data: ${JSON.stringify(msg)}\n\n`));
            } catch (err) {
              console.error('SSE widget dispatch error:', err);
            }
          })
          .subscribe();

        // Keep-alive ping interval
        const intervalId = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(': ping\n\n'));
          } catch (e) {
            clearInterval(intervalId);
          }
        }, 15000);
      },
      cancel() {
        if (channel) {
          supabase.removeChannel(channel);
        }
      }
    });

    return new NextResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('[SSE Widget Route Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
