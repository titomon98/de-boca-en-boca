import { ArrayMinSize, IsArray, IsIn, IsInt } from 'class-validator';

/** Cobro por producto: paga los renglones indicados de una cuenta. */
export class PayItemsDto {
  @IsInt()
  accountId: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  itemIds: number[];

  @IsIn(['cash', 'card', 'transfer'], {
    message: 'El método de pago debe ser cash, card o transfer',
  })
  paymentMethod: string;
}
