import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';

/** The moments Insights counts. Recording one never holds up the request that caused it. */
export const CLIENT_EVENTS = new Set([
  'stage_view', 'write', 'stream_click', 'help_view', 'note_view', 'note_save', 'note_share', 'note_send_open',
  'tracklist_view', 'tracklist_save', 'tracklist_share', 'public_note_view', 'public_tracklist_view', 'write_own_click',
  'answer_view', 'answer_open', 'answer_save', 'answer_share', 'back_click',
  'sound_off', 'sound_on', 'credit_click', 'music_back',
]);

@Injectable()
export class EventsService {
  private log = new Logger('events');
  constructor(private prisma: PrismaService) {}
  add(name: string, device: string | null | undefined, props: Record<string, any> = {}) {
    this.prisma.event.create({ data: { name, device: device ? String(device).slice(0, 64) : null, props } }).catch((e) => this.log.warn(`event ${name}: ${e}`));
  }
}
