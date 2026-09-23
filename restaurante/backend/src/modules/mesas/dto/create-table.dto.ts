import { IsInt, IsOptional, IsPositive, Min } from 'class-validator';

export class CreateTableDto {
  @IsInt()
  @IsPositive()
  number: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;
}
