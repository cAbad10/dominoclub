// ─── DOMINO ENGINE ────────────────────────────────────────────────────────────
// Cuban rules: Double-9 set, 10 tiles per player, capicú bonus, score to target

const FULL_SET = [];
for (let i = 0; i <= 9; i++)
  for (let j = i; j <= 9; j++)
    FULL_SET.push([i, j]);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(players, tilesEach = 10) {
  const shuffled = shuffle(FULL_SET);
  const hands = {};
  players.forEach((p, i) => {
    hands[p.id] = shuffled.slice(i * tilesEach, (i + 1) * tilesEach);
  });
  return { hands, boneyard: shuffled.slice(players.length * tilesEach) };
}

function findFirstPlayer(hands) {
  // Player with highest double goes first (double-9 priority = Cuban rules)
  let best = -1, bestPlayer = null;
  for (const [pid, hand] of Object.entries(hands)) {
    for (const tile of hand) {
      if (tile[0] === tile[1] && tile[0] > best) {
        best = tile[0];
        bestPlayer = pid;
      }
    }
  }
  // Fallback: highest pip total
  if (!bestPlayer) {
    let max = -1;
    for (const [pid, hand] of Object.entries(hands)) {
      const s = hand.reduce((a, t) => a + t[0] + t[1], 0);
      if (s > max) { max = s; bestPlayer = pid; }
    }
  }
  return bestPlayer;
}

function getChainEnds(chain) {
  if (!chain.length) return { L: null, R: null };
  return { L: chain[0].eL, R: chain[chain.length - 1].eR };
}

function canPlayTile(tile, chain) {
  if (!chain.length) return true;
  const { L, R } = getChainEnds(chain);
  return tile[0] === L || tile[1] === L || tile[0] === R || tile[1] === R;
}

function buildChainEntry(tile, side, chain) {
  if (!chain.length) {
    return { tile, eL: tile[0], eR: tile[1], flipped: false };
  }
  const { L, R } = getChainEnds(chain);
  if (side === 'left') {
    // matching end must sit on the RIGHT of the tile (facing into the chain)
    // flip when tile[0]===L so that tile[0] moves to the right side
    const flipped = tile[0] === L;
    const eL = flipped ? tile[1] : tile[0];
    return { tile, eL, eR: L, flipped, side: 'left' };
  } else {
    // matching end must sit on the LEFT of the tile (facing into the chain)
    // flip when tile[1]===R so that tile[1] moves to the left side
    const flipped = tile[1] === R;
    const eR = flipped ? tile[0] : tile[1];
    return { tile, eL: R, eR, flipped, side: 'right' };
  }
}

function isCapicu(tile, chain) {
  if (chain.length < 2) return false;
  const { L, R } = getChainEnds(chain);
  return (
    (tile[0] === L && tile[1] === R) ||
    (tile[1] === L && tile[0] === R) ||
    (tile[0] === R && tile[1] === L) ||
    (tile[0] === tile[1] && tile[0] === L && tile[0] === R)
  );
}

function pipTotal(hand) {
  return hand.reduce((s, t) => s + t[0] + t[1], 0);
}

function calcRoundScore(winnerId, players, hands, isCapicu) {
  if (!winnerId) {
    // Blocked game - team with lowest pips wins difference
    const teamPips = { 1: 0, 2: 0 };
    players.forEach(p => { teamPips[p.team] += pipTotal(hands[p.id] || []); });
    if (teamPips[1] < teamPips[2]) {
      return { winTeam: 1, points: Math.ceil((teamPips[2] - teamPips[1]) / 5) * 5, blocked: true };
    } else if (teamPips[2] < teamPips[1]) {
      return { winTeam: 2, points: Math.ceil((teamPips[1] - teamPips[2]) / 5) * 5, blocked: true };
    }
    return { winTeam: null, points: 0, blocked: true };
  }

  const winner = players.find(p => p.id === winnerId);
  const oppPips = players
    .filter(p => p.id !== winnerId)
    .reduce((s, p) => s + pipTotal(hands[p.id] || []), 0);
  let points = Math.ceil(oppPips / 5) * 5;
  if (isCapicu) points += 10;
  return { winTeam: winner.team, points, capicu: isCapicu };
}

module.exports = {
  deal,
  findFirstPlayer,
  getChainEnds,
  canPlayTile,
  buildChainEntry,
  isCapicu,
  pipTotal,
  calcRoundScore,
};
