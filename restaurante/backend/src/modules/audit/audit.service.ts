import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { AuditLog } from './entities/audit-log.entity';
import { AuthUser } from '../../common/decorators/current-user.decorator';

export interface AuditEntry {
  action: string;
  user: AuthUser;
  accountId?: number | null;
  orderId?: number | null;
  detail?: string | null;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /**
   * Registra una entrada de auditoría. Si se pasa un EntityManager, la escritura
   * participa en esa transacción; de lo contrario usa el repositorio normal.
   */
  async log(entry: AuditEntry, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(AuditLog) : this.repo;
    await repo.save(
      repo.create({
        action: entry.action,
        accountId: entry.accountId ?? null,
        orderId: entry.orderId ?? null,
        userId: entry.user?.id ?? null,
        userName: entry.user?.name ?? null,
        userRole: entry.user?.role ?? null,
        detail: entry.detail ?? null,
      }),
    );
  }

  /** Bitácora completa de una cuenta, en orden cronológico. */
  findByAccount(accountId: number): Promise<AuditLog[]> {
    return this.repo.find({
      where: { accountId },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
  }
}
