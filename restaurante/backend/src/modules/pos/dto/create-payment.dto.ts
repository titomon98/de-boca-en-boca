import { IsIn, IsInt, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

/**
 * Registra un pago sobre una cuenta. Cuando la suma de pagos cubre el total
 * de la cuenta, ésta se marca como pagada y se liberan sus mesas.
 */
export class CreatePaymentDto {
  @IsInt()
  accountId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount: number;

  @IsIn(['cash', 'card', 'transfer'], {
    message: 'El método de pago debe ser cash, card o transfer',
  })
  paymentMethod: string;

  /** Propina opcional (aparte del monto). */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tip?: number;
}
