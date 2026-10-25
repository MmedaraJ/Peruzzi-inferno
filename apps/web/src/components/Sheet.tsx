import { ReactNode, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { XIcon } from '@phosphor-icons/react';
import { OnScreen } from './ui';

/** A sheet that rises from the bottom, over everything. */
export function Sheet({ open, onClose, children, label, tone = 'dark' }: { open: boolean; onClose: () => void; children: ReactNode; label: string; tone?: 'dark' | 'paper' }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  return (
    <OnScreen>
      <AnimatePresence>
        {open && (
          // on the part of the page that can be seen (see useVisualViewport), so an on-screen keyboard pushes the sheet up rather than covering it
          <motion.div className="absolute inset-x-0 z-50 flex items-end justify-center" style={{ top: 'var(--vvt, 0px)', bottom: 'var(--kb, 0px)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <button aria-label="Close" className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" onClick={onClose} />
            <motion.div role="dialog" aria-modal aria-label={label} style={{ maxHeight: 'calc(var(--vvh, 100dvh) * 0.9)' }}
              className={`relative w-full max-w-md overflow-y-auto px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-5 shadow-[0_-20px_60px_-20px_rgba(0,0,0,0.8)] ${tone === 'paper' ? 'paper' : 'border-t border-bone/10 bg-coal text-bone'}`}
              initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}>
              <button onClick={onClose} aria-label="Close" className={`absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full ${tone === 'paper' ? 'text-paper-ink/70 hover:bg-black/5' : 'text-bone/70 hover:bg-white/5'}`}><XIcon size={20} /></button>
              {children}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </OnScreen>
  );
}
