import { ValueTransformer } from 'typeorm';

/**
 * El driver de PostgreSQL devuelve columnas NUMERIC/DECIMAL como string
 * para preservar precisión. Este transformer las expone como number en las
 * entidades. Adecuado para montos y cantidades del dominio de restaurante.
 */
export class NumericTransformer implements ValueTransformer {
  to(value: number | null): number | null {
    return value;
  }

  from(value: string | null): number | null {
    return value === null || value === undefined ? null : parseFloat(value);
  }
}

export const numericTransformer = new NumericTransformer();
