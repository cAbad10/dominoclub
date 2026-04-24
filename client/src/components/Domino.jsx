import React from 'react'

// Precise pip positions for each value using a 3x3 grid (indices 0-8)
// 0 1 2
// 3 4 5
// 6 7 8
const PIP_POSITIONS = {
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

function PipFace({ value, size }) {
  // Each half is `size` wide and `size` tall
  // Pip size scales with tile size
  const pipSize = Math.max(3, Math.round(size * 0.18))
  const padding = Math.round(size * 0.12)
  const available = size - padding * 2
  const cellSize = Math.round(available / 3)
  const positions = PIP_POSITIONS[value] || []

  if (value === 0) return <div style={{ width: size, height: size }} />

  return (
    <div style={{
      width: size,
      height: size,
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: `repeat(3, ${cellSize}px)`,
      gridTemplateRows: `repeat(3, ${cellSize}px)`,
      padding: padding,
      gap: 0,
    }}>
      {Array.from({ length: 9 }, (_, i) => (
        <div key={i} style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: cellSize,
          height: cellSize,
        }}>
          {positions.includes(i) && (
            <div style={{
              width: pipSize,
              height: pipSize,
              borderRadius: '50%',
              background: '#1a1714',
              boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.4)',
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
  horizontal = false,  // for board chain doubles
  onClick,
  onDragStart,
  onDragEnd,
  size = 'normal', // 'normal' | 'small' | 'mini'
}) {
  if (!tile || !Array.isArray(tile)) return null
  const [a, b] = flipped ? [tile[1], tile[0]] : tile

  // Tile dimensions
  const halfSize = size === 'mini' ? 18 : size === 'small' ? 24 : 30
  const W = horizontal ? halfSize * 2 + 2 : halfSize + 4  // +border
  const H = horizontal ? halfSize + 4 : halfSize * 2 + 2

  // Colors — ivory bone with slight warmth
  const boneColor = '#f4efe4'
  const boneBorder = '#d4cbbf'
  const dividerColor = '#c0b8aa'

  let shadow = 'none'
  if (selected) shadow = '0 0 0 3px #d4a843, 0 8px 20px rgba(212,168,67,0.35)'
  else if (playable) shadow = '0 0 0 2px #4caf7d, 0 2px 8px rgba(76,175,125,0.2)'

  const isDouble = tile[0] === tile[1]

  return (
    <div
      onClick={!disabled && !onBoard ? onClick : undefined}
      draggable={!disabled && !onBoard && !!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      style={{
        width: W,
        height: H,
        background: boneColor,
        border: `1.5px solid ${boneBorder}`,
        borderRadius: 5,
        display: 'flex',
        flexDirection: horizontal ? 'row' : 'column',
        cursor: onBoard ? 'default' : disabled ? 'not-allowed' : 'grab',
        userSelect: 'none',
        flexShrink: 0,
        opacity: disabled ? 0.38 : 1,
        transform: selected ? 'translateY(-6px)' : 'none',
        transition: onBoard ? 'none' : 'transform 0.13s, box-shadow 0.13s',
        boxShadow: shadow,
        touchAction: 'none',
        position: 'relative',
        // Subtle inner bevel
        backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.6) 0%, rgba(255,255,255,0) 50%)',
      }}
    >
      {/* First half */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        [horizontal ? 'borderRight' : 'borderBottom']: `1.5px solid ${dividerColor}`,
      }}>
        <PipFace value={a} size={halfSize} />
      </div>

      {/* Center dot on doubles */}
      {isDouble && onBoard && (
        <div style={{
          position: 'absolute',
          [horizontal ? 'left' : 'top']: '50%',
          [horizontal ? 'top' : 'left']: '50%',
          transform: 'translate(-50%, -50%)',
          width: 5,
          height: 5,
          borderRadius: '50%',
          background: dividerColor,
          zIndex: 1,
        }} />
      )}

      {/* Second half */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PipFace value={b} size={halfSize} />
      </div>
    </div>
  )
}
