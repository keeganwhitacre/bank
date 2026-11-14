// ══ SETTINGS (what the next new game will use) ══
var T = 'sb';   // Scoreboard: dark, readable from across a table
var MODE = 'standard';
var RACE_TARGET = 1500;
var USE_DICE = false;
var SEL_R = 10;
var OPTS = { chaosCount: 1, chaosPool: [], lmsLives: 3, lmsMinBank: 100, lmsSuddenDeath: true };
// How the app behaves on this phone
var PREFS_DEFAULTS = { sound: 'med', haptics: true, wake: true, motion: 'auto', announce: 'all', dice: false, diceStyle: '3d', shake: true, roundSheet: 'busts' };
var PREFS = JSON.parse(JSON.stringify(PREFS_DEFAULTS));
// Default house rules for new games (see Rules.HOUSE_DEFAULTS)
var HOUSE = JSON.parse(JSON.stringify(Rules.HOUSE_DEFAULTS));
var RECORDS = lsGet(LS_RECORDS) || { bestBank: 0, bestBankBy: '', biggestBust: 0, biggestPot: 0 };

var THEME_MAP = {
  dive: { cls: 't-dive', bankText: 'Bank it', undoText: 'undo', bg: '#1a1a18' },
  sb:   { cls: 't-sb',   bankText: 'BANK',    undoText: 'UNDO', bg: '#111111' },
  br:   { cls: 't-br',   bankText: 'BANK',    undoText: 'UNDO', bg: '#ddd8ce' },
  cas:  { cls: 't-cas',  bankText: 'Bank',    undoText: 'undo', bg: '#0b0b0b' },
  neon: { cls: 't-neon', bankText: 'BANK',    undoText: 'UNDO', bg: '#0c0716' },
  felt: { cls: 't-felt', bankText: 'BANK',    undoText: 'UNDO', bg: '#0d3b29' }
};
// Mode picker on the setup screen: the premier four, then variants under "More modes"
var MODE_INFO = {
  standard:   { tag: 'Classic Bank',           desc: 'The original. 3 safe rolls build the pot, then a 7 wipes out everyone who hasn\u2019t banked.', premier: true },
  chaos:      { tag: 'A new rule every round', desc: 'Each round draws a random rule (No Mercy, Lockdown, Hot Hand\u2026) that changes how everyone plays.', premier: true },
  lms:        { tag: 'Lives & elimination',    desc: 'Everyone has lives. A bust costs everyone still in a life. Last one standing wins.', premier: true },
  sabotage:   { tag: 'Cards to mess with each other', desc: 'Everyone holds cards: freeze a rival, tax the next banker, put a bounty on someone, or insure yourself.', premier: true },
  turbo:      { tag: 'No safe rolls',          desc: 'A 7 busts from the very first roll. Bank early or lose everything.' },
  race:       { tag: 'First to the target',    desc: 'No round limit: the first player to bank up to the target score wins on the spot.' },
  blackout:   { tag: 'Pot goes dark',          desc: 'After the safe rolls the pot is hidden. Keep count in your heads.' },
  cutthroat:  { tag: '2 or 12 halves the pot', desc: 'After the safe rolls, a 2 or 12 cuts the pot in half instead of doubling it.' },
  rollerscut: { tag: 'Greed pays',             desc: 'When only one player is still in, every roll earns them 20% extra.' }
};
var MODE_LABELS = { standard: 'Standard', turbo: 'Turbo', race: 'Race to the Bank', blackout: 'Blackout', cutthroat: 'Cutthroat', rollerscut: "Roller's Cut", sabotage: 'Sabotage', chaos: 'Chaos Bank', lms: 'Last Man Standing' };
var THEME_LABELS = { dive: 'Dive Bar', sb: 'Scoreboard', br: 'Brutalist', cas: 'Casino', neon: 'Neon', felt: 'Felt' };

// Tokens: {S} safe rolls, {N} first danger roll, {V} safe 7 value, {M} doubles multiplier, {L} lives, {B} min bank
var MODE_RULES = {
  standard:   ['The first {S} rolls are safe. A 7 adds {V}.', 'From roll {N}, a 7 busts the round: everyone who hasn\u2019t banked gets nothing.', 'From roll {N}, doubles multiply the pot by {M}.', 'Anyone can bank at any time, then sits out the rest of the round.'],
  turbo:      ['No safe rolls: a 7 busts from the very first roll.', 'Doubles multiply the pot by {M}.', 'Bank early or lose everything.'],
  race:       ['No round limit.', 'The first player whose banked total reaches the target wins instantly.', 'Normal rules otherwise: {S} safe rolls, then 7 busts.'],
  blackout:   ['After roll {S} the pot goes dark. Keep count in your heads.', 'Scores of players who banked stay hidden until the round ends.', 'Normal rules otherwise.'],
  cutthroat:  ['From roll {N}, a 2 or 12 halves the pot (even though they\u2019re doubles).', 'Other doubles still multiply the pot by {M}.'],
  rollerscut: ['When only one player is still in, each of their rolls earns 20% extra on top of what it adds.', 'A 7 still busts.'],
  sabotage:   ['Everyone starts with a card. New cards are dealt every 5 rounds.', 'Only the current roller can play a card.', 'Insurance pays half the pot on a bust. Freeze shows up once per game.', 'Hands are public: everyone\u2019s cards show on their name. Hold a name to read them.'],
  chaos:      ['Every round draws a random rule (or two, if you chose that).', 'The active rules stay at the top of the screen all round. Tap one for details.', 'Normal rules otherwise: {S} safe rolls, then 7 busts.'],
  lms:        ['Everyone starts with {L} lives.', 'A bust costs every player still in one life. Lose them all and you\u2019re out.', 'Nobody can bank until the pot reaches {B}.', 'If a bust would knock out everyone left, the highest score survives.', 'Sudden death (optional) after round 10: everyone drops to 1 life and the minimum climbs 100 each round.', 'Last player standing wins.']
};
function ruleText(line, g) {
  var h = (g.opts && g.opts.house) || Rules.HOUSE_DEFAULTS, s = Rules.safeRollCount(g);
  return line.replace(/\{S\}/g, s).replace(/\{N\}/g, s + 1).replace(/\{V\}/g, h.safe7).replace(/\{M\}/g, h.doublesMult)
             .replace(/\{L\}/g, g.opts.lmsLives || 3).replace(/\{B\}/g, fmt(Rules.lmsMinBank(g)));
}

// ══ CHAOS MODIFIERS (defined in rules.js) ══
var MODS = Rules.MODS;
