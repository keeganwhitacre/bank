// ══ SETTINGS (what the next new game will use) ══
var T = 'br';
var MODE = 'standard';
var RACE_TARGET = 1500;
var USE_DICE = false;
var SEL_R = 10;
var OPTS = { chaosCount: 1, lmsMinBank: 100, lmsSuddenDeath: true };
var RECORDS = lsGet(LS_RECORDS) || { bestBank: 0, bestBankBy: '', biggestBust: 0, biggestPot: 0 };

var THEME_MAP = {
  dive: { cls: 't-dive', bankText: 'Bank it', undoText: 'undo', bg: '#1a1a18' },
  sb:   { cls: 't-sb',   bankText: 'BANK',    undoText: 'UNDO', bg: '#111111' },
  br:   { cls: 't-br',   bankText: 'BANK',    undoText: 'UNDO', bg: '#ddd8ce' },
  term: { cls: 't-term', bankText: 'BANK_IT', undoText: 'UNDO', bg: '#080d08' },
  cas:  { cls: 't-cas',  bankText: 'Bank',    undoText: 'undo', bg: '#0b0b0b' }
};
var MODE_LABELS = { standard: 'Standard', turbo: 'Turbo', race: 'Race to the Bank', blackout: 'Blackout', cutthroat: 'Cutthroat', rollerscut: "Roller's Cut", sabotage: 'Sabotage', chaos: 'Chaos Bank', lms: 'Last Man Standing' };
var THEME_LABELS = { dive: 'Dive Bar', sb: 'Scoreboard', br: 'Brutalist', term: 'Terminal', cas: 'Casino' };

var MODE_RULES = {
  standard:   ['The first 3 rolls are safe. A 7 adds 70.', 'From roll 4, a 7 busts the round: everyone who hasn’t banked gets nothing.', 'From roll 4, doubles double the pot.', 'Anyone can bank at any time, then sits out the rest of the round.'],
  turbo:      ['No safe rolls: a 7 busts from the very first roll.', 'Doubles double the pot.', 'Bank early or lose everything.'],
  race:       ['No round limit.', 'The first player whose banked total reaches the target wins instantly.', 'Normal rules otherwise: 3 safe rolls, then 7 busts.'],
  blackout:   ['After roll 3 the pot goes dark. Keep count in your heads.', 'Scores of players who banked stay hidden until the round ends.', 'Normal rules otherwise.'],
  cutthroat:  ['From roll 4, a 2 or 12 halves the pot (even though they’re doubles).', 'Other doubles still double the pot.'],
  rollerscut: ['When only one player is still in, each of their rolls earns 20% extra on top of what it adds.', 'A 7 still busts.'],
  sabotage:   ['Everyone starts with a card. New cards are dealt every 5 rounds.', 'Only the current roller can play a card.', 'Insurance pays half the pot on a bust. Freeze shows up once per game.'],
  chaos:      ['Every round draws a random rule (or two, if you chose that).', 'The active rules stay at the top of the screen all round. Tap one for details.', 'Normal rules otherwise.'],
  lms:        ['Everyone starts with 3 lives.', 'A bust costs every player still in one life. Lose them all and you’re out.', 'Nobody can bank until the pot reaches the minimum.', 'If a bust would knock out everyone left, the highest score survives.', 'Sudden death (optional) after round 10: everyone drops to 1 life and the minimum climbs 100 each round.', 'Last player standing wins.']
};

// ══ CHAOS MODIFIERS (defined in rules.js) ══
var MODS = Rules.MODS;
