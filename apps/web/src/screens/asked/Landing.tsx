import { useEffect, useRef, useState } from 'react';
import { ArrowRightIcon, ArrowUpRightIcon, PlayIcon } from '@phosphor-icons/react';
import { Site, StageConfig, api } from '../../lib/api';
import { sound } from '../../lib/sound';
import { streaming } from '../../lib/stream';
import { track } from '../../lib/track';
import { LightRig } from '../../components/LightRig';
import { Footnote } from '../../components/ui';


/** whether the song is playing, for the record to turn with it */
function usePlaying() {
  const [on, setOn] = useState(sound.musicPlaying);
  useEffect(() => {
    const look = () => setOn(sound.musicPlaying);
    const off = sound.subscribe(look); const t = window.setInterval(look, 500);
    return () => { off(); window.clearInterval(t); };
  }, []);
  return on;
}

/** The way in. The cover, as the room's backdrop (soft, so whatever's on it reads), with the stage's lights playing
 *  over it from the rig, and the cover itself as a sleeve, its record half out and turning while the song plays; the
 *  song's name under it; then the song, to stream it, and Peruzzi Asks, to write someone a note. The song starts here
 *  if the phone allows it (if not, the pill asks for a tap, and any tap starts it, the way into the stage too), so it
 *  carries on as the stage opens. While the stage is paused, its card says so, and the song is still there to play. */
export function Landing({ cfg, onStage }: { cfg: StageConfig; onStage: () => void }) {
  const room = useRef<HTMLDivElement>(null);
  const kick = useRef({ at: 0, s: 0 });
  const [site, setSite] = useState<Site | null>(null);
  const [out, setOut] = useState(false);   // the record, sliding out of its sleeve once the page is up
  const playing = usePlaying();
  useEffect(() => { track('landing_view'); api.site().then(setSite).catch(() => {}); const t = window.setTimeout(() => setOut(true), 350); return () => window.clearTimeout(t); }, []);
  const enter = () => {
    if (sound.on) { sound.unlock(); sound.startMusic(); }
    track('landing_stage');
    onStage();
  };
  return (
    <div ref={room} className="relative min-h-dvh overflow-hidden bg-ink">
      <img src="/media/img/cover-600.jpg" alt="" aria-hidden draggable={false} decoding="async"
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 select-none object-cover blur-2xl saturate-150" />
      {/* the room's dark over it, flat */}
      <div className="pointer-events-none absolute inset-0 bg-ink/60" />
      <LightRig room={room} kick={kick} show floor={false} spot={[0.5, 0.25]} />
      <div className="relative mx-auto flex min-h-dvh max-w-[480px] flex-col px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-[max(76px,calc(env(safe-area-inset-top)+66px))] [@media(max-height:640px)]:pt-[max(62px,calc(env(safe-area-inset-top)+54px))]">
        {/* the sleeve, and its record: out to one side, the pair kept in the middle */}
        <div className="sleeve relative mx-auto aspect-square transition-transform duration-[1200ms] ease-out motion-reduce:transition-none" style={{ transform: out ? 'translateX(-17%)' : 'none' }}>
          <div aria-hidden className="absolute inset-[4%] transition-transform duration-[1200ms] ease-out motion-reduce:transition-none" style={{ transform: out ? 'translateX(36%)' : 'none' }}>
            <div className="vinyl relative h-full w-full rounded-full motion-safe:animate-[spin_5s_linear_infinite]" style={{ animationPlayState: playing ? 'running' : 'paused' }}>
              <img src="/media/img/cover-600.jpg" alt="" className="absolute left-[34%] top-[34%] h-[32%] w-[32%] rounded-full object-cover" />
            </div>
            <div className="vinyl-sheen absolute inset-0 rounded-full" />
          </div>
          <img src="/media/img/cover-1200.jpg" srcSet="/media/img/cover-600.jpg 600w, /media/img/cover-1200.jpg 1200w" sizes="(max-width: 480px) 64vw, 300px"
            alt={`${cfg.song} by ${cfg.artist}: the cover`} draggable={false} className="relative h-full w-full rounded-[3px] object-cover shadow-[0_28px_60px_-18px_rgba(0,0,0,0.95)]" />
        </div>
        <div className="mt-5 text-center [@media(max-height:640px)]:mt-3">
          <p className="caps text-[12px] tracking-[0.32em] text-petal">{cfg.artist}</p>
          <h1 className="display mt-1 text-[clamp(32px,6vh,52px)] leading-none text-bone">{cfg.song}</h1>
        </div>
        <div className="min-h-5 flex-1 [@media(max-height:640px)]:min-h-3" />
        <a href={cfg.smartLink} target="_blank" rel="noreferrer" onClick={() => { track('stream_click', { from: 'landing' }); streaming.leftAt = Date.now(); }}
          className="group flex items-center gap-3.5 rounded-2xl border border-bone/15 bg-ink/70 py-3 pl-3 pr-4 text-bone backdrop-blur-md transition-colors hover:border-blush/50">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-bone text-ink"><PlayIcon size={18} weight="fill" /></span>
          <span className="min-w-0 flex-1">
            <span className="caps block text-[10px] text-bone/60">The song</span>
            <span className="mt-0.5 block text-[17px] leading-snug">Listen to {cfg.song}</span>
          </span>
          <ArrowUpRightIcon size={18} className="shrink-0 text-bone/70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </a>
        {cfg.open ? (
          <button onClick={enter} className="group mt-3 block w-full rounded-2xl bg-rose px-5 pb-5 pt-4 text-left text-white transition-[transform,background-color] duration-150 hover:bg-rose-deep active:scale-[0.99]">
            <span className="caps block text-[11px] text-blush">{cfg.nameplate} Asks</span>
            <span className="display mt-1 block text-[clamp(26px,7.4vw,30px)] leading-tight">who’s on your mind?</span>
            <span className="mt-1 block text-[15.5px] leading-snug text-white/90">Write them a note. {cfg.nameplate} will ask them for you.</span>
            <span className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-[15.5px] font-semibold text-rose">Write a note <ArrowRightIcon size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" /></span>
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-bone/15 bg-ink/70 px-5 pb-5 pt-4 backdrop-blur-md">
            <p className="caps text-[11px] text-bone/60">{cfg.nameplate} Asks</p>
            <h2 className="display mt-1 text-[clamp(26px,7.4vw,30px)] leading-tight">between sets</h2>
            <p className="mt-1 text-[15.5px] leading-snug text-bone/80">{cfg.pausedMessage}</p>
          </div>
        )}
        <Footnote demo={site?.demoNotice ? site.demoText : null} credit={site?.credit} className="mt-5" />
      </div>
    </div>
  );
}
