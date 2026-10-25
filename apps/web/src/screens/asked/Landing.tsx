import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon } from '@phosphor-icons/react';
import { Site, StageConfig, api } from '../../lib/api';
import { sound } from '../../lib/sound';
import { track } from '../../lib/track';
import { LightRig } from '../../components/LightRig';
import { ListenButton } from '../../components/Listen';
import { Footnote } from '../../components/ui';

/** The way in: the cover, lit by the rig above it, and on it two cards: the song, to stream it, and Peruzzi Asks, to
 *  write someone a note. The tap on that one starts the song (a phone plays sound only from a tap), so it's playing
 *  the moment the stage opens. While the stage is paused, the card says so, and the song is still there to play. */
export function Landing({ cfg, onStage }: { cfg: StageConfig; onStage: () => void }) {
  const room = useRef<HTMLDivElement>(null);
  const kick = useRef({ at: 0, s: 0 });
  const [site, setSite] = useState<Site | null>(null);
  useEffect(() => { track('landing_view'); api.site().then(setSite).catch(() => {}); }, []);
  const enter = () => {
    if (sound.on) { sound.unlock(); sound.startMusic(); }
    track('landing_stage');
    onStage();
  };
  return (
    <div ref={room} className="relative min-h-dvh overflow-hidden bg-ink">
      <img src="/media/img/cover-1200.jpg" srcSet="/media/img/cover-600.jpg 600w, /media/img/cover-1200.jpg 1200w" sizes="(max-aspect-ratio: 1/1) 100vh, 100vw"
        alt="" aria-hidden draggable={false} decoding="async" className="pointer-events-none absolute inset-0 h-full w-full select-none object-cover" style={{ objectPosition: '54% 30%' }} />
      {/* the room's dark over it, flat, so the light shows */}
      <div className="pointer-events-none absolute inset-0 bg-ink/30" />
      <LightRig room={room} kick={kick} show floor={false} spot={[0.5, 0.34]} />
      <div className="relative mx-auto flex min-h-dvh max-w-[520px] flex-col justify-end px-4 pb-[max(20px,env(safe-area-inset-bottom))] pt-[38vh]">
        <h1 className="sr-only">{cfg.nameplate} Asks: a fan experience for {cfg.song} by {cfg.artist}</h1>
        <ListenButton href={cfg.smartLink} from="landing" kicker={`The song · ${cfg.artist}`} label={`Listen to ${cfg.song}`} />
        {cfg.open ? (
          <button onClick={enter} className="group mt-3 block w-full rounded-2xl bg-rose px-5 pb-5 pt-4 text-left text-white transition-[transform,background-color] duration-150 hover:bg-rose-deep active:scale-[0.99]">
            <span className="caps block text-[11px] text-blush">{cfg.nameplate} Asks</span>
            <span className="display mt-1 block text-[31px] leading-tight">who’s on your mind?</span>
            <span className="mt-1 block text-[16px] leading-snug text-white/90">Write them a note. {cfg.nameplate} will ask them for you: could this be love?</span>
            <span className="mt-4 flex items-center gap-2 text-[17px] font-semibold">Write a note <ArrowRightIcon size={18} weight="bold" className="transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-bone/15 bg-stone px-5 pb-5 pt-4">
            <p className="caps text-[11px] text-bone/55">{cfg.nameplate} Asks</p>
            <h2 className="display mt-1 text-[31px] leading-tight">between sets</h2>
            <p className="mt-1 text-[16px] leading-snug text-bone/75">{cfg.pausedMessage}</p>
          </div>
        )}
        <Footnote demo={site?.demoNotice ? site.demoText : null} credit={site?.credit} className="mt-5" />
      </div>
    </div>
  );
}
