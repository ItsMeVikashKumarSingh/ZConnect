import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { verifyJWT } from '@/lib/jwt';
import { getDownloadPresignedUrl } from '@/lib/b2';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get('projectId');
    const token = searchParams.get('token');

    if (!projectId || !token) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    // 1. Verify operator session
    const decoded = verifyJWT(token, process.env.JWT_SECRET || 'fallback-secret');
    if (!decoded || decoded.role !== 'client' || decoded.projectId !== projectId) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const encoder = new TextEncoder();
    let channel: any = null;

    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(': ping\n\n'));

        // Subscribe to database changes for this project
        channel = supabase
          .channel(`dashboard-project:${projectId}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'management',
            table: 'tbl_chat_conversations',
            filter: `tc_project_id=eq.${projectId}`
          }, async (payload) => {
            try {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'conversation', data: payload.new || payload.old })}\n\n`)
              );
            } catch (err) {
              console.error('SSE conversation dispatch error:', err);
            }
          })
          .on('postgres_changes', {
            event: 'INSERT',
            schema: 'management',
            table: 'tbl_chat_messages'
          }, async (payload) => {
            try {
              const msg = payload.new;
              // Verify message belongs to this project
              const { data: conv } = await supabase
                .from('tbl_chat_conversations')
                .select('tc_id')
                .eq('tc_id', msg.tm_conversation_id)
                .eq('tc_project_id', projectId)
                .single();

              if (conv) {
                let formattedMsg = msg;
                const attachments = Array.isArray(formattedMsg.tm_attachments) ? formattedMsg.tm_attachments : [];
                const updatedAttachments = await Promise.all(
                  attachments.map(async (att: any) => {
                    if (att.key) {
                      const url = await getDownloadPresignedUrl(att.key, 3600);
                      return { ...att, url };
                    }
                    return att;
                  })
                );
                formattedMsg = { ...formattedMsg, tm_attachments: updatedAttachments };

                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: 'message', data: formattedMsg })}\n\n`)
                );
              }
            } catch (err) {
              console.error('SSE message dispatch error:', err);
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
    console.error('[SSE Dashboard Route Error]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
