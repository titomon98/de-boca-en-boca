import { IsIn, IsString, MaxLength } from 'class-validator';

export class PrintDto {
  @IsIn(['cocina', 'barra', 'caja'])
  station: string;

  @IsString()
  @MaxLength(20000)
  text: string;
}
