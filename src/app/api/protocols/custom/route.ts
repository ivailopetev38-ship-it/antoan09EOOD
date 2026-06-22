import { NextResponse } from 'next/server';
import { generateCustomProtocol } from '@/lib/protocol/custom';
import { attachmentDisposition } from '@/lib/http/contentDisposition';
import type { ProtocolData } from '@/lib/protocol/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let data: ProtocolData;
  try {
    data = await req.json();
  } catch {
    return NextResponse.json({ error: 'Невалиден JSON' }, { status: 400 });
  }
  if (!data || !Array.isArray(data.lines) || data.lines.length === 0) {
    return NextResponse.json({ error: 'Няма редове за протокол' }, { status: 400 });
  }
  const { buffer, filename } = await generateCustomProtocol(data);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': attachmentDisposition(filename),
    },
  });
}
