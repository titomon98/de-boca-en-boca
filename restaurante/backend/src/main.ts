import { NestFactory, Reflector } from '@nestjs/core';
import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

// Zona horaria fija de Guatemala (UTC-6, sin horario de verano). Así las fechas
// guardadas y los reportes por día son consistentes en local y en Render (UTC).
process.env.TZ = process.env.TZ || 'America/Guatemala';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api');

  // Cuerpos más grandes para admitir imágenes de platillos en base64.
  const { json, urlencoded } = await import('express');
  app.use(json({ limit: '8mb' }));
  app.use(urlencoded({ extended: true, limit: '8mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.useGlobalInterceptors(
    new ClassSerializerInterceptor(app.get(Reflector)),
  );

  app.useGlobalFilters(new HttpExceptionFilter());

  // === Configuración de CORS ===
  const corsOrigin = config.get<string>('CORS_ORIGIN');

  const allowedOrigins = [
    'http://localhost:3000',
    'https://restaurante-demo-gules.vercel.app',
    ...(corsOrigin ? corsOrigin.split(',') : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Permite peticiones sin origin (Postman, mobile) o dentro de la lista blanca
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`Origen ${origin} no permitido por CORS`));
      }
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  const port = parseInt(config.get<string>('PORT', '3002'), 10);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Restaurante backend escuchando en puerto ${port}`);
}

bootstrap();