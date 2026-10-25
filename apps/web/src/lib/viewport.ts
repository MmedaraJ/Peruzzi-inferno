import { useEffect, useState } from 'react';

/** For the screens laid over the page that hold text fields (the note being written, the sheets): `absolute`, straight in its body,
 *  `top: var(--vvt); bottom: var(--kb)`. They sit on the page itself rather than being pinned to the screen (`fixed`):
 *  an iPhone scrolls the page to show a field as it's tapped, even a page with nothing to scroll, and under a screen
 *  pinned to the screen that leaves the screen and the caret apart, the caret away from the words. On the page, the two
 *  move together. The page itself never scrolls otherwise, so with the keyboard down both are 0: the screen is the page
 *  as the browser itself sizes it, and follows its toolbars as they grow and shrink (Brave on an iPhone shrinks its own
 *  without telling the page). While a field is being typed in, --vvt and --kb fit the screen to what can be seen above
 *  the keyboard, in the page's own measure, so it stays on what can be seen however the phone scrolls to the field.
 *  --vvh is the height that can be seen. With `lock`, the page's box can't scroll meanwhile. Several screens can use it
 *  at once. */
let users = 0; let locks = 0; let stop: (() => void) | null = null;
function start() {
  const vv = window.visualViewport; const root = document.documentElement;
  const set = () => {
    const typing = !!vv && isField(document.activeElement);
    const top = typing ? vv!.pageTop : 0;
    root.style.setProperty('--vvh', `${Math.round(vv ? vv.height : window.innerHeight)}px`);
    root.style.setProperty('--vvt', `${Math.round(top)}px`);
    root.style.setProperty('--kb', `${typing ? Math.round(root.clientHeight - top - vv!.height) : 0}px`);
    // the keyboard gone: the page back to its top, if the phone left it scrolled
    if (!typing && (window.scrollY || (vv && vv.pageTop))) window.scrollTo(0, 0);
  };
  // focus moving in or out of a field: the keyboard is on its way up or down
  let t = 0; const soon = () => { window.clearTimeout(t); t = window.setTimeout(set, 30); };
  set(); vv?.addEventListener('resize', set); vv?.addEventListener('scroll', set); window.addEventListener('resize', set); window.addEventListener('scroll', set);
  document.addEventListener('focusin', soon); document.addEventListener('focusout', soon);
  return () => {
    window.clearTimeout(t); vv?.removeEventListener('resize', set); vv?.removeEventListener('scroll', set); window.removeEventListener('resize', set); window.removeEventListener('scroll', set);
    document.removeEventListener('focusin', soon); document.removeEventListener('focusout', soon);
    for (const v of ['--vvh', '--vvt', '--kb']) root.style.removeProperty(v);
  };
}
export function useVisualViewport(lock = false) {
  useEffect(() => {
    if (users++ === 0) stop = start();
    if (lock && locks++ === 0) document.documentElement.classList.add('locked');
    return () => {
      if (lock && --locks === 0) document.documentElement.classList.remove('locked');
      if (--users === 0) { stop?.(); stop = null; }
    };
  }, [lock]);
}

/** a field the keyboard types into */
export const isField = (el: Element | null) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes((el as HTMLInputElement).type)) || (el as HTMLElement).isContentEditable);
const visible = () => { const vv = window.visualViewport; return vv ? vv.height * vv.scale : window.innerHeight; };
/** a phone or tablet, whose keyboard is on its screen */
export const touch = () => typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

/** True while a text field has the focus on a phone, from the moment it's tapped: before the keyboard is up, so the
 *  screen can make room first and the phone finds nothing to move. False again if the phone puts its keyboard away with
 *  the field still focused, and never on a computer, which has no keyboard on its screen. Some phones (Brave on an
 *  iPhone) make the page itself shorter for the keyboard, others only what can be seen: what can be seen, against the
 *  screen at rest, tells either. */
export function useTyping() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!touch()) return;
    let rest = Math.max(window.innerHeight, visible()), seen = false, t = 0;
    const check = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        if (!isField(document.activeElement)) { seen = false; rest = Math.max(window.innerHeight, visible()); setOn(false); return; }
        const short = rest - visible(); if (short > 120) seen = true;
        setOn(!(seen && short < 60));
      }, 40);
    };
    // a field tapped: at once, so the screen has made its room before the keyboard comes up
    const tapped = (e: FocusEvent) => { if (isField(e.target as Element)) setOn(true); check(); };
    const vv = window.visualViewport;
    document.addEventListener('focusin', tapped); document.addEventListener('focusout', check); vv?.addEventListener('resize', check); window.addEventListener('resize', check);
    return () => { window.clearTimeout(t); document.removeEventListener('focusin', tapped); document.removeEventListener('focusout', check); vv?.removeEventListener('resize', check); window.removeEventListener('resize', check); };
  }, []);
  return on;
}

/** The screen's size at rest: its width (the page's own, which zooming doesn't change), and its height as it was when
 *  the screen opened, both taken again only once the width has changed (the phone turned, a window resized). A keyboard
 *  coming up or going, or a browser's bars growing or shrinking, changes only the height, and Brave on an iPhone doesn't
 *  always give the page back the height it had before its keyboard: none of it changes what's sized from this. */
export function useRestingSize() {
  const read = () => ({ w: document.documentElement.clientWidth, h: window.innerHeight });
  const [size, setSize] = useState(read);
  useEffect(() => {
    let t = 0;
    const on = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => { if (!isField(document.activeElement)) setSize((s) => (document.documentElement.clientWidth === s.w ? s : read())); }, 300);
    };
    window.addEventListener('resize', on);
    return () => { window.clearTimeout(t); window.removeEventListener('resize', on); };
  }, []);
  return size;
}
