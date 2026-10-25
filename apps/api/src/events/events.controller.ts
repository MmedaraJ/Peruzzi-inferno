import { Body, Controller, Post } from '@nestjs/common';
import { CLIENT_EVENTS, EventsService } from './events.service';

@Controller('api/events')
export class EventsController {
  constructor(private events: EventsService) {}
  @Post()
  add(@Body() b: { name?: string; device?: string; props?: Record<string, any> }) {
    const name = String(b?.name || '');
    if (!CLIENT_EVENTS.has(name)) return { ok: false };
    // a handful of short values per event, so nobody can store essays through the counter
    const props: Record<string, any> = {};
    for (const [k, v] of Object.entries(b.props || {}).slice(0, 8)) if (['string', 'number', 'boolean'].includes(typeof v)) props[k.slice(0, 24)] = typeof v === 'string' ? v.slice(0, 64) : v;
    this.events.add(name, b.device, props);
    return { ok: true };
  }
}
