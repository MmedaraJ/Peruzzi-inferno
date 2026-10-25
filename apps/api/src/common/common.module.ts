import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { ConfigService } from './config.service';
import { MailService } from './mail.service';

@Global()
@Module({ providers: [PrismaService, ConfigService, MailService], exports: [PrismaService, ConfigService, MailService] })
export class CommonModule {}
