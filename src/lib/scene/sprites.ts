/**
 * Піксельні персонажі 12×18: 14 рядків тіла + 4 рядки ніг (два кадри ходи).
 * Літера — роль пікселя, колір дає палітра персонажа; «.» — прозоро.
 */

export type SpriteId = 'strategist' | 'copywriter' | 'designer' | 'client';

export const BODY: Record<SpriteId, string[]> = {
	// Стратегиня: пастельне волосся з хвостиками, великі очі з відблиском, румʼянець, комірець-матроска з бантиком.
	strategist: [
		'...hhhhhh...',
		'..hHHHHHHh..',
		'.hHHHHHHHHh.',
		'hhHhSSSShHhh',
		'hhSSSSSSSShh',
		'h.SEWSSEWS.h',
		'h.SEESSEES.h',
		'h.KSSSSSSK..',
		'..SSSMMSSS..',
		'..cWWRRWWc..',
		'.CCCWRRWCCC.',
		'.CCCCCCCCCC.',
		'.SCCCCCCCCS.',
		'..CCCCCCCC..'
	],
	// Копірайтер: гірчична шапка-біні, круглі окуляри, вуса, білі навушники, светр під горло.
	copywriter: [
		'...bbbbbb...',
		'..bbbbbbbb..',
		'..BBBBBBBB..',
		'..hSSSSSSh..',
		'..SSSSSSSS..',
		'.WGEGSSGEGW.',
		'..SSSSSSSS..',
		'..SmmmmmmS..',
		'..SSSMMSSS..',
		'..cCCCCCCc..',
		'.CCCAACCCCC.',
		'.CCCAACCCCC.',
		'.SCCCCCCCCS.',
		'..CCCCCCCC..'
	],
	// Дизайнер: довге волосся до плечей, густа борода, худі з капюшоном.
	designer: [
		'...hhhhhh...',
		'..hhhhhhhh..',
		'.hhHHHHHHhh.',
		'.hHSSSSSSHh.',
		'.hSSSSSSSSh.',
		'.hSEESSEESh.',
		'.hSSSSSSSSh.',
		'.hddSSSSddh.',
		'.hddddddddh.',
		'.hcddddddch.',
		'.CCCddddCCC.',
		'.CCCCAACCCC.',
		'.SCCCAACCCS.',
		'..CCCCCCCC..'
	],
	// Клієнт: лиса маківка, шкірянка, золотий ланцюг, телефон у руці.
	client: [
		'....SSSS....',
		'...SSSSSS...',
		'..hSSSSSSh..',
		'..hSSSSSSh..',
		'..SSSSSSSS..',
		'..SEESSEES..',
		'..SSSSSSSS..',
		'..SSMMMMSS..',
		'...SSSSSS...',
		'..cCAAAACc..',
		'.CCCAAAACCC.',
		'.CCCCAACCCP.',
		'.SCCCCCCCCP.',
		'..CCCCCCCC..'
	]
};

export const LEGS: Record<SpriteId, [string[], string[]]> = {
	strategist: [
		['..kkkkkkkk..', '...SS..SS...', '...WW..WW...', '..BBB..BBB..'],
		['..kkkkkkkk..', '..SS...SS...', '..WW....WW..', '.BBB....BBB.']
	],
	copywriter: [
		['...PPPPPP...', '...PP..PP...', '...SS..SS...', '..BBB..BBB..'],
		['...PPPPPP...', '..PP...PP...', '..SS....SS..', '.BBB....BBB.']
	],
	designer: [
		['...PPPPPP...', '...PP..PP...', '...PP..PP...', '..BBB..BBB..'],
		['...PPPPPP...', '..PP...PP...', '..PP....PP..', '.BBB....BBB.']
	],
	client: [
		['...PPPPPP...', '...PP..PP...', '...PP..PP...', '..BBB..BBB..'],
		['...PPPPPP...', '..PP...PP...', '..PP....PP..', '.BBB....BBB.']
	]
};

export const PALETTE: Record<SpriteId, Record<string, string>> = {
	strategist: { h: '#c98ab8', H: '#e6a9d2', S: '#ffd9b8', E: '#4a3a7a', W: '#ffffff', K: '#f2a0a8', M: '#c2546f', c: '#6f8fc9', C: '#8fb0e6', R: '#e0546a', k: '#5a6fa8', B: '#5a3f3a' },
	copywriter: { b: '#d9a441', B: '#b8862e', h: '#5a3b28', S: '#f2c49b', G: '#2b2420', E: '#2b2420', W: '#ffffff', m: '#5a3b28', M: '#a85a4a', c: '#3f6f6a', C: '#4f8a83', A: '#e8e2d0', P: '#3b4a52' },
	designer: { h: '#4a3226', H: '#5e4030', S: '#e9b98f', E: '#2b2420', d: '#4a3226', c: '#3a3d46', C: '#4b4f5a', A: '#9aa0ad', P: '#2f3a52', B: '#2b2420' },
	client: { S: '#f0b98f', h: '#6b5040', E: '#2b2420', M: '#9a4a3a', c: '#1f1f22', C: '#2c2c31', A: '#e8b93b', P: '#2a2d36', B: '#141416' }
};
// Взуття копірайтера — окремий ключ, бо «B» у нього вже шапка.
LEGS.copywriter = LEGS.copywriter.map((f) => f.map((row, i) => (i === 3 ? row.replaceAll('B', 'Z') : row))) as [string[], string[]];
PALETTE.copywriter.Z = '#2b2420';

/** Мала піксельна іконка над головою (емоція) 7×7. */
export const EMOTE: Record<'think' | 'gpt' | 'tired' | 'angry' | 'idea', string[]> = {
	think: ['..xxx..', '.x...x.', '....x..', '...x...', '...x...', '.......', '...x...'],
	gpt: ['.xxxxx.', 'x.....x', 'x.x.x.x', 'x.....x', '.xxxxx.', '..x.x..', '.xx.xx.'],
	tired: ['.......', 'xx.....', '.x.....', 'x..xx..', 'xx..x..', '...x...', '...xx..'],
	angry: ['x.....x', '.x...x.', '..x.x..', '.......', '.xxxxx.', 'x.....x', '.......'],
	idea: ['..xxx..', '.x...x.', '.x...x.', '..x.x..', '..xxx..', '..xxx..', '...x...']
};
