/**
 * Header-safe стойност за `Content-Disposition: attachment`.
 *
 * HTTP хедърите са latin1 — не-ASCII име на файл (напр. кирилица в номера на
 * протокол) хвърля при задаване на хедъра и връща 500. Затова даваме:
 *  - `filename="..."` с ASCII резервно име (не-ASCII → „_"), за стари четци;
 *  - `filename*=UTF-8''...` (RFC 5987) с истинското име, за модерните браузъри.
 */
export function attachmentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]/g, '_').replace(/"/g, "'");
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}
