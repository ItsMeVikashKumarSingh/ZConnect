import { supabase } from './supabase';
import { decrypt } from './crypto';
import crypto from 'crypto';

interface DispatchPayload {
  projectName: string;
  conversationId: string;
  userName: string;
  userEmail: string;
  subject: string;
  category: string;
  messageText: string;
  attachments?: Array<{ name: string; url: string }>;
}

export async function triggerIntegrations(
  projectId: string,
  event: 'chat_started' | 'message_received' | 'ticket_resolved',
  payload: DispatchPayload
) {
  try {
    // 1. Fetch active integrations for the project
    const { data: integrations, error } = await supabase
      .from('tbl_integrations')
      .select('*')
      .eq('ti_project_id', projectId)
      .eq('ti_status_flag', true)
      .eq('ti_deleted_flag', false);

    if (error || !integrations || integrations.length === 0) return;

    // Filter matching integrations
    const activeIntegrations = integrations.filter((ti: any) => {
      const events = Array.isArray(ti.ti_config?.events) ? ti.ti_config.events : [];
      return events.includes(event);
    });

    if (activeIntegrations.length === 0) return;

    // Dispatch asynchronously
    await Promise.allSettled(
      activeIntegrations.map(async (ti: any) => {
        try {
          // Resolve Webhook URL from encrypted credentials or raw config
          let webhookUrl = ti.ti_config?.webhook_url;
          if (ti.ti_credentials) {
            webhookUrl = decrypt(ti.ti_credentials);
          }

          if (!webhookUrl) return;

          let body = {};
          const headers: Record<string, string> = { 'Content-Type': 'application/json' };

          if (ti.ti_platform === 'slack') {
            body = formatSlackMessage(event, payload);
          } else if (ti.ti_platform === 'discord') {
            body = formatDiscordMessage(event, payload);
          } else if (ti.ti_platform === 'teams') {
            body = formatTeamsMessage(event, payload);
          } else if (ti.ti_platform === 'custom_webhook') {
            body = {
              event,
              timestamp: new Date().toISOString(),
              projectId,
              data: payload,
            };
            // Generate HMAC signature for custom webhook verification
            const { data: proj } = await supabase
              .from('tbl_chat_projects')
              .select('tp_api_key')
              .eq('tp_id', projectId)
              .single();
            if (proj) {
              const signature = crypto
                .createHmac('sha256', proj.tp_api_key)
                .update(JSON.stringify(body))
                .digest('hex');
              headers['X-ZConnect-Signature'] = `sha256=${signature}`;
            }
          } else {
            body = { text: `[ZConnect Alert] ${event}: ${payload.messageText}` };
          }

          await fetch(webhookUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
          });
        } catch (err) {
          console.error(`Failed to dispatch integration ${ti.ti_id} for platform ${ti.ti_platform}:`, err);
        }
      })
    );
  } catch (err) {
    console.error('Trigger integrations failed:', err);
  }
}

function formatSlackMessage(event: string, payload: DispatchPayload) {
  const emoji = event === 'chat_started' ? '🆕' : event === 'ticket_resolved' ? '✅' : '💬';
  const title = event === 'chat_started'
    ? `New Support Thread Created in *${payload.projectName}*`
    : event === 'ticket_resolved'
    ? `Support Thread Resolved in *${payload.projectName}*`
    : `New Message from User in *${payload.projectName}*`;

  const blocks: any[] = [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${emoji} ${title}`,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*User:* ${payload.userName}` },
        { type: 'mrkdwn', text: `*Category:* ${payload.category}` },
        { type: 'mrkdwn', text: `*Subject:* ${payload.subject}` },
        { type: 'mrkdwn', text: `*Thread ID:* \`${payload.conversationId}\`` },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Message Content:*\n> ${payload.messageText.replace(/\n/g, '\n> ')}`,
      },
    },
  ];

  if (payload.attachments && payload.attachments.length > 0) {
    const list = payload.attachments.map(att => `<${att.url}|${att.name}>`).join(', ');
    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `📎 *Attachments:* ${list}`,
        },
      ],
    });
  }

  return { blocks };
}

function formatDiscordMessage(event: string, payload: DispatchPayload) {
  const color = event === 'chat_started' ? 0x9333ea : event === 'ticket_resolved' ? 0x10b981 : 0x3b82f6;
  const status = event === 'chat_started' ? 'New Support Ticket' : event === 'ticket_resolved' ? 'Ticket Resolved' : 'New Message';

  const embed: any = {
    title: `${status} - ${payload.projectName}`,
    color,
    fields: [
      { name: 'User', value: `${payload.userName} (${payload.userEmail})`, inline: true },
      { name: 'Category', value: payload.category, inline: true },
      { name: 'Subject', value: payload.subject, inline: false },
      { name: 'Message', value: payload.messageText, inline: false },
    ],
    timestamp: new Date().toISOString(),
  };

  if (payload.attachments && payload.attachments.length > 0) {
    embed.fields.push({
      name: 'Attachments',
      value: payload.attachments.map(att => `[${att.name}](${att.url})`).join('\n'),
      inline: false,
    });
  }

  return { embeds: [embed] };
}

function formatTeamsMessage(event: string, payload: DispatchPayload) {
  const themeColor = event === 'chat_started' ? '9333EA' : event === 'ticket_resolved' ? '10B981' : '3B82F6';
  const status = event === 'chat_started' ? 'New Support Ticket' : event === 'ticket_resolved' ? 'Ticket Resolved' : 'New Message';

  const sections: any[] = [
    {
      activityTitle: `${status} in ${payload.projectName}`,
      activitySubtitle: `Thread ID: ${payload.conversationId}`,
      facts: [
        { name: 'User', value: payload.userName },
        { name: 'Email', value: payload.userEmail },
        { name: 'Category', value: payload.category },
        { name: 'Subject', value: payload.subject },
      ],
      text: `**Message Details:**\n\n${payload.messageText}`,
    },
  ];

  if (payload.attachments && payload.attachments.length > 0) {
    sections.push({
      text: `**Attachments:**\n\n${payload.attachments.map(att => `* [${att.name}](${att.url})`).join('\n')}`,
    });
  }

  return {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor,
    summary: `${status} notification`,
    sections,
  };
}
