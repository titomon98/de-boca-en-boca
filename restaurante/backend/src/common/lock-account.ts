import { EntityManager } from 'typeorm';
import { Account } from '../modules/mesas/entities/account.entity';

/**
 * Bloquea la fila de la cuenta (SELECT ... FOR UPDATE) dentro de la transacción.
 * Se usa un QueryBuilder sin joins: findOne(Account) trae waiter y tables con
 * eager:true, y Postgres rechaza FOR UPDATE sobre el lado nullable de un outer
 * join. Aquí el lock toca sólo la tabla accounts; las relaciones se cargan
 * aparte con el findOne normal, ya con la fila bloqueada.
 */
export async function lockAccount(
  manager: EntityManager,
  accountId: number,
): Promise<void> {
  await manager
    .getRepository(Account)
    .createQueryBuilder('account')
    .setLock('pessimistic_write')
    .where('account.id = :accountId', { accountId })
    .getOne();
}
