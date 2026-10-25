import { ArrowUpRightIcon } from '@phosphor-icons/react';
import { StageConfig } from '../../lib/api';
import { Button } from '../../components/ui';

/** Where to get real help. Out of character: no jokes, no stamp. */
export function HelpPanel({ help, line }: { help: StageConfig['help']; line?: string }) {
  return (
    <div className="pr-6">
      <p className="caps text-[11px] text-bone/55">Peruzzi puts the mic down</p>
      <h2 className="mt-2 text-[26px] font-medium leading-tight text-bone">{help.title}</h2>
      {line && <p className="mt-3 text-[17px] leading-relaxed text-bone/90">{line}</p>}
      <p className="mt-3 text-[17px] leading-relaxed text-bone/80">{help.body}</p>
      <div className="mt-5 flex flex-col gap-2">
        {help.links.map((l) => (
          <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center justify-between border border-bone/30 px-4 text-[16px] hover:border-bone/60">
            {l.label}<ArrowUpRightIcon size={18} />
          </a>
        ))}
      </div>
    </div>
  );
}

/** Shown instead of a note when it describes real harm. */
export function Serious({ help, line, onAnother, onLeave }: { help: StageConfig['help']; line: string; onAnother: () => void; onLeave: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col px-6 pb-8 pt-6">
      <HelpPanel help={help} line={line} />
      <div className="mt-8 flex flex-col gap-2.5">
        <Button kind="ghost" onClick={onAnother}>Write a different note</Button>
        <Button kind="quiet" onClick={onLeave}>Leave the stage</Button>
      </div>
    </div>
  );
}
