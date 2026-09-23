/** Redondeo monetario a 2 decimales. */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
