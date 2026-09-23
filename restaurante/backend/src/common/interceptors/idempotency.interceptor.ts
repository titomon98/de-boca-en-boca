import {
  CallHandler,
  ConflictException,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Observable, defer, firstValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';

type StoredRequest = {
  request_hash: string;
  state: 'processing' | 'completed';
  response_body: unknown;
};

/** Idempotencia persistente para POST, compartida entre instancias. */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private readonly waitMs = 10_000;

  constructor(private readonly dataSource: DataSource) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    if (!req || req.method !== 'POST') return next.handle();

    return defer(async () => {
      const identity = String(req.user?.id ?? `anon:${req.ip ?? 'unknown'}`);
      const route = req.originalUrl || req.url || '';
      const requestHash = this.hash(JSON.stringify(req.body ?? null));
      const header = req.headers['idempotency-key'];
      const hasExplicitKey = typeof header === 'string' && Boolean(header.trim());
      const clientKey = hasExplicitKey
        ? header.trim()
        : `automatic:${requestHash}`;
      const keyHash = this.hash(`${identity}|POST|${route}|${clientKey}`);

      const completedTtlMinutes = hasExplicitKey ? 60 : 0.1;
      const owned = await this.reserve(keyHash, identity, route, requestHash);
      if (!owned) {
        return (await this.waitForResult(keyHash, requestHash)).response_body;
      }

      try {
        const result = await firstValueFrom(next.handle());
        await this.complete(keyHash, result, completedTtlMinutes);
        return result;
      } catch (error) {
        await this.release(keyHash);
        throw error;
      }
    });
  }

  private table(): string {
    const schema = String(
      (this.dataSource.options as { schema?: string }).schema || 'restaurante',
    );
    if (!/^[a-z_][a-z0-9_]*$/i.test(schema)) {
      throw new Error('DB_SCHEMA contiene un identificador inválido');
    }
    return `"${schema}"."idempotency_keys"`;
  }

  private async reserve(
    key: string,
    identity: string,
    route: string,
    requestHash: string,
  ) {
    await this.dataSource.query(`DELETE FROM ${this.table()} WHERE expires_at <= now()`);
    const rows = await this.dataSource.query(
      `INSERT INTO ${this.table()}
         (key_hash, identity, route, request_hash, state, expires_at)
       VALUES ($1, $2, $3, $4, 'processing', now() + interval '10 minutes')
       ON CONFLICT (key_hash) DO NOTHING RETURNING key_hash`,
      [key, identity, route, requestHash],
    );
    return rows.length === 1;
  }

  private async waitForResult(key: string, requestHash: string): Promise<StoredRequest> {
    const deadline = Date.now() + this.waitMs;
    do {
      const rows: StoredRequest[] = await this.dataSource.query(
        `SELECT request_hash, state, response_body FROM ${this.table()} WHERE key_hash = $1`,
        [key],
      );
      const stored = rows[0];
      if (!stored) throw new ConflictException('La operación anterior expiró; intente nuevamente');
      if (stored.request_hash !== requestHash) {
        throw new ConflictException('Idempotency-Key reutilizada con datos diferentes');
      }
      if (stored.state === 'completed') return stored;
      await new Promise((resolve) => setTimeout(resolve, 100));
    } while (Date.now() < deadline);
    throw new ConflictException('La operación idéntica todavía está en proceso');
  }

  private async complete(key: string, response: unknown, ttlMinutes: number) {
    await this.dataSource.query(
      `UPDATE ${this.table()}
          SET state = 'completed', response_body = $2::jsonb, completed_at = now(),
              expires_at = now() + ($3 * interval '1 minute')
        WHERE key_hash = $1`,
      [key, JSON.stringify(response ?? null), ttlMinutes],
    );
  }

  private async release(key: string) {
    await this.dataSource.query(`DELETE FROM ${this.table()} WHERE key_hash = $1`, [key]);
  }

  private hash(value: string) {
    return createHash('sha256').update(value).digest('hex');
  }
}
