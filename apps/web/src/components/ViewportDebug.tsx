import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

/** With ?debug=vp in the address (kept for the visit): the screen's measures, live, and what happened since a field was
 *  last tapped (the keyboard's resizes, any scroll the phone made), for finding out what a phone's browser does with its
 *  keyboard and its bars. */
export function ViewportDebug() {
  const [t, setT] = useState('');
  useEffect(() => {
    const r = (n: number | undefined) => (n == null ? '–' : Math.round(n));
    const vv = window.visualViewport;
    const log: string[] = []; let t0 = performance.now();
    const note = (s: string) => { log.push(`+${Math.round(performance.now() - t0)} ${s}`); if (log.length > 10) log.shift(); };
    const read = () => {
      const css = getComputedStyle(document.documentElement); const root = document.getElementById('root');
      const h = document.querySelector('[data-write]')?.getBoundingClientRect();
      const a = document.activeElement; const f = a && a !== document.body ? a.getBoundingClientRect() : null;
      setT([
        `inner ${innerWidth}×${innerHeight} · client ${document.documentElement.clientHeight} · screen ${screen.height}`,
        `vv ${r(vv?.height)} at ${r(vv?.offsetTop)} (page ${r(vv?.pageTop)}) ×${vv ? vv.scale.toFixed(2) : '–'}`,
        `scrollY ${r(scrollY)} · doc ${document.documentElement.scrollTop}/${document.body.scrollTop} · root ${r(root?.scrollTop)} of ${r(root ? root.scrollHeight - root.clientHeight : undefined)}`,
        `--vvt ${css.getPropertyValue('--vvt') || '–'} · --kb ${css.getPropertyValue('--kb') || '–'} · --vvh ${css.getPropertyValue('--vvh') || '–'}`,
        `note ${h ? `${r(h.top)}…${r(h.bottom)}` : '–'} · field ${f ? `${r(f.top)}…${r(f.bottom)}` : '–'}`,
        ...log,
      ].join('\n'));
    };
    // since the last field tapped: focus, the keyboard's resizes, the phone's scrolls, the page's focus
    const field = (e: Event) => {
      const el = e.target as HTMLElement;
      if (e.type === 'focusin') { t0 = performance.now(); log.length = 0; }
      note(`${e.type} ${el.getAttribute?.('aria-label') || el.tagName?.toLowerCase()}`); read();
    };
    const view = (e: Event) => { note(`vv ${e.type} ${r(vv?.height)} at ${r(vv?.offsetTop)} p${r(vv?.pageTop)}`); read(); };
    const page = (e: Event) => { note(`${e.type} inner ${innerHeight} y${r(scrollY)}`); read(); };
    read(); const id = window.setInterval(read, 250);
    document.addEventListener('focusin', field); document.addEventListener('focusout', field);
    vv?.addEventListener('resize', view); vv?.addEventListener('scroll', view);
    for (const k of ['resize', 'scroll', 'blur', 'focus']) window.addEventListener(k, page);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('focusin', field); document.removeEventListener('focusout', field);
      vv?.removeEventListener('resize', view); vv?.removeEventListener('scroll', view);
      for (const k of ['resize', 'scroll', 'blur', 'focus']) window.removeEventListener(k, page);
    };
  }, []);
  return createPortal(<pre className="pointer-events-none fixed left-1 top-[54px] z-[9999] whitespace-pre bg-black/80 px-1.5 py-1 font-mono text-[9px] leading-tight text-[#9f9]">{t}</pre>, document.body);
}
