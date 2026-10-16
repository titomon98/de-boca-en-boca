import { IsNumber, IsOptional, IsString, Min, MaxLength } from 'class-validator';

/** Edición de un cierre de caja. Solo el conteo y la nota; queda en bitácora. */
export class UpdateCashClosingDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCash?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedCard?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  countedTransfer?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;
}
