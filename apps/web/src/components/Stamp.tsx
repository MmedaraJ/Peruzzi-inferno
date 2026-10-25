import { motion, useReducedMotion } from 'framer-motion';
import { NoteKind } from '../lib/api';
import { STAMP_TILT, StampMark } from './StampMark';

export { STAMP_INK } from './StampMark';

/** Peruzzi's stamp: the mark comes down hard from above and lands askew. */
export function Stamp({ kind, text, size = 'lg', land = true, className = '' }: { kind: NoteKind; text: string; size?: 'lg' | 'md' | 'sm'; land?: boolean; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={`inline-block ${className}`}
      initial={land && !reduce ? { scale: 2.3, rotate: -16, opacity: 0 } : false}
      animate={{ scale: 1, rotate: STAMP_TILT, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 24, mass: 0.9 }}>
      <StampMark kind={kind} text={text} size={size} />
    </motion.div>
  );
}
