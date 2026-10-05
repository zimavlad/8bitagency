/**
 * Персонажі 16×32, як у Stardew Valley: 25 рядків тіла + 7 рядків ніг (два кадри ходи).
 * Літера — роль пікселя (основа, тінь, відблиск), колір дає палітра; «.» — прозоро.
 * Темну кольорову обводку домальовує код (outline у палітрі) — руками її не малюємо.
 */

export type SpriteId = 'strategist' | 'copywriter' | 'designer' | 'client';

export const SPRITE_W = 16;
export const SPRITE_H = 32;

export const BODY: Record<SpriteId, string[]> = {
	// Стратегиня: рожево-бузкове волосся з хвостиками, великі очі з відблиском, румʼянець,
	// матроска з червоним бантом, плісирована спідниця.
	strategist: [
		'.....hhhhhh.....',
		'...hhHHHHHHhh...',
		'..hHHLLHHHHHHh..',
		'..hHLLHHHHHHHh..',
		'.hHHHHHHHHHHHHh.',
		'hHhHHHHHHHHHHhHh',
		'hHhHSHHSSHHSHhHh',
		'hHhSSSSSSSSSShHh',
		'hHhSWEESSWEEShHh',
		'hHhSEEESSEEEShHh',
		'hHhSKSSSSSSKShHh',
		'hHhsSSSMMSSSshHh',
		'.Hh.sSSSSSSs.hH.',
		'.Hh...sSSs...hH.',
		'.hh.AAWWWWAA.hh.',
		'h..AAAWRRWAAA..h',
		'...CAAWRRWAAC...',
		'..CCCCWWWWCCCC..',
		'..SCCCCCCCCCCS..',
		'..SCCCCCCCCccS..',
		'..sCCCCCCCCccs..',
		'...PPPPPPPPPP...',
		'..PPpPPpPPpPPp..',
		'..PpPPpPPpPPpP..',
		'..PPPPPPPPPPPP..'
	],
	// Копірайтер: гірчична біні, круглі окуляри, вуса й борідка, білі навушники,
	// світлий гольф під бірюзовим кардиганом, підкочені джинси.
	copywriter: [
		'.....bbbbbb.....',
		'....bBBBBBBb....',
		'...bBBLBBBBBb...',
		'...bBBBBBBBBb...',
		'...rrrrrrrrrr...',
		'...hSSSSSSSSh...',
		'..WSGGSSSSGGSW..',
		'...GSSGSSGSSG...',
		'...GSSGGGGSSG...',
		'...SGGSssSGGS...',
		'...SmmmmmmmmS...',
		'...SmSSMMSSmS...',
		'....mmmmmmmm....',
		'......sSSs......',
		'....TTTTTTTT....',
		'..CCCTTTTTTCCC..',
		'.CCCCTTTTTTCCCC.',
		'.CCCCTTTTTTCCCc.',
		'.SCCCTTTTTTCCcS.',
		'.SCCCTTTTTTCCcS.',
		'..cCCTTTTTTCcc..',
		'...PPPPPPPPPP...',
		'...PPPPppPPPP...',
		'...PPPp..pPPP...',
		'...PPP....PPP...'
	],
	// Дизайнер: довге темне волосся до плечей, густа борода, сіре худі зі шнурками, карго.
	designer: [
		'.....hhhhhh.....',
		'...hhHHHHHHhh...',
		'..hHHLHHHHHHHh..',
		'..hHLHHHHHHHHh..',
		'.hHHHHHHHHHHHHh.',
		'.hHhSSSSSSSShHh.',
		'.hHSSSSSSSSSSHh.',
		'.hHSEESSSSEESHh.',
		'.hHSSSSssSSSSHh.',
		'.hHSddSSSSddSHh.',
		'.hHdddMMMMdddHh.',
		'.hhddddddddddhh.',
		'.hh.dddddddd.hh.',
		'.hh..dddddd..hh.',
		'.hhCCCddddCCChh.',
		'.CCCCCCddCCCCCC.',
		'CCCCCCAccACCCCCC',
		'CCCCCCACCACCCCCc',
		'SCCCCCACCACCCCcS',
		'SCCCcccccccccCcS',
		'.cCCCCCCCCCCCCc.',
		'..PPPPPPPPPPPP..',
		'..PPpPPPPPPpPP..',
		'..PPpPP..PPpPP..',
		'...PPP....PPP...'
	],
	// Клієнт: лиса маківка з блиском, вуса, подвійне підборіддя, шкірянка, золотий ланцюг, телефон.
	client: [
		'................',
		'.....SSSSSS.....',
		'....SLSSSSSS....',
		'...SLSSSSSSSS...',
		'...SSSSSSSSSS...',
		'..hSSSSSSSSSSh..',
		'..hSEESSSSEESh..',
		'..hSSSSssSSSSh..',
		'...SSmmmmmmSS...',
		'...SSSMMMMSSS...',
		'...sSSSSSSSSs...',
		'....ssSSSSss....',
		'......sSSs......',
		'....CCAAAACC....',
		'..CCCCcAAcCCCC..',
		'.CCCCCcTTcCCCCC.',
		'.CCCCCcTTcCCCCC.',
		'CCCCCCcTTcCCCCCC',
		'SCCCCCcTTcCCCCQS',
		'SCCCCCcTTcCCCCQS',
		'.CCCCCcccccCCCC.',
		'..PPPPPPPPPPPP..',
		'..PPPPPPPPPPPP..',
		'..PPPPP..PPPPP..',
		'...PPPP..PPPP...'
	]
};

