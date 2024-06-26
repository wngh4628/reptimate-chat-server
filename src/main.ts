import { ValidationPipe, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
// import { setNestApp } from './core/http/interceptors';
import { initSwagger } from './core/swagger/swagger-config';
import { logger } from './utils/logger';

async function bootstrap() {
  logger.info(
    `====================== API Start - ${process.env.NODE_ENV} !!======================`,
  );
  logger.info(
    `====================== MYSQL_HOST Start - ${process.env.MYSQL_HOST} !!======================`,
  );
  const app = await NestFactory.create(AppModule);

  // 스웨거 시작
  initSwagger(app);

  // api 버전 추가
  app.enableVersioning({
    type: VersioningType.URI,
  });

  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  // cors 설정
  app.enableCors({
    origin: '*', // 모든 origin에서 접근 허용 (실제 프로덕션 환경에서는 '*' 대신 특정 origin을 명시)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS', // 허용할 HTTP 메서드
    credentials: true, // 인증 정보 전달 여부 (옵션)
  });

  // setNestApp(app);

  await app.listen(3000);
}
bootstrap();
