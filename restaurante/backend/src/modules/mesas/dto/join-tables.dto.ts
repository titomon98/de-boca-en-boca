import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

/** Une una o más mesas adicionales a una cuenta existente. */
export class JoinTablesDto {
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  tableIds: number[];
}
