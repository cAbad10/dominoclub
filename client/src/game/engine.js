// Client-side domino helpers (no server deps)

export function getChainEnds(chain) {
  if (!chain.length) return { L: null, R: null }
  return { L: chain[0].eL, R: chain[chain.length - 1].eR }
}

export function canPlayTile(tile, chain) {
  if (!chain.length) return true
  const { L, R } = getChainEnds(chain)
  return tile[0] === L || tile[1] === L || tile[0] === R || tile[1] === R
}

export function tileMatchesEnd(tile, end) {
  return tile[0] === end || tile[1] === end
}

export function pipTotal(hand) {
  return hand.reduce((s, t) => s + t[0] + t[1], 0)
}

// Pip layout maps — which of the 9 grid cells (0-8) get a dot
export const PIP_MAPS = {
  0: [],
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
}
