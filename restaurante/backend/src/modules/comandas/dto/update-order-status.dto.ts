import { IsIn } from 'class-validator';

export const ORDER_STATUSES = [
  'pending',
  'in_preparation',
  'ready',
  'delivered',
  'cancelled',
] as const;

export class UpdateOrderStatusDto {
  @IsIn(ORDER_STATUSES, {
    message:
      'El estado debe ser pending, in_preparation, ready, delivered o cancelled',
  })
  status: string;
}
