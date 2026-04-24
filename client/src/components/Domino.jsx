import React from 'react'

// Precise pip positions for each value on a 3×3 grid (indices 0-8):
// 0 1 2
// 3 4 5
// 6 7 8
const PIP_POS = {
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

// half = side length of each square half of the tile
function PipFace({ value, half }) {
  const pip = Math.max(3, Math.round(half * 0.17))
  const pad = Math.round(half * 0.13)
  const inner = half - pad * 2
  const cell = inner / 3
  const pos = PIP_POS[value] || []

  return (
    <div style={{
      width: half, height: half,
      display: 'grid',
      gridTemplateColumns: `repeat(3, ${cell}px)`,
      gridTemplateRows: `repeat(3, ${cell}px)`,
      padding: pad,
    }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: cell, height: cell,
        }}>
          {pos.includes(i) && (
            <div style={{
              width: pip, height: pip,
              borderRadius: '50%',
              background: 'var(--pip)',
              boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.35)',
            }} />
          )}
        </div>
      ))}
    </div>
  )
}

export default function Domino({
  tile,
  flipped = false,
  selected = false,
  playable = false,
  disabled = false,
  onBoard = false,
  horizontal = false,  // doubles on the board render horizontally
  onClick,
  onDragStart,
  onDragEnd,
  size = 'normal', // 'normal' | 'small' | 'mini'
}) {
  if (!tile || !Array.isArray(tile)) return null
  const [a, b] = flipped ? [tile[1], tile[0]] : tile

  // Half size drives all dimensions
  const half = size === 'mini' ? 18 : size === 'small' ? 24 : 30

  // Vertical domino: half×half stacked = half wide, half*2 tall
  // Horizontal (doubles on board): half*2 wide, half tall
  const W = horizontal ? half * 2 + 3 : half + 4
  const H = horizontal ? half + 4 : half * 2 + 3

  let shadow = 'none'
  if (selected) shadow = '0 0 0 3px var(--gold), 0 6px 16px rgba(212,168,67,0.3)'
  else if (playable) shadow = '0 0 0 2px var(--green), 0 2px 8px rgba(76,175,125,0.15)'

  return (
    <div
      onClick={!disabled && !onBoard ? onClick : undefined}
      draggable={!disabled && !onBoard && !!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        width: W,
        height: H,
        background: 'var(--bone)',
        border: `1.5px solid var(--bone2)`,
        borderRadius: 5,
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        cursor: onBoard ? 'default' : disabled ? 'not-allowed' : 'grab',
        userSelect: 'none',
        flexShrink: 0,
        opacity: disabled ? 0.35 : 1,
        transform: selected ? 'translateY(-6px)' : 'none',
        transition: onBoard ? 'none' : 'transform 0.13s, box-shadow 0.13s',
        boxShadow: shadow,
        touchAction: 'none',
        backgroundImage: 'linear-gradient(145deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 55%)',
      }}
    >
      {/* First half */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        [horizontal ? 'borderRight' : 'borderBottom']: `1.5px solid var(--bdiv)`,
        flexShrink: 0,
      }}>
        <PipFace value={a} half={half} />
      </div>

      {/* Second half */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PipFace value={b} half={half} />
      </div>
    </div>
  )
}
