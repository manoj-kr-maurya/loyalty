import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { envEnums, Environments } from 'src/config/enums';
import { ServerSettingsEnvVariables } from 'src/config/types';
import { PrismaClientExceptionFilter } from 'src/common/exceptions/prisma/prisma-client-exception.filter';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    snapshot: true,
  });
  app.enableShutdownHooks();
  app.use(bodyParser.json({ limit: '10mb' }));
  app.use(bodyParser.urlencoded({ limit: '10mb', extended: true }));

  const config =
    app.get<ConfigService<ServerSettingsEnvVariables>>(ConfigService);

  const environment = config.get<string>(envEnums.ENVIRONMENT);

  if (environment !== Environments.prod) {
    app.enableCors({
      origin: ['http://localhost:5173', 'http://localhost:3000'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });
  } else {
    app.enableCors({
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    });
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Loyalty Engine')
    .setDescription('Loyalty engine')
    .setVersion('1.0')
    .addTag('loyalty-engine')
    .addBearerAuth()
    .addApiKey({ type: 'apiKey', name: 'x-api-key', in: 'header' }, 'x-api-key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  const port = config.get<number>(envEnums.PORT);
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  await app.listen(port);
}

bootstrap();
