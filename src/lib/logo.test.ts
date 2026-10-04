import { describe, expect, it } from 'vitest';
import { buildSvg, normalizeLogo } from './logo';

describe('лого', () => {
	it('у розмітку потрапляють лише числа, hex і безпечний path', () => {
		const svg = buildSvg({
			palette: { a: '#ff0000"><script>alert(1)</script>', b: '#123456' },
			shapes: [
				{ type: 'circle', cx: '50" onload="x', cy: 50, r: 999, fill: 'a' },
				{ type: 'path', d: 'M0 0 L10 10 Z" onclick="x', fill: 'b' },
				{ type: 'path', d: 'M10 10 L90 10 L50 90 Z', fill: 'b' },
				{ type: 'image', href: 'javascript:1' }
			]
		});
		expect(svg).not.toMatch(/script|onload|onclick|javascript|image/i);
		expect(svg).toContain('fill="#d98a63"'); // зіпсований hex → дефолт
		expect(svg).toContain('r="50"'); // радіус обрізано
		expect(svg).toContain('d="M10 10 L90 10 L50 90 Z"');
		expect(svg.match(/<path/g)?.length).toBe(1);
	});

	it('порожній знак — null', () => {
		expect(normalizeLogo({ shapes: [] })).toBeNull();
		expect(buildSvg(null)).toBe('');
	});
});
