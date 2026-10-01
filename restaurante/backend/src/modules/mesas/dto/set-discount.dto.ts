import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/** Descuento a criterio del mesero (requiere descripción si es mayor a 0). */
export class SetDiscountDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  amount: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  reason?: string;
}
