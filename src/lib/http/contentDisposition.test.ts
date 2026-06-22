import { describe, it, expect } from 'vitest';
import { attachmentDisposition } from './contentDisposition';

describe('attachmentDisposition', () => {
  it('ASCII име минава директно', () => {
    expect(attachmentDisposition('protokol-16-2026.docx')).toBe(
      `attachment; filename="protokol-16-2026.docx"; filename*=UTF-8''protokol-16-2026.docx`,
    );
  });

  it('кирилица → целият хедър е ASCII (иначе 500) + RFC5987 с истинското име', () => {
    const v = attachmentDisposition('protokol-ТЕСТ-2026.docx');
    // Целият хедър ТРЯБВА да е само печатима латиница, иначе задаването му чупи отговора.
    expect(/^[\x20-\x7E]*$/.test(v)).toBe(true);
    expect(v).toContain('filename="protokol-____-2026.docx"');
    expect(v).toContain("filename*=UTF-8''protokol-%D0%A2%D0%95%D0%A1%D0%A2-2026.docx");
  });
});
