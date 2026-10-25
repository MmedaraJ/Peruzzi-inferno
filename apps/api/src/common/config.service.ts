import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { COSTS_DEFAULTS, CostsConfig, SITE_DEFAULTS, STAGE_DEFAULTS, SiteConfig, StageConfig } from './defaults';
import { EMAIL_DEFAULTS, EmailKind, EmailTemplate } from './emails';

export const CONFIG_KEYS = ['site', 'stage', 'emails', 'costs'] as const;
export type ConfigKey = typeof CONFIG_KEYS[number];
export const DEFAULTS: Record<ConfigKey, any> = { site: SITE_DEFAULTS, stage: STAGE_DEFAULTS, emails: EMAIL_DEFAULTS, costs: COSTS_DEFAULTS };

/** A saved object keeps every field the admin set, and gains any field added to the defaults since. Lists are taken whole. */
export function withDefaults<T>(def: T, saved: any): T {
  if (saved == null) return def;
  if (Array.isArray(def) || typeof def !== 'object' || def === null) return saved as T;
  const out: any = { ...def };
  for (const k of Object.keys(saved)) out[k] = k in (def as any) ? withDefaults((def as any)[k], saved[k]) : saved[k];
  return out;
}

/** Settings live in the Config table and are read through a 15-second cache. */
@Injectable()
export class ConfigService {
  private cache: { at: number; data: Record<string, any> } | null = null;
  constructor(private prisma: PrismaService) {}
  async all(): Promise<Record<string, any>> {
    if (this.cache && Date.now() - this.cache.at < 15_000) return this.cache.data;
    const rows = await this.prisma.config.findMany({ where: { key: { in: [...CONFIG_KEYS] } } });
    const data: Record<string, any> = {};
    for (const k of CONFIG_KEYS) data[k] = withDefaults(DEFAULTS[k], rows.find((r) => r.key === k)?.value);
    this.cache = { at: Date.now(), data };
    return data;
  }
  invalidate() { this.cache = null; }
  async set(key: ConfigKey, value: any) { await this.prisma.config.upsert({ where: { key }, create: { key, value }, update: { value } }); this.invalidate(); }
  async site(): Promise<SiteConfig> { return (await this.all()).site; }
  async stage(): Promise<StageConfig> { return (await this.all()).stage; }
  async costs(): Promise<CostsConfig> { return (await this.all()).costs; }
  async emails(): Promise<Record<EmailKind, EmailTemplate>> { return (await this.all()).emails; }
  /** Insights and the public counts leave out everything before this (the team's testing before launch). */
  async countFrom(): Promise<Date | null> { const v = (await this.site()).countFrom; const d = v ? new Date(v) : null; return d && !isNaN(d.getTime()) ? d : null; }
  get webUrl() { return (process.env.WEB_URL || 'http://localhost:5173').replace(/\/$/, ''); }
  get apiUrl() { return (process.env.API_URL || 'http://localhost:4000').replace(/\/$/, ''); }
  get siteName() { return process.env.SITE_NAME || new URL(this.webUrl).host; }
}
