import { env } from '$env/dynamic/private';
import { error, json } from '@sveltejs/kit';
import postgres from 'postgres';

export async function measure() {
	if (env.VERCEL_ENV !== 'preview') error(404);
	if (!env.DATABASE_URL) return json({ status: 'missing-db' }, { status: 503 });
	const url = new URL(env.DATABASE_URL);
	const poolRegion = url.hostname.match(/(?:^|[.-])((?:eu|us|ap|sa|ca|af|me)-(?:[a-z]+-)+\d)(?:[.-]|$)/)?.[1] ?? null;
	const db = postgres(env.DATABASE_URL, { prepare: false, max: 1, connect_timeout: 5 });
	try {
		const milliseconds = [];
		for (let i = 0; i < 6; i++) {
			const start = performance.now();
			await db`select 1`;
			milliseconds.push(Math.round(performance.now() - start));
		}
		return json({ region: env.VERCEL_REGION, poolRegion, milliseconds }, { headers: { 'cache-control': 'no-store' } });
	} catch {
		return json({ status: 'db-unavailable', region: env.VERCEL_REGION, poolRegion }, { status: 503 });
	} finally {
		await db.end({ timeout: 1 });
	}
}
