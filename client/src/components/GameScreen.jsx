import React, { useEffect, useRef, useState } from 'react'
import Domino from './Domino'
import { canPlayTile, getChainEnds, tileMatchesEnd } from '../game/engine'

// ── FELT CANVAS ──────────────────────────────────────────────────────────────
function FeltCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    function draw() {
      const canvas = canvasRef.current
      if (!canvas) return
      const parent = canvas.parentElement
      canvas.width = parent.offsetWidth
      canvas.height = parent.offsetHeight
      const ctx = canvas.getContext('2d')
      const W = canvas.width, H = canvas.height

      ctx.fillStyle = '#1a3a2a'
      ctx.fillRect(0, 0, W, H)

      ctx.strokeStyle = 'rgba(255,255,255,0.03)'
      ctx.lineWidth = 1
      for (let x = 0; x < W; x += 34) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
      for (let y = 0; y < H; y += 34) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

      ctx.strokeStyle = 'rgba(255,255,255,0.055)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(W / 2, H / 2, W * 0.35, H * 0.38, 0, 0, Math.PI * 2)
      ctx.stroke()

      [[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]].forEach(([cx, cy]) => {
        ctx.strokeStyle = 'rgba(255,255,255,0.06)'
        ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.stroke()
      })
    }

    draw()
    window.addEventListener('resize', draw)
    return () => window.removeEventListener('resize', draw)
  }, [])

  return <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
}

