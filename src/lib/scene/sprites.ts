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
