import React from 'react'
import { PIP_MAPS } from '../game/engine'

function PipGrid({ n, size = 6, gap = 3 }) {
  const map = PIP_MAPS[n] || []
  const cols = n <= 1 ? 1 : n <= 6 ? 2 : 3
  const rows = n === 0 ? 1 : n === 1 ? 1 : n <= 3 ? n : n <= 6 ? Math.ceil(n / 2) : 3
  const total = cols * rows
  const gridW = cols * (size + gap) - gap
  const gridH = rows * (size + gap) - gap

  if (n === 0) return <div style={{ width: gridW, height: gridH }} />

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, ${size}px)`,
      gridTemplateRows: `repeat(${rows}, ${size}px)`,
      gap: `${gap}px`,
      width: gridW,
      height: gridH,
    }}>
      {Array.from({ length: total }, (_, i) => (
        <div key={i} style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: map.includes(i) ? '#1c1a14' : 'transparent',
        }} />
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
  dragging = false,
  onClick,
  onDragStart,
  onDragEnd,
  size = 'normal', // 'normal' | 'small'
}) {
  const [a, b] = flipped ? [tile[1], tile[0]] : tile
  const W = size === 'small' ? 28 : 32
  const H = size === 'small' ? 56 : 64
  const pipSz = size === 'small' ? 5 : 6

  let boxShadow = 'none'
  if (selected) boxShadow = '0 0 0 3px #d4a843, 0 6px 14px rgba(212,168,67,0.3)'
  else if (playable) boxShadow = '0 0 0 2px #4caf7d'

  const style = {
    width: W,
    height: H,
    background: '#f2ede3',
    border: '1px solid #e8e0d0',
    borderRadius: 5,
    display: 'flex',
    flexDirection: 'column',
    cursor: onBoard ? 'default' : disabled ? 'not-allowed' : 'grab',
    userSelect: 'none',
    flexShrink: 0,
    opacity: disabled ? 0.35 : dragging ? 0.2 : 1,
    transform: selected ? 'translateY(-5px)' : 'none',
    transition: onBoard ? 'none' : 'transform 0.13s, box-shadow 0.13s',
    boxShadow,
    touchAction: 'none',
  }

  return (
    <div
      style={style}
      onClick={!disabled && !onBoard ? onClick : undefined}
      draggable={!disabled && !onBoard && !!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* Top half */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderBottom: '1.5px solid #c8bfaa',
      }}>
        <PipGrid n={a} size={pipSz} />
      </div>
      {/* Bottom half */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <PipGrid n={b} size={pipSz} />
      </div>
    </div>
  )
}
