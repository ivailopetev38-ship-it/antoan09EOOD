import type { ExtinguisherType } from './types';

/** Категория по БДС ISO 11602-2 за пожарогасители ПОД НАЛЯГАНЕ (масовият случай).
 *  К1 — вода/вода с добавки/пяна; К2 — прах/халон; К5 — CO2.
 *  (К3/К4 = с газов патрон — рядкост, избира се ръчно от менюто.) */
export function deriveCategory(type: ExtinguisherType): 'К1' | 'К2' | 'К5' {
  switch (type) {
    case 'water':
    case 'foam':
      return 'К1';
    case 'powder_abc':
    case 'powder_bc':
      return 'К2';
    case 'co2':
      return 'К5';
  }
}
