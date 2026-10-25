import { Module } from '@nestjs/common';
import { CommonModule } from './common/common.module';
import { EventsModule } from './events/events.module';
import { StageModule } from './stage/stage.module';
import { AdminModule } from './admin/admin.module';
import { SiteController } from './site/site.controller';

@Module({ imports: [CommonModule, EventsModule, StageModule, AdminModule], controllers: [SiteController] })
export class AppModule {}
