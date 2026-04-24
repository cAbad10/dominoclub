import React, { useEffect, useRef, useState } from 'react'
import Domino from './Domino'
import { canPlayTile, getChainEnds, tileMatchesEnd } from '../game/engine'

// ── FELT CANVAS ───────────────────────────────────────────────────────────────
function FeltCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      if (!parent) return
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height
      ctx.fillStyle = '#1b3d2a'
      ctx.fillRect(0, 0, W, H)
      // Subtle felt texture grid
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      // Center oval border
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(W / 2, H / 2, W * 0.38, H * 0.4, 0, 0, Math.PI * 2)
      ctx.stroke()
      // Corner ornaments
      ;[[20, 20], [W - 20, 20], [20, H - 20], [W - 20, H - 20]].forEach(([cx, cy]) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(cx, cy, 10, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, Math.PI * 2); ctx.stroke()
      })
    }
    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])
  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

// ── NAMEPLATE ─────────────────────────────────────────────────────────────────
function Nameplate({ player, isActive, handCount, orientation = 'h' }) {
  if (!player) return <div style={{ fontSize: '.55rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>—</div>
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const count = handCount || 0
  const danger = count === 1
  const show = Math.min(count, orientation === 'v' ? 6 : 8)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem', padding: '.2rem' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? '#4caf7d' : 'var(--surf3)', boxShadow: isActive ? '0 0 6px #4caf7d' : 'none' }} />
      <div style={{ fontSize: '.66rem', fontWeight: 700, fontFamily: 'var(--mono)', color: tc, whiteSpace: 'nowrap', maxWidth: 66, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {player.name}
      </div>
      <div style={{ fontSize: '.55rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>T{player.team} · {count}</div>
      <div style={{ display: 'flex', flexDirection: orientation === 'v' ? 'column' : 'row', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
        {Array.from({ length: show }).map((_, i) => (
          <div key={i} style={{
            width: orientation === 'v' ? 10 : 16,
            height: orientation === 'v' ? 16 : 10,
            borderRadius: 2,
            background: danger ? '#5a1a1a' : 'var(--surf3)',
            border: `1px solid ${danger ? 'var(--red)' : 'var(--br2)'}`,
          }} />
        ))}
        {count > show && <div style={{ fontSize: '.5rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>+{count - show}</div>}
      </div>
    </div>
  )
}

// ── DROP ZONE ─────────────────────────────────────────────────────────────────
function DropZone({ side, value, active, onDrop, onClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (active) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        if (!active) return
        try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d?.tile) onDrop(d.tile, side) } catch (_) {}
      }}
      onClick={() => { if (active) onClick(side) }}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${over ? '#d4a843' : active ? '#4caf7d' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: 8, cursor: active ? 'pointer' : 'default',
        width: 44, minHeight: 66, padding: '4px',
        background: over ? 'rgba(212,168,67,0.12)' : active ? 'rgba(76,175,125,0.05)' : 'transparent',
        animation: active && !over ? 'dp 1.2s ease-in-out infinite' : 'none',
        transition: 'all .15s', flexShrink: 0,
      }}
    >
      <div style={{ fontSize: '.55rem', fontFamily: 'var(--mono)', color: over ? '#d4a843' : active ? '#4caf7d' : 'rgba(255,255,255,.2)', marginBottom: 2 }}>
        {side === 'left' ? '←' : '→'}
      </div>
      <div style={{ fontSize: '.65rem', fontFamily: 'var(--mono)', color: over ? '#d4a843' : 'rgba(255,255,255,.3)', fontWeight: 700 }}>
        {value ?? '?'}
      </div>
    </div>
  )
}

// ── CUBAN CHAIN BOARD ─────────────────────────────────────────────────────────
// Cuban style: tiles go horizontal, doubles are perpendicular (horizontal tile)
// Chain snakes: goes right → turns down-right → continues left → turns down-left → right again
// Each "row" holds up to MAX_ROW tiles before turning

const TILE_W = 34   // vertical domino width on board
const TILE_H = 64   // vertical domino height on board
const DBL_W = 64    // double (horizontal) width
const DBL_H = 34    // double (horizontal) height
const GAP = 4

function CubanChain({ chain, canL, canR, onDrop, onEndClick }) {
  if (!chain.length) return null

  const MAX_ROW = 7  // tiles per row before snake turn

  // Build positioned tiles
  // We'll lay out in rows, snaking right→left→right
  const items = []
  let x = 0
  let y = 0
  let dir = 1  // 1 = right, -1 = left
  let rowCount = 0

  const ROW_H = TILE_H + GAP
  const stepRight = TILE_W + GAP
  const stepLeft = -(TILE_W + GAP)

  // Starting x depends on direction — right starts left, left starts right
  // We'll normalise after computing all positions
  let curX = 0
  let curY = 0

  chain.forEach((entry, i) => {
    const isDouble = entry.tile[0] === entry.tile[1]
    const tW = isDouble ? DBL_W : TILE_W
    const tH = isDouble ? DBL_H : TILE_H

    // Center doubles vertically within the row
    const yOffset = isDouble ? (TILE_H - DBL_H) / 2 : 0

    items.push({
      entry,
      x: curX,
      y: curY + yOffset,
      w: tW,
      h: tH,
      isDouble,
    })

    rowCount++

    if (rowCount >= MAX_ROW && i < chain.length - 1) {
      // Turn: move down and reverse direction
      curY += ROW_H + GAP
      // Stay at same x (corner)
      dir *= -1
      rowCount = 0
    } else {
      curX += dir * (tW + GAP)
    }
  })

  // Normalise — shift all x so minimum x = 0
  const minX = Math.min(...items.map(it => it.x))
  const maxX = Math.max(...items.map(it => it.x + it.w))
  const maxY = Math.max(...items.map(it => it.y + it.h))
  items.forEach(it => { it.x -= minX })
  const totalW = maxX - minX
  const totalH = maxY

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH, flexShrink: 0 }}>
      {items.map(({ entry, x, y, w, h, isDouble }, i) => (
        <div key={i} style={{ position: 'absolute', left: x, top: y }}>
          <Domino
            tile={entry.tile}
            flipped={entry.flipped || false}
            horizontal={isDouble}
            onBoard
            size="normal"
          />
        </div>
      ))}
    </div>
  )
}

// ── GAME SCREEN ───────────────────────────────────────────────────────────────
export default function GameScreen({ room, myId, myHand, onPlayTile, onPass, onLeave, scoreHistory }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [ghostTile, setGhostTile] = useState(null)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })

  if (!room?.game || !room?.players || !myId) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--tx2)', fontFamily: 'var(--mono)', fontSize: '.85rem' }}>Loading game...</div>
      </div>
    )
  }

  const game = room.game
  const players = room.players || []
  const chain = game.chain || []
  const scores = game.scores || { t1: 0, t2: 0 }
  const handCounts = game.handCounts || {}
  const myHandSafe = Array.isArray(myHand) ? myHand : []

  const myPlayer = players.find(p => p.id === myId)
  const isMyTurn = game.currentPlayerId === myId
  const { L, R } = getChainEnds(chain)
  const hasPlayable = myHandSafe.some(t => canPlayTile(t, chain))

  const myIdx = players.findIndex(p => p.id === myId)
  const getPlayer = offset => players.length > 0 ? players[(myIdx + offset) % players.length] || null : null
  const leftPlayer = getPlayer(1)
  const topPlayer = getPlayer(2)
  const rightPlayer = getPlayer(3)

  const canL = isMyTurn && chain.length > 0 && myHandSafe.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, L))
  const canR = isMyTurn && chain.length > 0 && myHandSafe.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, R))
  const showEndBtns = isMyTurn && selectedIdx !== null && chain.length > 0

  useEffect(() => {
    const move = e => { if (ghostTile) setGhostPos({ x: e.clientX, y: e.clientY }) }
    document.addEventListener('dragover', move)
    return () => document.removeEventListener('dragover', move)
  }, [ghostTile])

  function handleTileClick(idx) {
    if (!isMyTurn) return
    const tile = myHandSafe[idx]
    if (!tile || !canPlayTile(tile, chain)) return
    setSelectedIdx(idx)
    if (!chain.length) { onPlayTile(tile, 'left'); setSelectedIdx(null); return }
    const fL = tileMatchesEnd(tile, L)
    const fR = tileMatchesEnd(tile, R)
    if (fL && !fR) { onPlayTile(tile, 'left'); setSelectedIdx(null) }
    else if (!fL && fR) { onPlayTile(tile, 'right'); setSelectedIdx(null) }
  }

  function handleEndChoice(side) {
    if (selectedIdx === null || !myHandSafe[selectedIdx]) return
    onPlayTile(myHandSafe[selectedIdx], side)
    setSelectedIdx(null)
  }

  function handleDrop(tile, side) {
    setGhostTile(null)
    onPlayTile(tile, side)
    setSelectedIdx(null)
  }

  const curPlayerName = players.find(p => p.id === game.currentPlayerId)?.name || '—'
  const [showHistory, setShowHistory] = useState(false)

  return (
    <div className="game-grid" style={{ position: "relative" }}>

      {/* HEADER */}
      <div className="ghdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
          <button className="btn bs bsm" onClick={onLeave}>← Leave</button>
          <span className="tag">Cuban · {room.mode === 'teams' ? 'Teams' : 'FFA'}</span>
        </div>
        <div className="sw">
          <div className="sb"><div className="st tc1">Team 1</div><div className="sn tc1">{scores.t1}</div></div>
          <div className="sd">—</div>
          <div className="sb"><div className="st tc2">Team 2</div><div className="sn tc2">{scores.t2}</div></div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <div className="ti">Turn: <span>{curPlayerName}</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
            <div style={{ fontSize: '.58rem', fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>
              Round {game.roundNum || 1} · First to {room.target || 100}
            </div>
            {scoreHistory && scoreHistory.length > 0 && (
              <button
                onClick={() => setShowHistory(h => !h)}
                style={{ background: showHistory ? 'var(--surf3)' : 'none', border: '1px solid var(--br)', borderRadius: 5, padding: '1px 6px', cursor: 'pointer', fontSize: '.58rem', fontFamily: 'var(--mono)', color: 'var(--tx2)' }}
              >
                {showHistory ? '✕' : 'history'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SCORE HISTORY DROPDOWN */}
      {scoreHistory && scoreHistory.length > 0 && showHistory && (
        <div style={{
          position: 'absolute', top: 46, right: 0, zIndex: 50,
          background: 'var(--surf)', border: '1px solid var(--br2)',
          borderRadius: '0 0 0 10px', minWidth: 260,
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
        }}>
          <div style={{ padding: '.5rem .75rem', borderBottom: '1px solid var(--br)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 70px', fontSize: '.6rem', fontFamily: 'var(--mono)', color: 'var(--tx3)', textTransform: 'uppercase' }}>
              <span>#</span><span style={{ color: 'var(--t1)' }}>T1</span><span style={{ color: 'var(--t2)' }}>T2</span><span>Pts</span>
            </div>
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto' }}>
            {scoreHistory.map((row, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '32px 1fr 1fr 70px', padding: '.3rem .75rem', fontSize: '.72rem', fontFamily: 'var(--mono)', borderBottom: i < scoreHistory.length - 1 ? '1px solid var(--br)' : 'none' }}>
                <span style={{ color: 'var(--tx3)' }}>{row.round}</span>
                <span style={{ color: row.winTeam === 1 ? 'var(--t1)' : 'var(--tx2)', fontWeight: row.winTeam === 1 ? 700 : 400 }}>{row.t1}</span>
                <span style={{ color: row.winTeam === 2 ? 'var(--t2)' : 'var(--tx2)', fontWeight: row.winTeam === 2 ? 700 : 400 }}>{row.t2}</span>
                <span style={{ color: 'var(--tx3)', fontSize: '.6rem' }}>{row.winTeam ? '+' + row.points + (row.capicu ? ' ⚡' : '') : row.blocked ? 'blocked' : 'tied'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CORNERS */}
      <div className="tcn" style={{ gridArea: 'tl', borderRight: '1px solid var(--br)' }} />
      <div className="tcn" style={{ gridArea: 'tr', borderLeft: '1px solid var(--br)' }} />

      {/* TOP PLAYER */}
      <div style={{ gridArea: 'top', background: 'var(--surf)', borderBottom: '1px solid var(--br2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', padding: '0 .8rem' }}>
        <Nameplate player={topPlayer} isActive={topPlayer?.id === game.currentPlayerId} handCount={handCounts[topPlayer?.id] ?? 0} orientation="h" />
      </div>

      {/* LEFT PLAYER */}
      <div style={{ gridArea: 'lft', background: 'var(--surf)', borderRight: '1px solid var(--br)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '.4rem .2rem' }}>
        <Nameplate player={leftPlayer} isActive={leftPlayer?.id === game.currentPlayerId} handCount={handCounts[leftPlayer?.id] ?? 0} orientation="v" />
      </div>

      {/* TABLE */}
      <div style={{ gridArea: 'tbl', position: 'relative', overflow: 'hidden' }}>
        <FeltCanvas />
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          {chain.length === 0 ? (
            <div style={{ color: 'rgba(255,255,255,.15)', fontFamily: 'var(--mono)', fontSize: '.75rem', textAlign: 'center' }}>
              {isMyTurn ? 'Play your first tile to start' : 'Waiting for first tile...'}
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: GAP }}>
              {/* Left drop zone */}
              <DropZone side="left" value={L} active={canL} onDrop={handleDrop} onClick={handleEndChoice} />

              {/* Cuban chain */}
              <CubanChain
                chain={chain}
                canL={canL}
                canR={canR}
                onDrop={handleDrop}
                onEndClick={handleEndChoice}
              />

              {/* Right drop zone */}
              <DropZone side="right" value={R} active={canR} onDrop={handleDrop} onClick={handleEndChoice} />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PLAYER */}
      <div style={{ gridArea: 'rgt', background: 'var(--surf)', borderLeft: '1px solid var(--br)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '.4rem .2rem' }}>
        <Nameplate player={rightPlayer} isActive={rightPlayer?.id === game.currentPlayerId} handCount={handCounts[rightPlayer?.id] ?? 0} orientation="v" />
      </div>

      {/* HAND TRAY */}
      <div style={{ gridArea: 'hnd', background: 'var(--surf)', borderTop: '2px solid var(--br2)', display: 'flex', flexDirection: 'column', padding: '.5rem .9rem .4rem', gap: '.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
              <span className="hlbl">{myPlayer?.name || 'Your Hand'}</span>
              <span className={`tag ${myPlayer?.team === 1 ? 'tc1' : 'tc2'}`} style={{ fontSize: '.56rem', padding: '1px 6px' }}>
                T{myPlayer?.team || 1}
              </span>
            </div>
            <div className="hhin">
              {isMyTurn
                ? hasPlayable
                  ? 'Drag tile to ← or → · or click tile then choose end'
                  : 'No playable tiles — pass'
                : 'Waiting for your turn...'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
            {showEndBtns && (
              <>
                <button className="btn bs bsm" onClick={() => handleEndChoice('left')}>← Left</button>
                <button className="btn bs bsm" onClick={() => handleEndChoice('right')}>Right →</button>
              </>
            )}
            {isMyTurn && !hasPlayable && (
              <button className="btn bs bsm" onClick={onPass}>Pass</button>
            )}
          </div>
        </div>

        {/* Hand tiles */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 3, minHeight: 68 }}>
          {myHandSafe.map((tile, idx) => {
            if (!tile || !Array.isArray(tile)) return null
            const playable = isMyTurn && canPlayTile(tile, chain)
            const sel = selectedIdx === idx
            return (
              <Domino
                key={`${tile[0]}-${tile[1]}-${idx}`}
                tile={tile}
                selected={sel}
                playable={playable && !sel}
                disabled={!isMyTurn || !playable}
                onClick={() => handleTileClick(idx)}
                onDragStart={playable ? e => {
                  e.dataTransfer.setData('text/plain', JSON.stringify({ tile, idx }))
                  e.dataTransfer.effectAllowed = 'move'
                  const blank = document.createElement('canvas'); blank.width = 1; blank.height = 1
                  e.dataTransfer.setDragImage(blank, 0, 0)
                  setGhostTile(tile)
                  setGhostPos({ x: e.clientX, y: e.clientY })
                } : null}
                onDragEnd={() => setGhostTile(null)}
              />
            )
          })}
        </div>
      </div>

      {/* DRAG GHOST */}
      {ghostTile && (
        <div style={{ position: 'fixed', left: ghostPos.x, top: ghostPos.y, transform: 'translate(-50%,-50%) scale(1.1)', pointerEvents: 'none', zIndex: 9999, opacity: .9 }}>
          <Domino tile={ghostTile} />
        </div>
      )}
    </div>
  )
}
