import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RestaurantTable } from './entities/table.entity';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';

@Injectable()
export class TablesService {
  constructor(
    @InjectRepository(RestaurantTable)
    private readonly tablesRepository: Repository<RestaurantTable>,
  ) {}

  async create(dto: CreateTableDto): Promise<RestaurantTable> {
    const existing = await this.tablesRepository.findOne({
      where: { number: dto.number },
    });
    if (existing) {
      throw new ConflictException(`Ya existe la mesa número ${dto.number}`);
    }
    const table = this.tablesRepository.create({
      number: dto.number,
      capacity: dto.capacity ?? 4,
      status: 'free',
    });
    return this.tablesRepository.save(table);
  }

  /** Mapa de mesas ordenado por número. */
  findAll(): Promise<RestaurantTable[]> {
    return this.tablesRepository.find({ order: { number: 'ASC' } });
  }

  async findOne(id: number): Promise<RestaurantTable> {
    const table = await this.tablesRepository.findOne({ where: { id } });
    if (!table) {
      throw new NotFoundException('Mesa no encontrada');
    }
    return table;
  }

  async update(id: number, dto: UpdateTableDto): Promise<RestaurantTable> {
    const table = await this.findOne(id);
    if (table.isTakeout) {
      throw new BadRequestException('La mesa "Para llevar" no se puede modificar');
    }
    if (dto.number !== undefined && dto.number !== table.number) {
      const existing = await this.tablesRepository.findOne({
        where: { number: dto.number },
      });
      if (existing) {
        throw new ConflictException(`Ya existe la mesa número ${dto.number}`);
      }
      table.number = dto.number;
    }
    if (dto.capacity !== undefined) table.capacity = dto.capacity;
    return this.tablesRepository.save(table);
  }

  async remove(id: number): Promise<void> {
    const table = await this.findOne(id);
    if (table.isTakeout) {
      throw new BadRequestException('La mesa "Para llevar" no se puede eliminar');
    }
    if (table.status !== 'free') {
      throw new BadRequestException(
        'No se puede eliminar una mesa que no está libre',
      );
    }
    await this.tablesRepository.remove(table);
  }
}
