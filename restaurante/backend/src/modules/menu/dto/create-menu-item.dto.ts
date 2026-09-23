import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @MaxLength(150)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsInt()
  categoryId?: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price: number;

  @IsOptional()
  @IsIn(['food', 'drink'], { message: 'El tipo debe ser food o drink' })
  type?: string;

  @IsOptional()
  @IsBoolean()
  available?: boolean;

  /** Imagen del platillo en base64 (data URL). */
  @IsOptional()
  @IsString()
  image?: string;
}
