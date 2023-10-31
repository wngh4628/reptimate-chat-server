import { AuthModule } from './../auth/auth.module';
import { forwardRef, Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { TypeOrmExModule } from 'src/core/typeorm-ex.module';
import { UserRepository } from './repositories/user.repository';
import { RedisModule } from '@liaoliaots/nestjs-redis';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    // ConfigModule.forRoot({
    //   isGlobal: true,
    //   envFilePath: process.env.NODE_ENV === 'dev' ? 'env.dev' : 'env.prod',
    // }),
    TypeOrmExModule.forCustomRepository([UserRepository]),
    forwardRef(() => AuthModule),
    // RedisModule.forRoot({
    //   readyLog: true,
    //   config: {
    //     host: process.env.REDIS_HOST,
    //     port: 6379,
    //     password: process.env.REDIS_PASSWORD
    //   },
    // }),
  ],
  
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService, TypeOrmExModule],
})
export class UserModule {}
