import type { CaseData, RunState } from './types';

/** Кейс-борд з підсумку брифу. */
export function caseOf(r: RunState): CaseData {
	const e = r.elements;
	return {
		positioning: e.positioning?.text ?? '',
		name: e.name?.text ?? '—',
		slogan: e.slogan?.text ?? '',
		logo: e.logo?.logo,
		instagram: e.instagram ? { text: e.instagram.text, image: e.instagram.image } : undefined,
		youtube: e.youtube ? { text: e.youtube.text, image: e.youtube.image, scenes: e.youtube.details } : undefined,
		threads: e.threads ? [e.threads.text, ...e.threads.details] : undefined
	};
}

