import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { envEnums, Environments } from './config/enums';
import { ServerSettingsEnvVariables } from './config/types';
import { PrismaClientExceptionFilter } from './common/exceptions/prisma/prisma-client-exception.filter';
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

  if (config.get<string>(envEnums.ENVIRONMENT) !== Environments.prod) {
    app.enableCors();
  }

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Loyalty Engine')
    .setDescription('Loyalty engine')
    .setVersion('1.0')
    .addTag('loyalty-engine')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api', app, document);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: false,
      transform: true,
    }),
  );
  const port = config.get<number>(envEnums.PORT);
  app.useGlobalFilters(new PrismaClientExceptionFilter());
  await app.listen(port);
}

bootstrap();
