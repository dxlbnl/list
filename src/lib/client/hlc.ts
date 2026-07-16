/**
 * A lightweight hybrid logical clock for LWW stamps. Guarantees the timestamps this client emits
 * are **strictly monotonic** — even if the wall clock jumps backwards or two writes land in the
 * same millisecond — and never lag behind a timestamp we've **observed** from the server/peers.
 * Stored in the existing millisecond `updatedAt` field, so no schema change; the +1ms bump is the
 * logical counter at ms granularity. This makes row-level LWW deterministic across skewed clocks.
 */
let last = 0;

/** The next monotonic timestamp for a local write. */
export function now(): Date {
	last = Math.max(Date.now(), last + 1);
	return new Date(last);
}

/** Advance our clock past an observed timestamp (a server/peer row) so future stamps stay ahead. */
export function observe(ts: Date | number | null | undefined): void {
	if (ts == null) return;
	const t = typeof ts === 'number' ? ts : ts.getTime();
	if (t > last) last = t;
}
