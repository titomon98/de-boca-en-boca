import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

/** Marca una cuenta como envío a domicilio y el efectivo para el motorista. */
export class SetDeliveryDto {
  @IsBoolean()
  isDelivery: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  courierFee?: number;
}
