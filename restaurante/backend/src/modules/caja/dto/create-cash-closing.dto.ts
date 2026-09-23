import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Cierre de caja. El sistema calcula los totales cobrados (efectivo/tarjeta)
 * desde el último cierre. `countedCash` es el efectivo contado físicamente;
 * si se envía, se calcula la diferencia contra el efectivo esperado.
 */
export class CreateCashClosingDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  countedCash?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
