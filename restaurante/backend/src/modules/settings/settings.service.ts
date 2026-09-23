import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting } from './entities/setting.entity';

@Injectable()
export class SettingsService {
  constructor(
    @InjectRepository(Setting)
    private readonly repo: Repository<Setting>,
  ) {}

  /** Devuelve todas las configuraciones como un objeto plano. */
  async getAll(): Promise<Record<string, string>> {
    const rows = await this.repo.find();
    const out: Record<string, string> = {};
    for (const r of rows) out[r.key] = r.value ?? '';
    return out;
  }

  /** Actualiza (o crea) varias configuraciones. */
  async update(values: Record<string, string>): Promise<Record<string, string>> {
    for (const [key, value] of Object.entries(values)) {
      await this.repo.save(this.repo.create({ key, value: String(value) }));
    }
    return this.getAll();
  }
}
