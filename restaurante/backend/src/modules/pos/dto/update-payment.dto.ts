import { IsIn, IsNumber, IsOptional, IsPositive, Min } from 'class-validator';

/** Corrección de un cobro ya registrado. Queda en la bitácora. */
export class UpdatePaymentDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  amount?: number;

  @IsOptional()
  @IsIn(['cash', 'card', 'transfer'], {
    message: 'El método de pago debe ser cash, card o transfer',
  })
  paymentMethod?: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  tip?: number;
}
