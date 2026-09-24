import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** Un extra incluido en el platillo (no se cobra). */
export class MenuIncludeDto {
  @IsString()
  @MaxLength(60)
  label: string;

  /** Opciones a elegir al agregar (ej. sabores de aderezo). Vacío = sin elección. */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  options?: string[];

  /** Cuántas opciones se eligen (ej. 20 alitas => 2 aderezos). Default 1. */
  @IsOptional()
  @IsInt()
  @Min(1)
  choose?: number;
}

/** Un componente de combo, ligado a un producto real del menú. */
export class ComboComponentDto {
  @IsInt()
  itemId: number;

  @IsInt()
  @Min(1)
  quantity: number;
}

/** Definición de combo: lista de componentes reales (precio de paquete = price). */
export class ComboDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ComboComponentDto)
  components: ComboComponentDto[];
}

/** Grupo de elección ligado a productos reales (ej. "elige 2 aderezos"). */
export class ChoiceGroupDto {
  @IsString()
  @MaxLength(60)
  label: string;

  @IsInt()
  @Min(1)
  choose: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  optionItemIds: number[];
}

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

  /** Extras incluidos (no se cobran). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MenuIncludeDto)
  includes?: MenuIncludeDto[];

  /** Definición de combo (componentes ligados a productos reales). Null = no es combo. */
  @IsOptional()
  @ValidateNested()
  @Type(() => ComboDto)
  combo?: ComboDto | null;

  /** Grupos de elección ligados a productos reales (ej. sabores de aderezo). */
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChoiceGroupDto)
  choiceGroups?: ChoiceGroupDto[] | null;
}
