import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuItem } from './entities/menu-item.entity';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoriesRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private readonly menuItemsRepository: Repository<MenuItem>,
  ) {}

  create(dto: CreateCategoryDto): Promise<MenuCategory> {
    const category = this.categoriesRepository.create(dto);
    return this.categoriesRepository.save(category);
  }

  findAll(): Promise<MenuCategory[]> {
    return this.categoriesRepository.find({ order: { id: 'ASC' } });
  }

  async findOne(id: number): Promise<MenuCategory> {
    const category = await this.categoriesRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Categoría no encontrada');
    }
    return category;
  }

  async update(id: number, dto: UpdateCategoryDto): Promise<MenuCategory> {
    const category = await this.findOne(id);
    Object.assign(category, dto);
    return this.categoriesRepository.save(category);
  }

  async remove(id: number): Promise<void> {
    const category = await this.findOne(id);
    // Desvincula los platillos de esta categoría para no violar la FK.
    await this.menuItemsRepository.update(
      { categoryId: id },
      { categoryId: null },
    );
    await this.categoriesRepository.remove(category);
  }
}