/**
 * Зі спини — коли сидять за столом обличчям до ноутбука. Ноги ховає спинка крісла, тому тільки тіло.
 */
export const BACK: Record<'strategist' | 'copywriter' | 'designer', string[]> = {
	// хвостики, бузкове волосся, синій матроський комір з білою смужкою
	strategist: [
		'.....hhhhhh.....',
		'...hhHHHHHHhh...',
		'..hHHLLHHHHHHh..',
		'..hHLHHHHHHHHh..',
		'.hHHHHHHHHHHHHh.',
		'hHhHHHHHHHHHHhHh',
		'hHhHHHHHHHHHHhHh',
		'hHhHHHHHHHHHHhHh',
		'hHhHHHHHHHHHHhHh',
		'hHhhHHHHHHHHhhHh',
		'hHh.hHHHHHHh.hHh',
		'.Hh..hhhhhh..hH.',
		'.Hh...sSSs...hH.',
		'.hh..AAAAAA..hh.',
		'h..AAWWWWWWAA..h',
		'...CAAAAAAAAC...',
		'..CCCAAAAAACCC..',
		'..SCCCAAAACCCS..',
		'..SCCCCCCCCCCS..',
		'..sCCCCCCCCccs..',
		'..sCCCCCCCCccs..',
		'...PPPPPPPPPP...',
		'..PPpPPpPPpPPp..',
		'..PpPPpPPpPPpP..',
		'..PPPPPPPPPPPP..'
	],
	// гірчична біні, коротка потилиця, дужка навушників, бірюзовий кардиган
	copywriter: [
		'.....bbbbbb.....',
		'....bBBBBBBb....',
		'...bBBLBBBBBb...',
		'...bBBBBBBBBb...',
		'...rrrrrrrrrr...',
		'...hhhhhhhhhh...',
		'..WhhhhhhhhhhW..',
		'...hhhhhhhhhh...',
		'...ShhhhhhhhS...',
		'...ShhhhhhhhS...',
		'....hhhhhhhh....',
		'....sSSSSSSs....',
		'.....sSSSSs.....',
		'......sSSs......',
		'....CCCCCCCC....',
		'..CCCCCCCCCCCC..',
		'.CCCCCCCCCCCCCC.',
		'.CCCCCCCCCCCCCc.',
		'.SCCCCCCCCCCCcS.',
		'.SCCCCCCCCCCCcS.',
		'..cCCCCCCCCCcc..',
		'...PPPPPPPPPP...',
		'...PPPPppPPPP...',
		'...PPPp..pPPP...',
		'...PPP....PPP...'
	],
	// довге темне волосся на плечі, капюшон худі
	designer: [
		'.....hhhhhh.....',
		'...hhHHHHHHhh...',
		'..hHHLHHHHHHHh..',
		'..hHLHHHHHHHHh..',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hHHHHHHHHHHHHh.',
		'.hhHHHHHHHHHHhh.',
		'.hhhHHHHHHHHhhh.',
		'.hhhhhhhhhhhhhh.',
		'.hhCCcHHHHcCChh.',
		'.CCCCcchhccCCCC.',
		'CCCCCCccccCCCCCC',
		'CCCCCCCCCCCCCCCc',
		'SCCCCCCCCCCCCCcS',
		'SCCCCCCCCCCCCCcS',
		'.cCCCCCCCCCCCCc.',
		'..PPPPPPPPPPPP..',
		'..PPpPPPPPPpPP..',
		'..PPpPP..PPpPP..',
		'...PPP....PPP...'
	]
};

