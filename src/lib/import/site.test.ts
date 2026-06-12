import { describe, it, expect } from 'vitest';
import { findOrCreateSite } from './site';

type Row = Record<string, unknown> & { id: string };
function fakeDb(state: { clients: Row[]; sites: Row[] }) {
  return {
    from(table: 'clients' | 'sites') {
      const f: Record<string, unknown> = {};
      const q: Record<string, unknown> = {
        select: () => q,
        eq: (c: string, v: unknown) => {
          f[c] = v;
          return q;
        },
        maybeSingle: () =>
          Promise.resolve({
            data: state[table].find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null,
          }),
        insert: (obj: Record<string, unknown>) => {
          const id = `${table}-${state[table].length + 1}`;
          state[table].push({ id, ...obj });
          return { select: () => ({ single: () => Promise.resolve({ data: { id } }) }) };
        },
      };
      return q;
    },
  };
}

describe('findOrCreateSite', () => {
  it('създава нов клиент + обект', async () => {
    const st = { clients: [] as Row[], sites: [] as Row[] };
    const r = await findOrCreateSite(fakeDb(st) as never, { clientName: 'ЕТ Нов', siteName: 'Склад А', address: 'Адрес 1', phone: '0888' });
    expect(r.createdClient).toBe(true);
    expect(r.createdSite).toBe(true);
    expect(r.siteId).toBeTruthy();
    expect(st.clients).toHaveLength(1);
    expect(st.sites).toHaveLength(1);
  });

  it('съществуващ клиент → нов обект, без дублиране на клиента', async () => {
    const st = { clients: [{ id: 'c1', name: 'ЕТ Стар' }] as Row[], sites: [] as Row[] };
    const r = await findOrCreateSite(fakeDb(st) as never, { clientName: 'ЕТ Стар', siteName: 'Склад Б' });
    expect(r.createdClient).toBe(false);
    expect(r.createdSite).toBe(true);
    expect(st.clients).toHaveLength(1);
    expect(st.sites).toHaveLength(1);
  });

  it('съществуващ клиент+обект → връща същия (идемпотентно)', async () => {
    const st = { clients: [{ id: 'c1', name: 'ЕТ Стар' }] as Row[], sites: [{ id: 's1', client_id: 'c1', name: 'Склад Б' }] as Row[] };
    const r = await findOrCreateSite(fakeDb(st) as never, { clientName: 'ЕТ Стар', siteName: 'Склад Б' });
    expect(r.siteId).toBe('s1');
    expect(r.createdSite).toBe(false);
    expect(st.sites).toHaveLength(1);
  });

  it('празно име → грешка', async () => {
    await expect(
      findOrCreateSite(fakeDb({ clients: [], sites: [] }) as never, { clientName: '', siteName: 'X' }),
    ).rejects.toThrow();
  });
});
