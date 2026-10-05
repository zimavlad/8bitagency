import { describe, expect, it } from 'vitest';
import { cleanAnswer, notebookUrl, toStorageState } from './notebooks';

describe('NotebookLM', () => {
	it('посилання з адресного рядка → канонічне', () => {
		expect(notebookUrl('https://notebook.google.com/notebook/71fe21e3-d1e6-428a-8464-4546937dba8b')).toBe('https://notebooklm.google.com/notebook/71fe21e3-d1e6-428a-8464-4546937dba8b');
		expect(notebookUrl('')).toBeNull();
	});
	it('cookies з Cookie-Editor → storageState Playwright, лише Google', () => {
		const s = toStorageState([
			{ name: 'SID', value: 'x', domain: '.google.com', path: '/', expirationDate: 1900000000.5, httpOnly: true, secure: true, sameSite: 'no_restriction' },
			{ name: 'other', value: 'y', domain: '.example.com' }
		]);
		expect(s.cookies).toHaveLength(1);
		expect(s.cookies[0]).toMatchObject({ name: 'SID', expires: 1900000000, sameSite: 'None', httpOnly: true });
	});
	it('чистить службові примітки з відповіді', () => {
		expect(cleanAnswer('[AI-GENERATED via Gemini] Сміливо [1, 2] і смішно.\n\nSources:\n[1] a.pdf')).toBe('Сміливо і смішно.');
	});
});
