import { json } from '@sveltejs/kit';

/**
 * Погода за вікном офісу — Київ, Open-Meteo без ключа, кеш 15 хвилин.
 * Якщо сервіс недоступний — ясно. ?w=rain|snow|clouds|clear підміняє для перевірки.
 */
type Sky = 'clear' | 'clouds' | 'rain' | 'snow' | 'storm' | 'fog';
let cache: { at: number; sky: Sky; temp: number | null } | null = null;

function skyOf(code: number): Sky {
	if (code >= 95) return 'storm';
	if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
	if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
	if (code === 45 || code === 48) return 'fog';
	if (code >= 2) return 'clouds';
	return 'clear';
}

export async function GET({ url, fetch }) {
	const force = url.searchParams.get('w');
	if (force && ['clear', 'clouds', 'rain', 'snow', 'storm', 'fog'].includes(force)) return json({ sky: force, temp: null, forced: true });
	if (cache && Date.now() - cache.at < 15 * 60_000) return json(cache);
	try {
		const ctl = AbortSignal.timeout(4000);
		const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=50.45&longitude=30.52&current=weather_code,temperature_2m&timezone=Europe%2FKyiv', { signal: ctl });
		const j = (await r.json()) as { current?: { weather_code?: number; temperature_2m?: number } };
		cache = { at: Date.now(), sky: skyOf(j.current?.weather_code ?? 0), temp: j.current?.temperature_2m ?? null };
	} catch {
		cache = { at: Date.now(), sky: 'clear', temp: null };
	}
	return json(cache);
}
