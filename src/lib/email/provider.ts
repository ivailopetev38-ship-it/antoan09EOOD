export interface EmailAttachment {
  filename: string;
  content: string; // base64
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface EmailResult {
  sent: boolean;
  provider: string;
  id?: string;
  error?: string;
}

export interface EmailProvider {
  send(msg: EmailMessage): Promise<EmailResult>;
}

function resendProvider(apiKey: string, from: string): EmailProvider {
  return {
    async send(msg: EmailMessage): Promise<EmailResult> {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from,
          to: [msg.to],
          subject: msg.subject,
          html: msg.html,
          text: msg.text,
          attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        return { sent: false, provider: 'resend', error: `${res.status} ${t}` };
      }
      const j = (await res.json()) as { id?: string };
      return { sent: true, provider: 'resend', id: j.id };
    },
  };
}

function fallbackProvider(): EmailProvider {
  return {
    async send(): Promise<EmailResult> {
      return { sent: false, provider: 'preview', error: 'Няма имейл провайдър (липсва RESEND_API_KEY)' };
    },
  };
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'onboarding@resend.dev';
  return key ? resendProvider(key, from) : fallbackProvider();
}
