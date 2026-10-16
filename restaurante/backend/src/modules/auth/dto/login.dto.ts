import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class LoginDto {
  /** Correo completo o solo el usuario (lo que va antes de la @). */
  @IsString()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;
}
