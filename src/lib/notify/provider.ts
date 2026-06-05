export interface NotifyResult {
  sent: boolean;
  preview: string;
  channel: string;
}

export interface NotifyProvider {
  send(text: string): Promise<NotifyResult>;
}

function hermesNotify(url: string, token: string): NotifyProvider {
  return {
    async send(text: string): Promise<NotifyResult> {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error(`Hermes notify ${res.status}`);
      return { sent: true, preview: text, channel: 'telegram' };
    },
  };
}

function fallbackNotify(): NotifyProvider {
  return {
    async send(text: string): Promise<NotifyResult> {
      return { sent: false, preview: text, channel: 'preview' };
    },
  };
}

export function getNotifyProvider(): NotifyProvider {
  const url = process.env.HERMES_NOTIFY_URL;
  const token = process.env.HERMES_API_TOKEN ?? '';
  return url ? hermesNotify(url, token) : fallbackNotify();
}
