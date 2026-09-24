import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class OrderItemInputDto {
  @IsInt()
  menuItemId: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  quantity: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  /**
   * Productos elegidos en los grupos de elección del platillo (ej. los 2
   * aderezos de un combo). Se agregan como componentes a Q0 y se cuentan en
   * analítica. Puede repetir ids (ej. 2 veces Ranch).
   */
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  chosenItemIds?: number[];
}

/**
 * Comanda enviada por el mesero. El precio unitario lo fija el sistema desde
 * el menú; el cliente sólo envía qué platillos y cuántos.
 */
export class CreateOrderDto {
  @IsInt()
  accountId: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemInputDto)
  items: OrderItemInputDto[];
}
