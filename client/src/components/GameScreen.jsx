import React, { useEffect, useRef, useState, useCallback } from 'react'
import Domino from './Domino'
import { canPlayTile, getChainEnds, tileMatchesEnd } from '../game/engine'

// ── FELT CANVAS ───────────────────────────────────────────────────────────────
function FeltCanvas() {
  const ref = useRef(null)
  useEffect(() => {
    function draw() {
      const c = ref.current; if (!c) return
      const p = c.parentElement; if (!p) return
      c.width = p.offsetWidth; c.height = p.offsetHeight
      const ctx = c.getContext('2d'), W = c.width, H = c.height
      ctx.fillStyle = '#1b3d2a'; ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(W/2, H/2, W*.38, H*.4, 0, 0, Math.PI*2); ctx.stroke()
      ;[[18,18],[W-18,18],[18,H-18],[W-18,H-18]].forEach(([cx,cy]) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.07)'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI*2); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI*2); ctx.stroke()
      })
    }
    draw()
    const ro = new ResizeObserver(draw)
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement)
    return () => ro.disconnect()
  }, [])
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

// ── NAMEPLATE ─────────────────────────────────────────────────────────────────
function Nameplate({ player, isActive, handCount, compact = false }) {
  if (!player) return <div style={{ fontSize: '.5rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>—</div>
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const count = handCount || 0
  const danger = count === 1
  const show = Math.min(count, compact ? 5 : 7)

  if (compact) {
    // Horizontal compact for mobile top strip
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '.3rem', padding: '.15rem .3rem' }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--green)' : 'var(--surf3)', flexShrink: 0, boxShadow: isActive ? '0 0 5px var(--green)' : 'none' }} />
        <div style={{ fontSize: '.65rem', fontWeight: 700, fontFamily: 'var(--mono)', color: tc, whiteSpace: 'nowrap' }}>{player.name}</div>
        <div style={{ fontSize: '.55rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>·{count}</div>
        <div style={{ display: 'flex', gap: 2 }}>
          {Array.from({ length: show }).map((_, i) => (
            <div key={i} style={{ width: 14, height: 9, borderRadius: 2, background: danger ? '#5a1a1a' : 'var(--surf3)', border: `1px solid ${danger ? 'var(--red)' : 'var(--br2)'}` }} />
          ))}
          {count > show && <div style={{ fontSize: '.5rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>+{count - show}</div>}
        </div>
      </div>
    )
  }

  // Vertical for side strips
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.18rem' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: isActive ? 'var(--green)' : 'var(--surf3)', boxShadow: isActive ? '0 0 6px var(--green)' : 'none' }} />
      <div style={{ fontSize: '.62rem', fontWeight: 700, fontFamily: 'var(--mono)', color: tc, whiteSpace: 'nowrap', maxWidth: 62, overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>{player.name}</div>
      <div style={{ fontSize: '.52rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>T{player.team}·{count}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
        {Array.from({ length: show }).map((_, i) => (
          <div key={i} style={{ width: 9, height: 14, borderRadius: 2, background: danger ? '#5a1a1a' : 'var(--surf3)', border: `1px solid ${danger ? 'var(--red)' : 'var(--br2)'}` }} />
        ))}
        {count > show && <div style={{ fontSize: '.48rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>+{count - show}</div>}
      </div>
    </div>
  )
}

// ── FIRST TILE DROP ZONE ──────────────────────────────────────────────────────
function FirstTileZone({ active, onDrop, onClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e => { e.preventDefault(); if (active) setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={e => {
        e.preventDefault(); setOver(false)
        if (!active) return
        try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); if (d?.tile) onDrop(d.tile, 'left') } catch (_) {}
      }}
      onClick={() => { if (active) onClick() }}
      style={{
        width: 80, height: 120,
        border: `2px dashed ${over ? 'var(--gold)' : active ? 'var(--green)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 10,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
        cursor: active ? 'pointer' : 'default',
        background: over ? 'rgba(212,168,67,0.1)' : active ? 'rgba(76,175,125,0.06)' : 'transparent',
        animation: active && !over ? 'dp 1.2s infinite' : 'none',
        transition: 'all .15s',
      }}
    >
      <div style={{ fontSize: '1.2rem', opacity: active ? .7 : .2 }}>🁣</div>
      <div style={{ fontSize: '.6rem', fontFamily: 'var(--mono)', color: active ? 'var(--green)' : 'rgba(255,255,255,.2)', textAlign: 'center', lineHeight: 1.4 }}>
        {active ? 'Drag or\nclick to play' : 'Waiting...'}
      </div>
    </div>
  )
}

// ── END DROP ZONE ─────────────────────────────────────────────────────────────
function EndZone({ side, value, active, onDrop, onClick }) {
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
        border: `2px dashed ${over ? 'var(--gold)' : active ? 'var(--green)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 8,
        width: 38, minHeight: 60,
        padding: '4px 2px',
        background: over ? 'rgba(212,168,67,0.1)' : active ? 'rgba(76,175,125,0.05)' : 'transparent',
        animation: active && !over ? 'dp 1.2s infinite' : 'none',
        transition: 'all .15s',
        cursor: active ? 'pointer' : 'default',
        flexShrink: 0,
        gap: 2,
      }}
    >
      <div style={{ fontSize: '.55rem', color: over ? 'var(--gold)' : active ? 'var(--green)' : 'rgba(255,255,255,.2)', fontFamily: 'var(--mono)' }}>
        {side === 'left' ? '←' : '→'}
      </div>
      <div style={{ fontSize: '.62rem', fontWeight: 700, color: over ? 'var(--gold)' : 'rgba(255,255,255,.3)', fontFamily: 'var(--mono)' }}>
        {value ?? '?'}
      </div>
    </div>
  )
}

// ── CUBAN CHAIN LAYOUT ────────────────────────────────────────────────────────
// Traditional Cuban style:
//  - Regular tiles vertical (narrow side horizontal, long side vertical)
//  - Doubles horizontal (rotated 90°)
//  - Chain goes right in a row, snakes down and back left, etc.
//  - First tile centered, doubles are perpendicular to the direction of play

function useTileSize() {
  // Read CSS variable for responsive tile sizing
  const [half, setHalf] = useState(28)
  useEffect(() => {
    function update() {
      const v = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-half')) || 28
      setHalf(v)
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(document.documentElement)
    return () => ro.disconnect()
  }, [])
  return half
}

function CubanChain({ chain }) {
  const half = useTileSize()
  const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--tile-gap')) || 3

  if (!chain.length) return null

  // Tile dimensions
  const TW = half + 4        // vertical tile width (narrow)
  const TH = half * 2 + 3    // vertical tile height (tall)
  const DW = half * 2 + 3    // double (horizontal) width
  const DH = half + 4        // double height

  // How many tiles fit in a row before snaking
  // We'll compute dynamically but use a sensible default
  const MAX_ROW = 7

  const items = []
  let curX = 0, curY = 0
  let dir = 1  // 1=right, -1=left
  let rowCount = 0

  chain.forEach((entry, i) => {
    const isDbl = entry.tile[0] === entry.tile[1]
    const w = isDbl ? DW : TW
    const h = isDbl ? DH : TH
    // Center doubles vertically in the row
    const yOff = isDbl ? (TH - DH) / 2 : 0

    items.push({ entry, x: curX, y: curY + yOff, w, h, isDbl })
    rowCount++

    if (rowCount >= MAX_ROW && i < chain.length - 1) {
      // Snake turn: drop down, reverse
      curY += TH + gap * 2
      dir *= -1
      rowCount = 0
      // Don't advance x — stay at corner position
    } else {
      curX += dir * (w + gap)
    }
  })

  // Normalize x so leftmost = 0
  const minX = Math.min(...items.map(it => it.x))
  items.forEach(it => { it.x -= minX })
  const totalW = Math.max(...items.map(it => it.x + it.w))
  const totalH = Math.max(...items.map(it => it.y + it.h))

  return (
    <div style={{ position: 'relative', width: totalW, height: totalH, flexShrink: 0 }}>
      {items.map(({ entry, x, y, isDbl }, i) => (
        <div key={i} style={{ position: 'absolute', left: x, top: y }}>
          <Domino
            tile={entry.tile}
            flipped={entry.flipped || false}
            horizontal={isDbl}
            onBoard
          />
        </div>
      ))}
    </div>
  )
}

// ── SCORE HEADER ──────────────────────────────────────────────────────────────
function ScoreHeader({ scores, target, roundNum, curPlayerName, lastRound, showHistory, onToggleHistory, hasHistory, onLeave, mode }) {
  return (
    <div className="ghdr">
      {/* Left: leave + tag */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem', flexShrink: 0 }}>
        <button className="btn bs bsm" onClick={onLeave} style={{ padding: '.25rem .5rem', fontSize: '.68rem' }}>←</button>
        <span className="tag" style={{ display: 'none' }} id="mode-tag">{mode === 'teams' ? 'Teams' : 'FFA'}</span>
      </div>

      {/* Center: scores */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
        <div className="score-cluster">
          {/* Team 1 */}
          <div className="score-team-block">
            <div className="score-label tc1">Team 1</div>
            <div className="score-number tc1">{scores.t1}</div>
          </div>
          <div className="score-divider">—</div>
          {/* Team 2 */}
          <div className="score-team-block">
            <div className="score-label tc2">Team 2</div>
            <div className="score-number tc2">{scores.t2}</div>
          </div>
        </div>

        {/* Round points row */}
        <div className="round-pts">
          {lastRound
            ? <>Rd {lastRound.round}: <span>+{lastRound.points}pts</span> T{lastRound.winTeam}{lastRound.capicu ? ' ⚡' : ''}</>
            : <>Rnd {roundNum} · First to {target}</>
          }
        </div>
      </div>

      {/* Right: turn + history */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 }}>
        <div style={{ fontSize: '.6rem', fontFamily: 'var(--mono)', color: 'var(--tx2)', whiteSpace: 'nowrap' }}>
          <span style={{ color: 'var(--gold)' }}>{curPlayerName}</span>
        </div>
        {hasHistory && (
          <button
            onClick={onToggleHistory}
            style={{ background: showHistory ? 'var(--surf3)' : 'none', border: '1px solid var(--br)', borderRadius: 5, padding: '1px 5px', cursor: 'pointer', fontSize: '.55rem', fontFamily: 'var(--mono)', color: 'var(--tx2)' }}
          >
            {showHistory ? '✕' : 'log'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── MAIN GAME SCREEN ──────────────────────────────────────────────────────────
export default function GameScreen({ room, myId, myHand, onPlayTile, onPass, onLeave, scoreHistory }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [ghostTile, setGhostTile] = useState(null)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })
  const [showHistory, setShowHistory] = useState(false)

  if (!room?.game || !room?.players || !myId) {
    return (
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ color: 'var(--tx2)', fontFamily: 'var(--mono)', fontSize: '.85rem' }}>Loading...</div>
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
  const isFirstTile = chain.length === 0

  // Seat rotation: me=bottom, +1=left, +2=top(across), +3=right
  const myIdx = players.findIndex(p => p.id === myId)
  const getP = off => players.length > 0 ? players[(myIdx + off) % players.length] || null : null
  const leftP = getP(1), topP = getP(2), rightP = getP(3)

  const canL = !isFirstTile && isMyTurn && myHandSafe.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, L))
  const canR = !isFirstTile && isMyTurn && myHandSafe.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, R))
  const showEndBtns = isMyTurn && selectedIdx !== null && !isFirstTile

  const curPlayerName = players.find(p => p.id === game.currentPlayerId)?.name || '—'
  const lastRound = scoreHistory && scoreHistory.length > 0 ? scoreHistory[scoreHistory.length - 1] : null

  // Ghost drag tracking
  useEffect(() => {
    const move = e => { if (ghostTile) setGhostPos({ x: e.clientX, y: e.clientY }) }
    document.addEventListener('dragover', move)
    return () => document.removeEventListener('dragover', move)
  }, [ghostTile])

  // ── INTERACTION ────────────────────────────────────────────────────────────
  function handleTileClick(idx) {
    if (!isMyTurn) return
    const tile = myHandSafe[idx]
    if (!tile) return

    // First tile — just play it
    if (isFirstTile) {
      onPlayTile(tile, 'left')
      setSelectedIdx(null)
      return
    }

    if (!canPlayTile(tile, chain)) return
    setSelectedIdx(idx)
    const fL = tileMatchesEnd(tile, L)
    const fR = tileMatchesEnd(tile, R)
    if (fL && !fR) { onPlayTile(tile, 'left'); setSelectedIdx(null) }
    else if (!fL && fR) { onPlayTile(tile, 'right'); setSelectedIdx(null) }
    // else: need end choice — buttons appear
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

  function startDrag(tile, idx, e) {
    e.dataTransfer.setData('text/plain', JSON.stringify({ tile, idx }))
    e.dataTransfer.effectAllowed = 'move'
    const blank = document.createElement('canvas'); blank.width = 1; blank.height = 1
    e.dataTransfer.setDragImage(blank, 0, 0)
    setGhostTile(tile)
    setGhostPos({ x: e.clientX, y: e.clientY })
  }

  const hint = isMyTurn
    ? isFirstTile
      ? 'Play the opening tile — drag or tap'
      : hasPlayable
        ? 'Drag tile to ← or → · or tap tile then choose end'
        : 'No playable tiles — pass'
    : `${curPlayerName}'s turn`

  return (
    <div className="game-grid" style={{ position: 'relative' }}>

      {/* HEADER */}
      <ScoreHeader
        scores={scores}
        target={room.target || 100}
        roundNum={game.roundNum || 1}
        curPlayerName={curPlayerName}
        lastRound={lastRound}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(h => !h)}
        hasHistory={!!(scoreHistory && scoreHistory.length > 0)}
        onLeave={onLeave}
        mode={room.mode}
      />

      {/* HISTORY DROPDOWN */}
      {showHistory && scoreHistory && scoreHistory.length > 0 && (
        <div style={{
          position: 'absolute', top: 48, right: 0, zIndex: 50,
          background: 'var(--surf)', border: '1px solid var(--br2)',
          borderRadius: '0 0 0 10px', minWidth: 240,
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ padding: '.4rem .65rem', borderBottom: '1px solid var(--br)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 60px', fontSize: '.58rem', fontFamily: 'var(--mono)', color: 'var(--tx3)', textTransform: 'uppercase' }}>
              <span>#</span><span style={{ color: 'var(--t1)' }}>T1</span><span style={{ color: 'var(--t2)' }}>T2</span><span>+pts</span>
            </div>
          </div>
          <div style={{ maxHeight: 180, overflowY: 'auto' }}>
            {scoreHistory.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '28px 1fr 1fr 60px', padding: '.28rem .65rem', fontSize: '.7rem', fontFamily: 'var(--mono)', borderBottom: i < scoreHistory.length - 1 ? '1px solid var(--br)' : 'none', background: i === scoreHistory.length - 1 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
                <span style={{ color: 'var(--tx3)' }}>{r.round}</span>
                <span style={{ color: r.winTeam === 1 ? 'var(--t1)' : 'var(--tx2)', fontWeight: r.winTeam === 1 ? 700 : 400 }}>{r.t1}</span>
                <span style={{ color: r.winTeam === 2 ? 'var(--t2)' : 'var(--tx2)', fontWeight: r.winTeam === 2 ? 700 : 400 }}>{r.t2}</span>
                <span style={{ color: 'var(--tx3)', fontSize: '.58rem' }}>{r.winTeam ? `+${r.points}${r.capicu ? '⚡' : ''}` : r.blocked ? 'blk' : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TOP PLAYER STRIP */}
      <div className="player-top">
        {/* On mobile show all 3 opponents; on desktop show just across */}
        <div style={{ display: 'flex', gap: '.75rem', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center' }}>
          {/* On mobile (<640) show left, top, right all here */}
          <div className="mobile-side-player" style={{ display: 'none' }}>
            <Nameplate player={leftP} isActive={leftP?.id === game.currentPlayerId} handCount={handCounts[leftP?.id] ?? 0} compact />
          </div>
          <Nameplate player={topP} isActive={topP?.id === game.currentPlayerId} handCount={handCounts[topP?.id] ?? 0} compact />
          <div className="mobile-side-player" style={{ display: 'none' }}>
            <Nameplate player={rightP} isActive={rightP?.id === game.currentPlayerId} handCount={handCounts[rightP?.id] ?? 0} compact />
          </div>
        </div>
      </div>

      {/* CORNER CELLS (desktop only) */}
      <div className="tcn" id="corner-tl" />
      <div className="tcn" id="corner-tr" />

      {/* LEFT PLAYER (desktop only) */}
      <div className="player-side" id="side-lft">
        <Nameplate player={leftP} isActive={leftP?.id === game.currentPlayerId} handCount={handCounts[leftP?.id] ?? 0} />
      </div>

      {/* TABLE */}
      <div className="table-area">
        <FeltCanvas />
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          {isFirstTile ? (
            <FirstTileZone
              active={isMyTurn}
              onDrop={(tile) => handleDrop(tile, 'left')}
              onClick={() => {
                // If one tile is selected, play it
                if (selectedIdx !== null && myHandSafe[selectedIdx]) {
                  onPlayTile(myHandSafe[selectedIdx], 'left')
                  setSelectedIdx(null)
                }
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <EndZone side="left" value={L} active={canL} onDrop={handleDrop} onClick={handleEndChoice} />
              <CubanChain chain={chain} />
              <EndZone side="right" value={R} active={canR} onDrop={handleDrop} onClick={handleEndChoice} />
            </div>
          )}
        </div>
      </div>

      {/* RIGHT PLAYER (desktop only) */}
      <div className="player-side" id="side-rgt">
        <Nameplate player={rightP} isActive={rightP?.id === game.currentPlayerId} handCount={handCounts[rightP?.id] ?? 0} />
      </div>

      {/* HAND TRAY */}
      <div className="hand-tray">
        <div className="hand-top-bar">
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
              <span className="hlbl">{myPlayer?.name || 'Your Hand'}</span>
              <span className={`tag ${myPlayer?.team === 1 ? 'tc1' : 'tc2'}`} style={{ fontSize: '.55rem', padding: '1px 5px' }}>
                T{myPlayer?.team || 1}
              </span>
              <span style={{ fontSize: '.6rem', fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>
                ({myHandSafe.length})
              </span>
            </div>
            <div className="hhin">{hint}</div>
          </div>
          <div style={{ display: 'flex', gap: '.3rem', alignItems: 'center' }}>
            {showEndBtns && (
              <>
                <button className="btn bs bsm" onClick={() => handleEndChoice('left')}>← L</button>
                <button className="btn bs bsm" onClick={() => handleEndChoice('right')}>R →</button>
              </>
            )}
            {isMyTurn && !hasPlayable && !isFirstTile && (
              <button className="btn bs bsm" onClick={onPass}>Pass</button>
            )}
          </div>
        </div>

        <div className="hand-tiles">
          {myHandSafe.map((tile, idx) => {
            if (!tile || !Array.isArray(tile)) return null
            const playable = isMyTurn && (isFirstTile || canPlayTile(tile, chain))
            const sel = selectedIdx === idx
            return (
              <Domino
                key={`${tile[0]}-${tile[1]}-${idx}`}
                tile={tile}
                selected={sel}
                playable={playable && !sel}
                disabled={!isMyTurn || (!isFirstTile && !canPlayTile(tile, chain))}
                onClick={() => handleTileClick(idx)}
                onDragStart={playable ? e => startDrag(tile, idx, e) : null}
                onDragEnd={() => setGhostTile(null)}
              />
            )
          })}
        </div>
      </div>

      {/* DRAG GHOST */}
      {ghostTile && (
        <div style={{ position: 'fixed', left: ghostPos.x, top: ghostPos.y, transform: 'translate(-50%,-50%) scale(1.1)', pointerEvents: 'none', zIndex: 9999, opacity: .88 }}>
          <Domino tile={ghostTile} />
        </div>
      )}
    </div>
  )
}
