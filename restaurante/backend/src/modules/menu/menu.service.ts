import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuItem } from './entities/menu-item.entity';
import { OrderItem } from '../comandas/entities/order-item.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,
    @InjectRepository(OrderItem)
    private readonly orderItemsRepository: Repository<OrderItem>,
  ) {}

  create(dto: CreateMenuItemDto): Promise<MenuItem> {
    const item = this.menuItemsRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      categoryId: dto.categoryId ?? null,
      price: dto.price,
      type: dto.type ?? 'food',
      available: dto.available ?? true,
      image: dto.image ?? null,
    });
    return this.menuItemsRepository.save(item);
  }

  /**
   * Lista el menú (incluye la imagen base64 para el selector con fotos).
   * Con onlyAvailable=true, sólo platillos disponibles.
   */
  findAll(onlyAvailable = false): Promise<MenuItem[]> {
    const qb = this.menuItemsRepository
      .createQueryBuilder('mi')
      .leftJoinAndSelect('mi.category', 'category')
      .addSelect('mi.image')
      .orderBy('mi.name', 'ASC');
    if (onlyAvailable) {
      qb.where('mi.available = :a', { a: true });
    }
    return qb.getMany();
  }

  async findOne(id: number): Promise<MenuItem> {
    const item = await this.menuItemsRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Platillo no encontrado');
    }
    return item;
  }

  async update(id: number, dto: UpdateMenuItemDto): Promise<MenuItem> {
    const item = await this.findOne(id);
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.description !== undefined) item.description = dto.description ?? null;
    if (dto.categoryId !== undefined) item.categoryId = dto.categoryId ?? null;
    if (dto.price !== undefined) item.price = dto.price;
    if (dto.type !== undefined) item.type = dto.type;
    if (dto.available !== undefined) item.available = dto.available;
    if (dto.image !== undefined) item.image = dto.image ?? null;
    return this.menuItemsRepository.save(item);
  }

  async remove(id: number): Promise<void> {
    const item = await this.findOne(id);
    // order_items.menu_item_id es NOT NULL sin ON DELETE: borrar un producto
    // ya vendido rompería el historial de cuentas. Si tiene ventas, se desactiva.
    const sales = await this.orderItemsRepository.count({
      where: { menuItemId: id },
    });
    if (sales > 0) {
      if (item.available) {
        item.available = false;
        await this.menuItemsRepository.save(item);
      }
      throw new BadRequestException(
        'El producto tiene ventas registradas; se marcó como no disponible en lugar de eliminarlo',
      );
    }
    await this.menuItemsRepository.remove(item);
  }
}
