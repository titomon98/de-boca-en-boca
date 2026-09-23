import { EntityManager } from 'typeorm';
import { Account } from './entities/account.entity';
import { RestaurantTable } from './entities/table.entity';

/**
 * Recalcula y persiste el estado visual de una mesa a partir de las cuentas
 * vinculadas a ella:
 *  - 'billing'  si alguna cuenta sobre la mesa está en cobro
 *  - 'occupied' si hay al menos una cuenta abierta
 *  - 'free'     si no hay cuentas activas
 *
 * Se usa dentro de la misma transacción que abre/cierra cuentas, por eso
 * recibe el EntityManager en curso.
 */
export async function recomputeTableStatus(
  manager: EntityManager,
  tableId: number,
): Promise<string> {
  // La mesa "Para llevar" siempre queda libre: aloja varias órdenes en paralelo.
  const table = await manager.findOne(RestaurantTable, { where: { id: tableId } });
  if (table?.isTakeout) {
    if (table.status !== 'free') {
      await manager.update(RestaurantTable, { id: tableId }, { status: 'free' });
    }
    return 'free';
  }

  const rows = await manager
    .createQueryBuilder(Account, 'a')
    .innerJoin('a.tables', 't')
    .where('t.id = :tableId', { tableId })
    .andWhere('a.status IN (:...statuses)', { statuses: ['open', 'billing'] })
    .select('a.status', 'status')
    .getRawMany<{ status: string }>();

  let status = 'free';
  if (rows.some((r) => r.status === 'billing')) {
    status = 'billing';
  } else if (rows.length > 0) {
    status = 'occupied';
  }

  await manager.update(RestaurantTable, { id: tableId }, { status });
  return status;
}