export const LEGS: Record<SpriteId, [string[], string[]]> = {
	strategist: [
		['....SS....SS....', '....SS....SS....', '....WW....WW....', '....WW....WW....', '....WW....WW....', '...BBB....BBB...', '...bbb....bbb...'],
		['....SS.....SS...', '...SS......SS...', '...WW......WW...', '...WW.......WW..', '..WW........WW..', '..BBB.......BBB.', '..bbb.......bbb.']
	],
	copywriter: [
		['....PP....PP....', '....PP....PP....', '....PP....PP....', '....pp....pp....', '....SS....SS....', '...WWW....WWW...', '...ggg....ggg...'],
		['....PP.....PP...', '...PP......PP...', '...PP.......PP..', '..pp........pp..', '..SS........SS..', '.WWW.........WWW', '.ggg.........ggg']
	],
	designer: [
		['...PPP....PPP...', '...PPP....PPP...', '...ppp....ppp...', '...ppp....ppp...', '...BBB....BBB...', '..BBBB....BBBB..', '..bbbb....bbbb..'],
		['...PPP.....PPP..', '..PPP......PPP..', '..ppp.......ppp.', '.ppp........ppp.', '.BBB........BBB.', 'BBBB........BBBB', 'bbbb........bbbb']
	],
	client: [
		['...PPP....PPP...', '...PPP....PPP...', '...PPP....PPP...', '...ppp....ppp...', '...ppp....ppp...', '..BBBB....BBBB..', '..bbbbb..bbbbb..'],
		['...PPP.....PPP..', '..PPP......PPP..', '..PPP.......PPP.', '..ppp.......ppp.', '.ppp........ppp.', '.BBBB.......BBBB', 'bbbbb.......bbbb']
	]
};

/** Палітри в дусі Stardew: теплі насичені основи, тіні з відтінком, обводка — темний колір, не чорний. */
export const PALETTE: Record<SpriteId, Record<string, string>> = {
	strategist: {
		outline: '#3a2236',
		h: '#a8558f', H: '#e08fc0', L: '#ffd1ea',
		S: '#ffd9bd', s: '#eab394', K: '#f59aa6',
		E: '#3d2a6b', W: '#ffffff', M: '#c4486a',
		A: '#3f4f9a', R: '#e0414f',
		C: '#fbf6ee', c: '#d8d2dc',
		P: '#3f4f9a', p: '#2e3a78',
		B: '#7a4a32', b: '#523020',
		Y: '#7a3a6a', O: '#6a1e2a'
	},
	copywriter: {
		outline: '#2b2220',
		b: '#b0782a', B: '#e2a73b', L: '#ffd77a', r: '#c48a2c',
		h: '#5a3b28', S: '#f2c49b', s: '#d9a57c',
		G: '#9a6a3a', E: '#2b2220', W: '#ffffff', m: '#6b4530', M: '#a85a4a',
		T: '#efe6cf', C: '#3f8f88', c: '#2c6964',
		P: '#36507a', p: '#273c5e',
		g: '#9aa0a8',
		Y: '#5a3b28', O: '#5a1a22'
	},
	designer: {
		outline: '#221a18',
		h: '#3a2a22', H: '#56402f', L: '#7a5c44',
		S: '#e9b98f', s: '#cf9b72', E: '#2b2420',
		d: '#4a3426', M: '#8a4a3a',
		C: '#5f6672', c: '#454b56', A: '#d7d2c4',
		P: '#5e6638', p: '#454b28',
		B: '#3a2a20', b: '#241812',
		Y: '#2a1e18', O: '#5a1a22'
	},
	client: {
		outline: '#1c1517',
		S: '#f0b98f', s: '#d39a72', L: '#fff0de', h: '#6b5040',
		E: '#2b2420', W: '#ffffff', m: '#8a6248', M: '#9a4a3a',
		C: '#2a2a30', c: '#1d1d22', A: '#f0c23b', T: '#c8463a', Q: '#5a8fd8',
		P: '#2f3340', p: '#23262f',
		B: '#18181c', b: '#0e0e10',
		Y: '#4a3428', O: '#5a1a22'
	}
};

