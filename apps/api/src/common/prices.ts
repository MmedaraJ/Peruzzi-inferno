/** What the AI costs, in dollars per million tokens, at Anthropic's list prices: input, output, cache read, cache write
 *  (the hour-long cache, which is what the stage uses: twice the input price). Opus in fast mode is twice the price
 *  throughout. For estimates: the console has the bill. */
export const AI_PRICES: Record<string, [number, number, number, number]> = {
  'claude-opus-5-5': [4, 20, 0.2, 8],
  'claude-opus-5-5 (fast)': [8, 40, 0.4, 16],
  'claude-sonnet-5-5': [2, 10, 0.2, 4],
  'claude-haiku-5-5': [0.1, 0.5, 0.01, 0.2],
};
/** The cost of some tokens on a model (an unknown model is priced as Opus). */
export function aiCost(model: string | null | undefined, t: { in?: number | bigint | null; out?: number | bigint | null; cacheRead?: number | bigint | null; cacheWrite?: number | bigint | null }) {
  const p = AI_PRICES[model || ''] || AI_PRICES['claude-opus-5-5'];
  return (Number(t.in ?? 0) * p[0] + Number(t.out ?? 0) * p[1] + Number(t.cacheRead ?? 0) * p[2] + Number(t.cacheWrite ?? 0) * p[3]) / 1e6;
}
