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
		'..WGGGSSSSGGGW..',
		'...GEGSSSSGEG...',
		'...SGGSSSSGGS...',
		'...SSSSssSSSS...',
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
		B: '#7a4a32', b: '#523020'
	},
	copywriter: {
		outline: '#2b2220',
		b: '#b0782a', B: '#e2a73b', L: '#ffd77a', r: '#c48a2c',
		h: '#5a3b28', S: '#f2c49b', s: '#d9a57c',
		G: '#2b2220', E: '#2b2220', W: '#ffffff', m: '#6b4530', M: '#a85a4a',
		T: '#efe6cf', C: '#3f8f88', c: '#2c6964',
		P: '#36507a', p: '#273c5e',
		g: '#9aa0a8'
	},
	designer: {
		outline: '#221a18',
		h: '#3a2a22', H: '#56402f', L: '#7a5c44',
		S: '#e9b98f', s: '#cf9b72', E: '#2b2420',
		d: '#4a3426', M: '#8a4a3a',
		C: '#5f6672', c: '#454b56', A: '#d7d2c4',
		P: '#5e6638', p: '#454b28',
		B: '#3a2a20', b: '#241812'
	},
	client: {
		outline: '#1c1517',
		S: '#f0b98f', s: '#d39a72', L: '#fff0de', h: '#6b5040',
		E: '#2b2420', m: '#4a3428', M: '#9a4a3a',
		C: '#2a2a30', c: '#1d1d22', A: '#f0c23b', T: '#c8463a', Q: '#5a8fd8',
		P: '#2f3340', p: '#23262f',
		B: '#18181c', b: '#0e0e10'
	}
};

/** Мала піксельна іконка над головою (емоція) 7×7. */
export const EMOTE: Record<'think' | 'gpt' | 'tired' | 'angry' | 'idea', string[]> = {
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
	const skin = { S: '#f0b98f', s: '#d39a72', K: '#f08a8a', E: '#2b2420' };
	if (gender === 'f') {
		const [h, H, L] = HAIR_F[look];
		return { body: CLIENT_F_BODY, legs: CLIENT_F_LEGS, pal: { outline: '#22161a', ...skin, h, H, L, M: '#c8344a', Q: '#5a8fd8', ...LOOKS[look] } };
	}
	return { body: BODY.client, legs: LEGS.client, pal: { ...PALETTE.client, ...LOOKS[look] } };
}
