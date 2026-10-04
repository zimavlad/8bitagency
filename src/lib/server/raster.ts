import { logoPixels } from '$lib/pixels';
import type { LogoSpec } from '$lib/types';
import { encodePng } from './png';

export { pathToPolys } from '$lib/pixels';

/** PNG знака — щоб передати Gemini справжнє лого, а не опис. Великий розмір, але ті самі «пікселі», що в грі. */
export function rasterLogo(raw: LogoSpec, size = 256, grid = 32): Buffer | null {
	const small = logoPixels(raw, grid);
	if (!small) return null;
	const px = new Uint8Array(size * size * 4);
	for (let y = 0; y < size; y++)
		for (let x = 0; x < size; x++) {
			const o = (y * size + x) * 4, so = (Math.floor((y * grid) / size) * grid + Math.floor((x * grid) / size)) * 4;
			px[o] = small[so]; px[o + 1] = small[so + 1]; px[o + 2] = small[so + 2]; px[o + 3] = small[so + 3];
		}
	return encodePng(size, size, px);
}
