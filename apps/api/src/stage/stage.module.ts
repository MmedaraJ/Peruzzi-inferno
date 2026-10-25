import { Module } from '@nestjs/common';
import { StageService } from './stage.service';
import { AsksService } from './asks.service';
import { VoiceService } from './voice.service';
import { SoundService } from './sound.service';
import { ContactsController, OptOutController, StageController } from './stage.controller';
import { PreviewController } from './preview.controller';

@Module({ providers: [StageService, AsksService, VoiceService, SoundService], controllers: [StageController, ContactsController, OptOutController, PreviewController], exports: [StageService, AsksService, VoiceService, SoundService] })
export class StageModule {}
