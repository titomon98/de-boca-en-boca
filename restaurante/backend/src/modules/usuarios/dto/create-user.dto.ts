import { IsEnum, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '../../../common/enums/role.enum';

export class CreateUserDto {
  @IsString()
  @MaxLength(150)
  name: string;

  /** Correo o solo un usuario (sin espacios). */
  @IsString()
  @MinLength(3, { message: 'El usuario debe tener al menos 3 caracteres' })
  @MaxLength(150)
  @Matches(/^\S+$/, { message: 'El usuario no puede llevar espacios' })
  email: string;

  @IsString()
  @MinLength(6)
  @MaxLength(72)
  password: string;

  @IsEnum(Role, {
    message: 'El rol debe ser administrator, waiter, cashier o kitchen',
  })
  role: Role;
}
