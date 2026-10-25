import { Module } from '@nestjs/common';
import { AdminController, AdminLoginController } from './admin.controller';
import { InsightsService } from './insights.service';
import { CostsService } from './costs.service';
import { StageModule } from '../stage/stage.module';

@Module({ imports: [StageModule], controllers: [AdminLoginController, AdminController], providers: [InsightsService, CostsService] })
export class AdminModule {}
