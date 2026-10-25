/** What a fresh site starts with. Every key here is a row in the Config table that the admin can change; until it's
 *  saved, these are what the site uses. */

export interface SiteConfig {
  /** the artist, and the song the site is for ("Listen to Inferno") */
  artist: string; song: string; smartLink: string; handle: string;
  demoNotice: boolean; demoText: string; credit: boolean; countFrom?: string | null;
}
export type VoiceMode = 'off' | 'mc' | 'artist_lines' | 'artist_ai';
export type Humour = 'sweet' | 'cheeky' | 'spicy';
export interface StageConfig {
  open: boolean; pausedMessage: string;
  /** the name on the stage, and the one that signs every note */
  nameplate: string; humour: Humour;
  notesPerDay: number; asksPerDay: number;
  /** notes a day through one connection to the server (see ipOf). Through the site that's Vercel's, shared by everyone
   *  near the same Vercel server, so it's off (0) unless set: the hourly AI ceilings hold the bill. It's for callers
   *  that come to the API directly; set it in the thousands if that happens. */
  notesPerDayPerConnection: number;
  /** the most paid calls to the AI in an hour, everyone together: what holds the bill. Readings of notes asked (past
   *  it, a prepared line stands in, as when the AI is down) and drafts while people type (past it, Peruzzi starts on
   *  the note when it's handed up). 0: none at all. */
  aiNotesPerHour: number; aiDraftsPerHour: number;
  /** what people typed is wiped after this many days; Peruzzi's words and the notes' tidied lines stay for the links */
  retentionDays: number;
  voice: { mode: VoiceMode; mcVoiceId: string; aiLabel: string };
  music: { level: number; duck: number };
  help: { title: string; body: string; links: { label: string; url: string }[] };
  /** tell people Peruzzi may read the best notes out live. Only once his team has agreed. */
  readLive: boolean;
}

export const SITE_DEFAULTS: SiteConfig = {
  artist: 'Peruzzi',
  song: 'Inferno',
  smartLink: 'https://open.spotify.com/search/Peruzzi%20Inferno',
  handle: '',
  demoNotice: true,
  demoText: 'A concept demo by Mmedara Josiah. Not an official Peruzzi site yet.',
  credit: true,
  countFrom: null,
};

export const STAGE_DEFAULTS: StageConfig = {
  open: true,
  pausedMessage: 'Peruzzi is between sets. The stage opens again soon.',
  nameplate: 'Peruzzi',
  humour: 'cheeky',
  notesPerDay: 10,
  notesPerDayPerConnection: 0,
  // about half a cent a call: at most about $9 an hour, whatever anyone sends
  aiNotesPerHour: 600,
  aiDraftsPerHour: 1200,
  asksPerDay: 3,
  retentionDays: 30,
  // a stock ElevenLabs voice reads as the MC until the admin picks another
  voice: { mode: 'off', mcVoiceId: 'onwK4e9ZLuTAKqWW03F9', aiLabel: 'AI voice' },
  // how loud the song sounds, as a share of full: a quarter, and a tenth under the stage's sounds
  music: { level: 0.25, duck: 0.1 },
  readLive: false,
  help: {
    title: 'This one deserves more than a song.',
    body: 'Peruzzi is putting the mic down. What you’ve written sounds serious, and you deserve real support, not a note. If you are in danger right now, call 112 (Nigeria’s emergency line) or your local emergency number, and tell someone you trust.',
    links: [{ label: 'Find a free, confidential helpline', url: 'https://findahelpline.com' }],
  },
};

/** A bill the site runs up whatever its traffic: hosting, a plan. `from` is when it started ("": the site's first
 *  day); `until`, when it stopped. */
export interface CostItem { id: string; name: string; amount: number; every: 'month' | 'year' | 'once'; from: string; until?: string; note?: string }
/** Money paid towards the site's costs, in dollars or in naira (at the rate of the day it was paid). */
export interface Payment { id: string; at: string; amount: number; currency: 'USD' | 'NGN'; rate?: number; by: string; note?: string }
/** An ElevenLabs plan, for projections: what it costs a month, the credits it includes, and each 1,000 beyond them. */
export interface VoicePlan { name: string; fee: number; credits: number; overPer1k: number }
export interface CostsConfig {
  /** naira to the dollar, to show the costs in naira too (0: dollars only) */
  rate: number;
  /** the voice's ElevenLabs plan: the credits it includes each month, and what each 1,000 beyond them costs */
  voice: { credits: number; overPer1k: number };
  items: CostItem[];
  payments: Payment[];
  /** what projections assume where the site can't measure it yet: the AI and the voice per note (until 20 notes have
   *  been asked), what hosting adds per 10,000 notes a month, and ElevenLabs' plans to pick the cheapest from */
  projection: { aiPerNote: number; charsNote: number; hostingPer10k: number; voicePlans: VoicePlan[] };
}
// the usual plans for what the site runs on, to be set to the real bills
export const COSTS_DEFAULTS: CostsConfig = {
  rate: 0,
  voice: { credits: 100_000, overPer1k: 0.3 },
  items: [
    { id: 'railway', name: 'Railway: the server and database', amount: 5, every: 'month', from: '', note: 'Hobby plan, with $5 of use included. Railway → Usage has the real bill.' },
    { id: 'vercel', name: 'Vercel: the website', amount: 0, every: 'month', from: '', note: 'Hobby, free. A commercial site needs Pro, $20 a month.' },
    { id: 'elevenlabs', name: 'ElevenLabs: the voice', amount: 22, every: 'month', from: '', note: 'Creator plan, 100,000 credits a month.' },
    { id: 'resend', name: 'Resend: email', amount: 0, every: 'month', from: '', note: 'Free up to 3,000 emails a month.' },
  ],
  payments: [],
  projection: {
    aiPerNote: 0.005, charsNote: 70, hostingPer10k: 5,
    // ElevenLabs' plans as published in 2025: check elevenlabs.io/pricing
    voicePlans: [
      { name: 'Creator', fee: 22, credits: 100_000, overPer1k: 0.3 },
      { name: 'Pro', fee: 99, credits: 500_000, overPer1k: 0.24 },
      { name: 'Scale', fee: 330, credits: 2_000_000, overPer1k: 0.18 },
      { name: 'Business', fee: 1320, credits: 11_000_000, overPer1k: 0.12 },
    ],
  },
};
