import { fail, redirect } from '@sveltejs/kit';
import { COOKIE, authEnabled, checkPassword, token } from '$lib/server/auth';

export function load() {
	if (!authEnabled()) redirect(303, '/');
}

export const actions = {
	default: async ({ request, cookies, url }) => {
		const form = await request.formData();
		if (!checkPassword(String(form.get('password') ?? ''))) return fail(401, { wrong: true });
		cookies.set(COOKIE, token(), { path: '/', httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', maxAge: 60 * 60 * 24 * 30 });
		redirect(303, '/');
	}
};