// ── PLAYER NAMEPLATE ─────────────────────────────────────────────────────────
function Nameplate({ player, isActive, handCount, orientation = 'h' }) {
  if (!player) return <div style={{ fontSize: '.55rem', color: 'var(--tx3)' }}>—</div>
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const danger = handCount === 1
  const tiles = Array.from({ length: Math.min(handCount, orientation === 'v' ? 7 : 9) })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.2rem', padding: '.2rem' }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: isActive ? 'var(--green)' : 'var(--surf3)' }} />
      <div style={{ fontSize: '.66rem', fontWeight: 700, fontFamily: 'var(--mono)', color: tc, whiteSpace: 'nowrap', maxWidth: 68, overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {player.name}
      </div>
      <div style={{ fontSize: '.55rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>
        T{player.team} · {handCount}
      </div>
      <div style={{ display: 'flex', flexDirection: orientation === 'v' ? 'column' : 'row', gap: 2 }}>
        {tiles.map((_, i) => (
          <div key={i} style={{
            width: orientation === 'v' ? 11 : 19,
            height: orientation === 'v' ? 19 : 11,
            borderRadius: 3,
            background: danger ? '#5a1a1a' : 'var(--surf3)',
            border: `1px solid ${danger ? 'var(--red)' : 'var(--br2)'}`,
          }} />
        ))}
        {handCount > (orientation === 'v' ? 7 : 9) && (
          <div style={{ fontSize: '.5rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>
            +{handCount - (orientation === 'v' ? 7 : 9)}
          </div>
        )}
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
        try { const d = JSON.parse(e.dataTransfer.getData('text/plain')); onDrop(d.tile, side) } catch (_) { }
      }}
      onClick={() => { if (active) onClick(side) }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: `2px dashed ${over ? 'var(--gold)' : active ? 'var(--green)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: 7, cursor: active ? 'pointer' : 'default',
        minWidth: 42, minHeight: 30, padding: '2px 4px', flexShrink: 0,
        background: over ? 'rgba(212,168,67,0.1)' : 'transparent',
        animation: active ? 'dp 1.1s infinite' : 'none',
        transition: 'all .18s',
      }}
    >
      <span style={{ fontSize: '.55rem', fontFamily: 'var(--mono)', color: 'rgba(255,255,255,0.22)', whiteSpace: 'nowrap' }}>
        {side === 'left' ? '← ' : ''} [{value}] {side === 'right' ? '→' : ''}
      </span>
    </div>
  )
}

// ── MAIN GAME SCREEN ──────────────────────────────────────────────────────────
export default function GameScreen({ room, myId, myHand, onPlayTile, onPass, onLeave }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [pendingEnd, setPendingEnd] = useState(null)
  const [ghostTile, setGhostTile] = useState(null)
  const [ghostPos, setGhostPos] = useState({ x: 0, y: 0 })
  const ghostRef = useRef(null)

  const game = room.game
  const players = room.players
  const myPlayer = players.find(p => p.id === myId)
  const isMyTurn = game.currentPlayerId === myId
  const chain = game.chain || []
  const { L, R } = getChainEnds(chain)
  const handCounts = game.handCounts || {}

  const hasPlayable = myHand.some(t => canPlayTile(t, chain))

  // Seat rotation: me=bottom, +1=left, +2=top(across), +3=right
  const myIdx = players.findIndex(p => p.id === myId)
  const getPlayer = (offset) => players[(myIdx + offset) % players.length] || null
  const leftPlayer = getPlayer(1)
  const topPlayer = getPlayer(2)
  const rightPlayer = getPlayer(3)

  // Ghost drag follow
  useEffect(() => {
    const move = (e) => {
      if (ghostTile) setGhostPos({ x: e.clientX, y: e.clientY })
    }
    document.addEventListener('dragover', move)
    return () => document.removeEventListener('dragover', move)
  }, [ghostTile])

  function handleTileClick(idx) {
    if (!isMyTurn) return
    const tile = myHand[idx]
    if (!canPlayTile(tile, chain)) return

    setSelectedIdx(idx)
    setPendingEnd(null)

    if (!chain.length) {
      onPlayTile(tile, 'left')
      setSelectedIdx(null)
      return
    }

    const fL = tileMatchesEnd(tile, L)
    const fR = tileMatchesEnd(tile, R)
    if (fL && !fR) { onPlayTile(tile, 'left'); setSelectedIdx(null) }
    else if (!fL && fR) { onPlayTile(tile, 'right'); setSelectedIdx(null) }
    // else: needs end selection - show end buttons
  }

  function handleEndChoice(side) {
    if (selectedIdx === null) return
    onPlayTile(myHand[selectedIdx], side)
    setSelectedIdx(null)
    setPendingEnd(null)
  }

  function handleDrop(tile, side) {
    setGhostTile(null)
    onPlayTile(tile, side)
    setSelectedIdx(null)
  }

  function handleDropZoneClick(side) {
    if (selectedIdx !== null) handleEndChoice(side)
  }

  const showEndBtns = isMyTurn && selectedIdx !== null && chain.length > 0
  const canL = isMyTurn && myHand.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, L))
  const canR = isMyTurn && myHand.some(t => canPlayTile(t, chain) && tileMatchesEnd(t, R))

  return (
    <div id="GS" className="game-grid">
      {/* HEADER */}
      <div className="ghdr">
        <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
          <button className="btn bs bsm" onClick={onLeave}>← Leave</button>
          <span className="tag">Cuban · {room.mode === 'teams' ? 'Teams' : 'FFA'}</span>
        </div>
        <div className="sw">
          <div className="sb">
            <div className="st tc1">Team 1</div>
            <div className="sn tc1">{game.scores?.t1 || 0}</div>
          </div>
          <div className="sd">—</div>
          <div className="sb">
            <div className="st tc2">Team 2</div>
            <div className="sn tc2">{game.scores?.t2 || 0}</div>
          </div>
        </div>
        <div className="ti">
          Turn: <span>{players.find(p => p.id === game.currentPlayerId)?.name || '—'}</span>
        </div>
      </div>

      {/* TOP-LEFT CORNER */}
      <div className="tcn" style={{ gridArea: 'tl', borderRight: '1px solid var(--br)' }} />

      {/* TOP PLAYER (across) */}
      <div style={{ gridArea: 'top', background: 'var(--surf)', borderBottom: '1px solid var(--br2)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.2rem', padding: '0 .8rem' }}>
        <Nameplate
          player={topPlayer}
          isActive={topPlayer?.id === game.currentPlayerId}
          handCount={handCounts[topPlayer?.id] || 0}
          orientation="h"
        />
      </div>

      {/* TOP-RIGHT CORNER */}
      <div className="tcn" style={{ gridArea: 'tr', borderLeft: '1px solid var(--br)' }} />

      {/* LEFT PLAYER */}
      <div style={{ gridArea: 'lft', background: 'var(--surf)', borderRight: '1px solid var(--br)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '.4rem .2rem' }}>
        <Nameplate
          player={leftPlayer}
          isActive={leftPlayer?.id === game.currentPlayerId}
          handCount={handCounts[leftPlayer?.id] || 0}
          orientation="v"
        />
      </div>

      {/* TABLE */}
      <div style={{ gridArea: 'tbl', position: 'relative', overflow: 'hidden' }}>
        <FeltCanvas />
        <div style={{ position: 'absolute', inset: 0, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3, maxWidth: 520, padding: '1rem', justifyContent: 'center' }}>
            {!chain.length ? (
              <div style={{ color: 'rgba(255,255,255,0.15)', fontFamily: 'var(--mono)', fontSize: '.72rem' }}>
                {isMyTurn ? 'Play your first tile' : 'Waiting for first tile...'}
              </div>
            ) : (
              <>
                <DropZone side="left" value={L} active={canL} onDrop={handleDrop} onClick={handleDropZoneClick} />
                {chain.map((entry, i) => (
                  <Domino key={i} tile={entry.tile} flipped={entry.flipped} onBoard />
                ))}
                <DropZone side="right" value={R} active={canR} onDrop={handleDrop} onClick={handleDropZoneClick} />
              </>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT PLAYER */}
      <div style={{ gridArea: 'rgt', background: 'var(--surf)', borderLeft: '1px solid var(--br)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '.4rem .2rem' }}>
        <Nameplate
          player={rightPlayer}
          isActive={rightPlayer?.id === game.currentPlayerId}
          handCount={handCounts[rightPlayer?.id] || 0}
          orientation="v"
        />
      </div>

      {/* HAND */}
      <div style={{ gridArea: 'hnd', background: 'var(--surf)', borderTop: '2px solid var(--br2)', display: 'flex', flexDirection: 'column', padding: '.5rem .8rem .4rem', gap: '.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '.45rem' }}>
              <span className="hlbl">{myPlayer?.name}</span>
              <span className={`tag ${myPlayer?.team === 1 ? 'tc1' : 'tc2'}`} style={{ fontSize: '.56rem', padding: '1px 6px' }}>
                T{myPlayer?.team}
              </span>
            </div>
            <div className="hhin">
              {isMyTurn
                ? hasPlayable
                  ? 'Drag to a drop zone · or click tile then pick end'
                  : 'No moves — you must pass'
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
            {isMyTurn && selectedIdx !== null && (
              <button className="btn bp bsm" onClick={() => {
                if (pendingEnd) handleEndChoice(pendingEnd)
              }}>Play →</button>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 5, alignItems: 'flex-end', overflowX: 'auto', paddingBottom: 2, minHeight: 64 }}>
          {myHand.map((tile, idx) => {
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
                onDragStart={playable ? (e) => {
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
        <div style={{
          position: 'fixed',
          left: ghostPos.x,
          top: ghostPos.y,
          transform: 'translate(-50%, -50%) scale(1.07)',
          pointerEvents: 'none',
          zIndex: 9999,
          opacity: .9,
        }}>
          <Domino tile={ghostTile} />
        </div>
      )}
    </div>
  )
}
