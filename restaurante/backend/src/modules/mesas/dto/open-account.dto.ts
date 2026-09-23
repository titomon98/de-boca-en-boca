import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Abre una cuenta sobre una o varias mesas.
 * - tableIds con más de un elemento une mesas en una sola cuenta.
 * - Abrir otra cuenta sobre una mesa ya ocupada crea una cuenta separada.
 */
export class OpenAccountDto {
  @IsString()
  @MaxLength(80)
  label: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  tableIds: number[];

  @IsOptional()
  @IsInt()
  waiterId?: number;
}
