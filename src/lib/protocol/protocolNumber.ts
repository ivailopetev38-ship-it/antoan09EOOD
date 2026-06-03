/** Връща следващия номер на протокол като "пореден/година". */
export function nextProtocolNumber(year: number, countThisYear: number): string {
  return `${countThisYear + 1}/${year}`;
}
