import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Venue } from './entities/venue.entity';

@Injectable()
export class VenuesService {
  constructor(
    @InjectRepository(Venue)
    private readonly venuesRepository: Repository<Venue>,
  ) {}

  findAll(): Promise<Venue[]> {
    return this.venuesRepository.find({ order: { id: 'ASC' } });
  }

  /** Sede por defecto (la primera activa). Usada al abrir cuentas. */
  async defaultVenueId(): Promise<number | null> {
    const v = await this.venuesRepository.findOne({
      where: { active: true },
      order: { id: 'ASC' },
    });
    return v ? v.id : null;
  }
}
