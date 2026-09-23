import {
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

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

  @IsString()
  @MaxLength(30)
  paymentMethod: string;
}
