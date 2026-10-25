/** Saving and sharing the cards. A phone only opens its share sheet straight from a tap, so the files are made ahead of
 *  time and these are called with them ready. */
const ios = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const canShareFiles = (f: File) => { try { return !!navigator.canShare?.({ files: [f] }); } catch { return false; } };

/** Saves the picture: through the share sheet's "Save Image" on an iPhone, as a download everywhere else. */
export async function saveFile(file: File): Promise<'shared' | 'downloaded' | 'cancelled'> {
  if (ios() && canShareFiles(file)) {
    try { await navigator.share({ files: [file] }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(file); const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'downloaded';
}

/** Shares the picture with a line and the link; falls back to the link alone, then to copying it. */
export async function shareFile(file: File | null, text: string, url: string): Promise<'shared' | 'copied' | 'cancelled' | 'saved'> {
  if (file && canShareFiles(file)) {
    try { await navigator.share({ files: [file], text: `${text} ${url}` }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; }
  }
  if (navigator.share) { try { await navigator.share({ text, url }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'cancelled'; } }
  if (await copy(`${text} ${url}`)) return 'copied';
  if (file) { await saveFile(file); return 'saved'; }
  return 'cancelled';
}

export async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {
    try { const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; }
  }
}