/** Мала піксельна іконка над головою (емоція) 7×7. */
export const EMOTE: Record<'think' | 'gpt' | 'tired' | 'angry' | 'idea' | 'heart' | 'note' | 'zzz' | 'laugh', string[]> = {
	heart: ['.......', '.xx.xx.', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..', '...x...'],
	note: ['...xxxx', '...x..x', '...x..x', '...x..x', '.xxx.xx', 'xxxx.xx', '.xx....'],
	zzz: ['...xxxx', '.....x.', '....x..', 'xxxxxxx', '..x....', '.x.....', 'xxx....'],
	laugh: ['x.x.x.x', '.......', '.xxxxx.', '.x...x.', '..xxx..', '.......', '.......'],
	think: ['..xxx..', '.x...x.', '....x..', '...x...', '...x...', '.......', '...x...'],
	gpt: ['.xxxxx.', 'x.....x', 'x.x.x.x', 'x.....x', '.xxxxx.', '..x.x..', '.xx.xx.'],
	tired: ['.......', 'xx.....', '.x.....', 'x..xx..', 'xx..x..', '...x...', '...xx..'],
	angry: ['x.....x', '.x...x.', '..x.x..', '.......', '.xxxxx.', 'x.....x', '.......'],
	idea: ['..xxx..', '.x...x.', '.x...x.', '..x.x..', '..xxx..', '..xxx..', '...x...']
};

/** Кіт, що спить клубочком, 14×9 (дихає — зсув на піксель). */
export const CAT = [
	'..o.o.........',
	'.ooooo........',
	'oOOOOOo.oooo..',
	'oOeOeOooOOOOo.',
	'oOOnOOOOOOOOOo',
	'.oOOOOOOOOOOOo',
	'.oOOtOOOOOOOtoo',
	'..oooooooooooo.',
	'...............'
].map((r) => r.padEnd(15, '.').slice(0, 15));

/* ─────────── клієнти: стать і стиль з брифу ─────────── */

export const CLIENT_F_BODY = [
	'.....hhhhhh.....',
	'....hHHHHHHh....',
	'...hHHLHHHHHh...',
	'..hHHHHHHHHHHh..',
	'..hHHHHHHHHHHh..',
	'..hHSSSSSSSSHh..',
	'..hSSSSSSSSSSh..',
	'..hSEESSSSEESh..',
	'..hSSSSssSSSSh..',
	'.hhSKSSSSSSKShh.',
	'.hhSSSMMMMSSShh.',
	'.hh.sSSSSSSs.hh.',
	'.hh..sSSSSs..hh.',
	'.hhA..sSSs..Ahh.',
	'....CCCTTCCC....',
	'...CCCCTTCCCC...',
	'..CCCCCTTCCCCC..',
	'..CCCCCTTCCCCC..',
	'.SCCCCCTTCCCCCS.',
	'.SCCCCCCCCCCCQS.',
	'..cCCCCCCCCCCc..',
	'...PPPPPPPPPP...',
	'...PPPPPPPPPP...',
	'...PPPPPPPPPP...',
	'....PPPPPPPP....'
];

export const CLIENT_F_LEGS: [string[], string[]] = [
	['.....SS..SS.....', '.....SS..SS.....', '.....SS..SS.....', '.....ss..ss.....', '.....SS..SS.....', '....BBB..BBB....', '.....b....b.....'],
	['.....SS...SS....', '....SS....SS....', '....SS.....SS...', '....ss.....ss...', '...SS.......SS..', '..BBB.......BBB.', '...b.........b..']
];

type Look = 'leather' | 'suit' | 'casual' | 'creative' | 'farmer' | 'sport';

/** Одяг за стилем: C — верх, c — тінь, T — центр (сорочка, краватка, принт), P — низ, B — взуття. */
const LOOKS: Record<Look, Record<string, string>> = {
	leather: { C: '#2a2a30', c: '#1d1d22', A: '#f0c23b', T: '#c8463a', P: '#2f3340', p: '#23262f', B: '#18181c', b: '#0e0e10' },
	suit: { C: '#2f3f6a', c: '#22305a', A: '#d8d8d8', T: '#f2f2f2', P: '#2f3f6a', p: '#22305a', B: '#1c1414', b: '#100a0a' },
	casual: { C: '#7a8f5a', c: '#5e7044', A: '#d8c8a0', T: '#e8e0cc', P: '#3f5a8a', p: '#2f4670', B: '#6a4a32', b: '#4a3020' },
	creative: { C: '#d0486a', c: '#a8344f', A: '#9fe0ff', T: '#f0c23b', P: '#2a2a30', p: '#1d1d22', B: '#f2f2f2', b: '#c8c8c8' },
	farmer: { C: '#a85a3a', c: '#7e3f28', A: '#e8d8b0', T: '#e8d8b0', P: '#4a5a3a', p: '#36442a', B: '#5a3a22', b: '#3a2414' },
	sport: { C: '#2f6fae', c: '#22548a', A: '#ffffff', T: '#ffffff', P: '#2f6fae', p: '#22548a', B: '#f2f2f2', b: '#bdbdbd' }
};

const HAIR_F: Record<Look, [string, string, string]> = {
	leather: ['#2a1a14', '#3d281e', '#5a3c2c'],
	suit: ['#5a3a22', '#7a5032', '#a8784a'],
	casual: ['#8a5a32', '#b07a44', '#d8a868'],
	creative: ['#8a2a5a', '#c04a86', '#e88ab8'],
	farmer: ['#6a4a2a', '#8a6a3a', '#b08a5a'],
	sport: ['#c8a050', '#e8c070', '#fff0b0']
};

export function clientSprite(gender: 'm' | 'f', look: Look) {
	const skin = { S: '#f0b98f', s: '#d39a72', K: '#f08a8a', E: '#2b2420', W: '#ffffff' };
	if (gender === 'f') {
		const [h, H, L] = HAIR_F[look];
		return { body: CLIENT_F_BODY, legs: CLIENT_F_LEGS, pal: { outline: '#22161a', ...skin, h, H, L, M: '#c8344a', Q: '#5a8fd8', Y: h, O: '#5a1a22', ...LOOKS[look] }, face: FACE.client_f };
	}
	return { body: BODY.client, legs: LEGS.client, pal: { ...PALETTE.client, ...LOOKS[look] }, face: FACE.client };
}

/* ─────────── міміка ─────────── */

/**
 * Обличчя малюємо поверх спрайта, а не руками в кожному рядку: очі, брови й рот міняються від настрою,
 * як у Stardew (там портрети теж мають кілька емоцій). Y — брова, O — відкритий рот.
 */
export type Expr = 'neutral' | 'happy' | 'laugh' | 'talk' | 'sad' | 'angry' | 'tired' | 'surprised' | 'closed' | 'wink' | 'sleep';

/** Де очі (ліве, праве, верхній рядок, ширина), брова, рот (x, рядок, ширина) і колір шкіри під ними. */
export type Face = { l: number; r: number; y: number; w: number; brow: number; mouth: [number, number, number]; skin: string; mskin: string };

export const FACE: Record<SpriteId | 'client_f', Face> = {
	strategist: { l: 4, r: 9, y: 8, w: 3, brow: 7, mouth: [6, 11, 4], skin: 'S', mskin: 'S' },
	copywriter: { l: 4, r: 10, y: 7, w: 2, brow: 5, mouth: [6, 11, 4], skin: 'S', mskin: 'S' },
	designer: { l: 4, r: 10, y: 7, w: 2, brow: 6, mouth: [6, 10, 4], skin: 'S', mskin: 'd' },
	client: { l: 4, r: 10, y: 5, w: 2, brow: 4, mouth: [6, 9, 4], skin: 'S', mskin: 'S' },
	client_f: { l: 4, r: 10, y: 7, w: 2, brow: 6, mouth: [6, 10, 4], skin: 'S', mskin: 'S' }
};

type EyeKind = 'open' | 'happy' | 'closed' | 'tired' | 'angry' | 'sad';
const EYES: Record<Expr, [EyeKind, EyeKind]> = {
	neutral: ['open', 'open'], happy: ['happy', 'happy'], laugh: ['happy', 'happy'], talk: ['open', 'open'], sad: ['sad', 'sad'],
	angry: ['angry', 'angry'], tired: ['tired', 'tired'], surprised: ['open', 'open'], closed: ['closed', 'closed'], wink: ['closed', 'open'], sleep: ['closed', 'closed']
};
type MouthKind = 'line' | 'smile' | 'open' | 'small' | 'frown' | 'grit' | 'o';
const MOUTH: Record<Expr, MouthKind> = {
	neutral: 'line', happy: 'smile', laugh: 'open', talk: 'small', sad: 'frown', angry: 'grit', tired: 'line', surprised: 'o', closed: 'line', wink: 'smile', sleep: 'small'
};

/** Рядки спрайта з обличчям потрібного настрою. */
export function withFace(rows: string[], f: Face, e: Expr): string[] {
	const g = rows.map((r) => r.split(''));
	const put = (x: number, y: number, ch: string, onlySkin = false) => {
		if (y < 0 || y >= g.length || x < 0 || x >= g[y].length) return;
		if (onlySkin && g[y][x] !== f.skin && g[y][x] !== f.mskin) return;
		g[y][x] = ch;
	};
	const [ex, ey, w] = [0, f.y, f.w];
	for (const [side, x0] of [['l', f.l], ['r', f.r]] as const) {
		const kind = EYES[e][side === 'l' ? 0 : 1];
		const outer = side === 'l' ? 0 : w - 1, inner = w - 1 - outer;
		for (let i = 0; i < w; i++) { put(x0 + i, ey, f.skin); put(x0 + i, ey + 1, f.skin); }
		const top = (i: number, ch: string) => put(x0 + ex + i, ey, ch);
		const bot = (i: number, ch: string) => put(x0 + ex + i, ey + 1, ch);
		for (let i = 0; i < w; i++) {
			if (kind === 'open') { top(i, i === 0 ? 'W' : 'E'); bot(i, 'E'); }
			else if (kind === 'happy') { if (w === 3) { if (i === 1) top(i, 'E'); else bot(i, 'E'); } else { top(i, 'E'); if (i === outer) bot(i, 'E'); } }
			else if (kind === 'closed') bot(i, 'E');
			else if (kind === 'tired') { top(i, 's'); bot(i, 'E'); }
			else if (kind === 'angry') { top(i, i === inner ? 'Y' : 'E'); bot(i, 'E'); if (i === outer) put(x0 + i, f.brow, 'Y', true); }
			else if (kind === 'sad') { if (i !== outer) top(i, 'E'); bot(i, 'E'); if (i === inner) put(x0 + i, f.brow, 'Y', true); }
		}
	}
	const [mx, my, mw] = f.mouth;
	for (let i = 0; i < mw; i++) put(mx + i, my, f.mskin);
	const mid = (y: number, ch: string) => { for (let i = 1; i < mw - 1; i++) put(mx + i, y, ch); };
	const m = MOUTH[e];
	if (m === 'line') mid(my, 'M');
	else if (m === 'smile') { mid(my, 'M'); put(mx, my - 1, 'M', true); put(mx + mw - 1, my - 1, 'M', true); }
	else if (m === 'open') { for (let i = 0; i < mw; i++) put(mx + i, my, 'O'); mid(my + 1, 'O'); }
	else if (m === 'small') mid(my, 'O');
	else if (m === 'frown') { mid(my, 'M'); put(mx, my + 1, 'M', true); put(mx + mw - 1, my + 1, 'M', true); }
	else if (m === 'grit') for (let i = 0; i < mw; i++) put(mx + i, my, 'M');
	else if (m === 'o') { mid(my, 'O'); mid(my + 1, 'O'); }
	return g.map((r) => r.join(''));
}
