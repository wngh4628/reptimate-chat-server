import { Repository } from 'typeorm';
import { CustomRepository } from 'src/core/decorators/typeorm-ex.decorator';
import { fbToken } from '../entities/fbtoken.entity';

@CustomRepository(fbToken)
export class FbTokenRepository extends Repository<fbToken> {}
