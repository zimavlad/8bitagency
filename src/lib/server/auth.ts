import { createHmac, timingSafeEqual } from 'node:crypto';

/** Один пароль на гру (GAME_PASSWORD). Не задано — вхід відкритий (локальна розробка). */
export const COOKIE = 'agency_session';

const pass = () => process.env.GAME_PASSWORD?.trim() || '';
export const authEnabled = () => !!pass();

/** Кука — підпис паролем, сам пароль у ній не лежить; зміна пароля розлогінює всіх. */
export function token(): string {
	return createHmac('sha256', pass()).update('8bitagency-session').digest('hex');
}

export function validToken(v: string | undefined): boolean {
	if (!authEnabled()) return true;
	if (!v) return false;
	const a = Buffer.from(v);
	const b = Buffer.from(token());
	return a.length === b.length && timingSafeEqual(a, b);
}

export function checkPassword(input: string): boolean {
	const a = Buffer.from(input);
	const b = Buffer.from(pass());
	return a.length === b.length && timingSafeEqual(a, b);
}
