import React, { useEffect, useRef, useState } from 'react'
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
      for (let x = 0; x < W; x += 32) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke() }
      for (let y = 0; y < H; y += 32) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke() }
      ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 2
      ctx.beginPath(); ctx.ellipse(W/2, H/2, W*.38, H*.4, 0, 0, Math.PI*2); ctx.stroke()
      ;[[18,18],[W-18,18],[18,H-18],[W-18,H-18]].forEach(([cx,cy]) => {
        ctx.strokeStyle='rgba(255,255,255,0.07)'; ctx.lineWidth=1.5
        ctx.beginPath(); ctx.arc(cx,cy,9,0,Math.PI*2); ctx.stroke()
        ctx.beginPath(); ctx.arc(cx,cy,3,0,Math.PI*2); ctx.stroke()
      })
    }
    draw()
    const ro = new ResizeObserver(draw)
    if (ref.current?.parentElement) ro.observe(ref.current.parentElement)
    return () => ro.disconnect()
  }, [])
  return <canvas ref={ref} style={{ position:'absolute', inset:0, width:'100%', height:'100%' }} />
}

// ── NAMEPLATE (compact horizontal) ───────────────────────────────────────────
function OppCard({ player, isActive, handCount }) {
  if (!player) return null
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const count = handCount || 0
  const danger = count === 1
  const show = Math.min(count, 8)
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, minWidth:50 }}>
      <div style={{ display:'flex', alignItems:'center', gap:4 }}>
        <div style={{ width:6, height:6, borderRadius:'50%', background: isActive?'var(--green)':'var(--surf3)', boxShadow: isActive?'0 0 5px var(--green)':'none', flexShrink:0 }} />
        <div style={{ fontSize:'.62rem', fontWeight:700, fontFamily:'var(--mono)', color:tc, whiteSpace:'nowrap' }}>{player.name}</div>
        <div style={{ fontSize:'.52rem', color:'var(--tx3)', fontFamily:'var(--mono)' }}>({count})</div>
      </div>
      <div style={{ display:'flex', gap:2, flexWrap:'wrap', justifyContent:'center' }}>
        {Array.from({length:show}).map((_,i)=>(
          <div key={i} style={{ width:16, height:10, borderRadius:2, background:danger?'#5a1a1a':'var(--surf3)', border:`1px solid ${danger?'var(--red)':'var(--br2)'}` }} />
        ))}
        {count>show && <div style={{ fontSize:'.48rem', color:'var(--tx3)', fontFamily:'var(--mono)' }}>+{count-show}</div>}
      </div>
    </div>
  )
}

// ── NAMEPLATE (vertical for side panels) ─────────────────────────────────────
function SideCard({ player, isActive, handCount }) {
  if (!player) return <div style={{ fontSize:'.5rem', color:'var(--tx3)', fontFamily:'var(--mono)' }}>—</div>
  const tc = player.team===1?'var(--t1)':'var(--t2)'
  const count = handCount||0
  const danger = count===1
  const show = Math.min(count, 6)
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3 }}>
      <div style={{ width:7, height:7, borderRadius:'50%', background:isActive?'var(--green)':'var(--surf3)', boxShadow:isActive?'0 0 6px var(--green)':'none' }} />
      <div style={{ fontSize:'.6rem', fontWeight:700, fontFamily:'var(--mono)', color:tc, writing:'vertical-lr', textAlign:'center', maxWidth:56, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{player.name}</div>
      <div style={{ fontSize:'.5rem', color:'var(--tx3)', fontFamily:'var(--mono)' }}>T{player.team}·{count}</div>
      <div style={{ display:'flex', flexDirection:'column', gap:2, alignItems:'center' }}>
        {Array.from({length:show}).map((_,i)=>(
          <div key={i} style={{ width:9, height:14, borderRadius:2, background:danger?'#5a1a1a':'var(--surf3)', border:`1px solid ${danger?'var(--red)':'var(--br2)'}` }} />
        ))}
        {count>show && <div style={{ fontSize:'.45rem', color:'var(--tx3)', fontFamily:'var(--mono)' }}>+{count-show}</div>}
      </div>
    </div>
  )
}

// ── FIRST TILE DROP ZONE ──────────────────────────────────────────────────────
function FirstTileZone({ active, onDrop, onClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();if(active)setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{
        e.preventDefault();setOver(false);if(!active)return
        try{const d=JSON.parse(e.dataTransfer.getData('text/plain'));if(d?.tile)onDrop(d.tile,'left')}catch(_){}
      }}
      onClick={()=>{if(active)onClick()}}
      style={{
        width:80, height:120,
        border:`2px dashed ${over?'var(--gold)':active?'var(--green)':'rgba(255,255,255,0.1)'}`,
        borderRadius:12,
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:8,
        cursor:active?'pointer':'default',
        background:over?'rgba(212,168,67,0.1)':active?'rgba(76,175,125,0.06)':'transparent',
        animation:active&&!over?'dp 1.2s infinite':'none',
        transition:'all .15s',
      }}
    >
      <div style={{ fontSize:'1.4rem', opacity:active?.7:.2 }}>🁣</div>
      <div style={{ fontSize:'.6rem', fontFamily:'var(--mono)', color:active?'var(--green)':'rgba(255,255,255,.18)', textAlign:'center', lineHeight:1.5 }}>
        {active?'Drop first\ntile here':'Waiting...'}
      </div>
    </div>
  )
}

// ── END DROP ZONE ─────────────────────────────────────────────────────────────
function EndZone({ side, value, active, onDrop, onClick }) {
  const [over, setOver] = useState(false)
  return (
    <div
      onDragOver={e=>{e.preventDefault();if(active)setOver(true)}}
      onDragLeave={()=>setOver(false)}
      onDrop={e=>{
        e.preventDefault();setOver(false);if(!active)return
        try{const d=JSON.parse(e.dataTransfer.getData('text/plain'));if(d?.tile)onDrop(d.tile,side)}catch(_){}
      }}
      onClick={()=>{if(active)onClick(side)}}
      style={{
        display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
        border:`2px dashed ${over?'var(--gold)':active?'var(--green)':'rgba(255,255,255,0.1)'}`,
        borderRadius:8, width:38, minHeight:62, padding:'4px 2px',
        background:over?'rgba(212,168,67,0.1)':active?'rgba(76,175,125,0.05)':'transparent',
        animation:active&&!over?'dp 1.2s infinite':'none',
        transition:'all .15s', cursor:active?'pointer':'default',
        flexShrink:0, gap:2,
      }}
    >
      <div style={{ fontSize:'.55rem', color:over?'var(--gold)':active?'var(--green)':'rgba(255,255,255,.2)', fontFamily:'var(--mono)' }}>
        {side==='left'?'←':'→'}
      </div>
      <div style={{ fontSize:'.65rem', fontWeight:700, color:over?'var(--gold)':'rgba(255,255,255,.3)', fontFamily:'var(--mono)' }}>
        {value??'?'}
      </div>
    </div>
  )
}

// ── CUBAN CHAIN ───────────────────────────────────────────────────────────────
// Regular tiles: vertical (narrow). Doubles: horizontal (perpendicular to chain).
// Snakes right → down → left → down → right...
function CubanChain({ chain }) {
  if (!chain.length) return null

  // Tile dimensions
  const TW = 34, TH = 66   // vertical tile
  const DW = 66, DH = 34   // horizontal double
  const GAP = 4
  const MAX_ROW = 7

  const items = []
  let cx = 0, cy = 0, dir = 1, rowCount = 0

  chain.forEach((entry, i) => {
    const isDbl = entry.tile[0] === entry.tile[1]
    const w = isDbl ? DW : TW
    const h = isDbl ? DH : TH
    const yOff = isDbl ? (TH - DH) / 2 : 0
    items.push({ entry, x: cx, y: cy + yOff, w, h, isDbl })
    rowCount++
    if (rowCount >= MAX_ROW && i < chain.length - 1) {
      cy += TH + GAP * 2; dir *= -1; rowCount = 0
    } else {
      cx += dir * (w + GAP)
    }
  })

  const minX = Math.min(...items.map(it => it.x))
  items.forEach(it => { it.x -= minX })
  const totalW = Math.max(...items.map(it => it.x + it.w))
  const totalH = Math.max(...items.map(it => it.y + it.h))

  return (
    <div style={{ position:'relative', width:totalW, height:totalH, flexShrink:0 }}>
      {items.map(({ entry, x, y, isDbl }, i) => (
        <div key={i} style={{ position:'absolute', left:x, top:y }}>
          <Domino tile={entry.tile} flipped={entry.flipped||false} horizontal={isDbl} onBoard />
        </div>
      ))}
    </div>
  )
}

// ── GAME SCREEN ───────────────────────────────────────────────────────────────
export default function GameScreen({ room, myId, myHand, onPlayTile, onPass, onLeave, scoreHistory }) {
  const [selectedIdx, setSelectedIdx] = useState(null)
  const [ghostTile, setGhostTile] = useState(null)
  const [ghostPos, setGhostPos] = useState({ x:0, y:0 })
  const [showHistory, setShowHistory] = useState(false)

  if (!room?.game || !room?.players || !myId) {
    return (
      <div style={{ position:'fixed', inset:0, display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }}>
        <div style={{ color:'var(--tx2)', fontFamily:'var(--mono)', fontSize:'.85rem' }}>Loading...</div>
      </div>
    )
  }

  const game = room.game
  const players = room.players || []
  const chain = game.chain || []
  const scores = game.scores || { t1:0, t2:0 }
  const handCounts = game.handCounts || {}
  const myHandSafe = Array.isArray(myHand) ? myHand : []
  const myPlayer = players.find(p => p.id === myId)
  const isMyTurn = game.currentPlayerId === myId
  const { L, R } = getChainEnds(chain)
  const hasPlayable = myHandSafe.some(t => canPlayTile(t, chain))
  const isFirst = chain.length === 0

  // Seat rotation: me=bottom, +1=left, +2=top, +3=right
  const myIdx = players.findIndex(p => p.id === myId)
  const getP = off => players.length > 0 ? players[(myIdx+off)%players.length]||null : null
  const leftP=getP(1), topP=getP(2), rightP=getP(3)

  const canL = !isFirst && isMyTurn && myHandSafe.some(t=>canPlayTile(t,chain)&&tileMatchesEnd(t,L))
  const canR = !isFirst && isMyTurn && myHandSafe.some(t=>canPlayTile(t,chain)&&tileMatchesEnd(t,R))
  const showEndBtns = isMyTurn && selectedIdx!==null && !isFirst
  const curName = players.find(p=>p.id===game.currentPlayerId)?.name||'—'
  const lastRound = scoreHistory?.length ? scoreHistory[scoreHistory.length-1] : null

  useEffect(()=>{
    const move = e=>{if(ghostTile) setGhostPos({x:e.clientX,y:e.clientY})}
    document.addEventListener('dragover',move)
    return()=>document.removeEventListener('dragover',move)
  },[ghostTile])

  function handleTileClick(idx) {
    if(!isMyTurn) return
    const tile = myHandSafe[idx]; if(!tile) return
    if(isFirst) { onPlayTile(tile,'left'); setSelectedIdx(null); return }
    if(!canPlayTile(tile,chain)) return
    setSelectedIdx(idx)
    const fL=tileMatchesEnd(tile,L), fR=tileMatchesEnd(tile,R)
    if(fL&&!fR){onPlayTile(tile,'left');setSelectedIdx(null)}
    else if(!fL&&fR){onPlayTile(tile,'right');setSelectedIdx(null)}
  }

  function handleEndChoice(side) {
    if(selectedIdx===null||!myHandSafe[selectedIdx]) return
    onPlayTile(myHandSafe[selectedIdx],side); setSelectedIdx(null)
  }

  function handleDrop(tile,side) { setGhostTile(null); onPlayTile(tile,side); setSelectedIdx(null) }

  function startDrag(tile,idx,e) {
    e.dataTransfer.setData('text/plain',JSON.stringify({tile,idx}))
    e.dataTransfer.effectAllowed='move'
    const b=document.createElement('canvas');b.width=1;b.height=1
    e.dataTransfer.setDragImage(b,0,0)
    setGhostTile(tile); setGhostPos({x:e.clientX,y:e.clientY})
  }

  const hint = isMyTurn
    ? isFirst ? 'Drag or tap a tile to play first' : hasPlayable ? 'Drag to ← or → · or tap tile' : ''
    : `${curName}'s turn`

  const isNeedPass = isMyTurn && !hasPlayable && !isFirst

  return (
    <div className="game-wrap">

      {/* ── HEADER ── */}
      <div className="g-hdr">
        {/* Left */}
        <div className="g-hdr-left">
          <button className="btn bs bsm" onClick={onLeave} style={{padding:'.25rem .55rem',fontSize:'.7rem'}}>←</button>
        </div>

        {/* Center scores */}
        <div className="g-hdr-center">
          <div className="g-score-row">
            <div className="g-team">
              <div className="g-team-label tc1">Team 1</div>
              <div className="g-team-score tc1">{scores.t1}</div>
            </div>
            <div className="g-divider">—</div>
            <div className="g-team">
              <div className="g-team-label tc2">Team 2</div>
              <div className="g-team-score tc2">{scores.t2}</div>
            </div>
          </div>
          <div className="g-rnd">
            {lastRound
              ? <>Rnd {lastRound.round}: <em>+{lastRound.points}pts</em> T{lastRound.winTeam}{lastRound.capicu?' ⚡':''} · {game.roundNum||1} now</>
              : <>Rnd {game.roundNum||1} · First to {room.target||100}</>
            }
          </div>
        </div>

        {/* Right */}
        <div className="g-hdr-right">
          <div className="g-turn">Turn: <strong>{curName}</strong></div>
          {scoreHistory?.length > 0 && (
            <button
              onClick={()=>setShowHistory(h=>!h)}
              style={{background:showHistory?'var(--surf3)':'none',border:'1px solid var(--br)',borderRadius:5,padding:'1px 5px',cursor:'pointer',fontSize:'.52rem',fontFamily:'var(--mono)',color:'var(--tx2)'}}
            >
              {showHistory?'✕':'log'}
            </button>
          )}
        </div>
      </div>

      {/* ── HISTORY DROPDOWN ── */}
      {showHistory && scoreHistory?.length > 0 && (
        <div style={{position:'absolute',top:52,right:0,zIndex:50,background:'var(--surf)',border:'1px solid var(--br2)',borderRadius:'0 0 0 10px',minWidth:220,boxShadow:'0 4px 20px rgba(0,0,0,.5)'}}>
          <div style={{padding:'.35rem .6rem',borderBottom:'1px solid var(--br)'}}>
            <div style={{display:'grid',gridTemplateColumns:'26px 1fr 1fr 52px',fontSize:'.56rem',fontFamily:'var(--mono)',color:'var(--tx3)',textTransform:'uppercase'}}>
              <span>#</span><span style={{color:'var(--t1)'}}>T1</span><span style={{color:'var(--t2)'}}>T2</span><span>+pts</span>
            </div>
          </div>
          {scoreHistory.map((r,i)=>(
            <div key={i} style={{display:'grid',gridTemplateColumns:'26px 1fr 1fr 52px',padding:'.26rem .6rem',fontSize:'.68rem',fontFamily:'var(--mono)',borderBottom:i<scoreHistory.length-1?'1px solid var(--br)':'none',background:i===scoreHistory.length-1?'rgba(255,255,255,.03)':'transparent'}}>
              <span style={{color:'var(--tx3)'}}>{r.round}</span>
              <span style={{color:r.winTeam===1?'var(--t1)':'var(--tx2)',fontWeight:r.winTeam===1?700:400}}>{r.t1}</span>
              <span style={{color:r.winTeam===2?'var(--t2)':'var(--tx2)',fontWeight:r.winTeam===2?700:400}}>{r.t2}</span>
              <span style={{color:'var(--tx3)',fontSize:'.56rem'}}>{r.winTeam?`+${r.points}${r.capicu?'⚡':''}`:r.blocked?'blk':'—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── OPPONENTS TOP STRIP ── */}
      <div className="g-opps">
        {/* On mobile show all 3 opponents here */}
        {leftP && <OppCard player={leftP} isActive={leftP.id===game.currentPlayerId} handCount={handCounts[leftP.id]??0} />}
        <OppCard player={topP} isActive={topP?.id===game.currentPlayerId} handCount={handCounts[topP?.id]??0} />
        {rightP && <OppCard player={rightP} isActive={rightP.id===game.currentPlayerId} handCount={handCounts[rightP.id]??0} />}
      </div>

      {/* ── MIDDLE ROW ── */}
      <div className="g-mid">

        {/* Left side panel — desktop only */}
        <div className="g-side g-side-l">
          <SideCard player={leftP} isActive={leftP?.id===game.currentPlayerId} handCount={handCounts[leftP?.id]??0} />
        </div>

        {/* Felt Table */}
        <div className="g-table">
          <FeltCanvas />
          <div style={{position:'absolute',inset:0,overflow:'auto',display:'flex',alignItems:'center',justifyContent:'center',padding:'1rem'}}>
            {isFirst ? (
              <FirstTileZone
                active={isMyTurn}
                onDrop={(tile)=>handleDrop(tile,'left')}
                onClick={()=>{if(selectedIdx!==null&&myHandSafe[selectedIdx]){onPlayTile(myHandSafe[selectedIdx],'left');setSelectedIdx(null)}}}
              />
            ) : (
              <div style={{display:'flex',alignItems:'center',gap:4}}>
                <EndZone side="left" value={L} active={canL} onDrop={handleDrop} onClick={handleEndChoice} />
                <CubanChain chain={chain} />
                <EndZone side="right" value={R} active={canR} onDrop={handleDrop} onClick={handleEndChoice} />
              </div>
            )}
          </div>
        </div>

        {/* Right side panel — desktop only */}
        <div className="g-side g-side-r">
          <SideCard player={rightP} isActive={rightP?.id===game.currentPlayerId} handCount={handCounts[rightP?.id]??0} />
        </div>
      </div>

      {/* ── HAND TRAY ── */}
      <div className="g-hand">

        {/* Top info bar */}
        <div className="g-hand-bar">
          <div className="g-hand-info">
            <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
              <span className="hlbl">{myPlayer?.name||'Your Hand'}</span>
              <span className={`tag ${myPlayer?.team===1?'tc1':'tc2'}`} style={{fontSize:'.54rem',padding:'1px 5px'}}>
                T{myPlayer?.team||1}
              </span>
              <span style={{fontSize:'.58rem',fontFamily:'var(--mono)',color:'var(--tx3)'}}>({myHandSafe.length})</span>
            </div>
            <div className="hhin">{hint}</div>
          </div>

          {/* End choice buttons — only show when tile is selected and needs end pick */}
          {showEndBtns && (
            <div style={{display:'flex',gap:'.35rem',alignItems:'center'}}>
              <button className="btn bs bsm" onClick={()=>handleEndChoice('left')}>← Left</button>
              <button className="btn bs bsm" onClick={()=>handleEndChoice('right')}>Right →</button>
            </div>
          )}
        </div>

        {/* PASS BUTTON — centered, full width feel */}
        {isNeedPass && (
          <div className="g-pass-center">
            <button
              className="btn bs"
              onClick={onPass}
              style={{maxWidth:200,fontSize:'.85rem',padding:'.45rem 2rem',borderColor:'var(--gold)',color:'var(--gold)'}}
            >
              Pass Turn
            </button>
          </div>
        )}

        {/* Tile rack */}
        <div className="g-tiles">
          {myHandSafe.map((tile,idx)=>{
            if(!tile||!Array.isArray(tile)) return null
            const playable = isMyTurn&&(isFirst||canPlayTile(tile,chain))
            const sel = selectedIdx===idx
            return (
              <Domino
                key={`${tile[0]}-${tile[1]}-${idx}`}
                tile={tile}
                selected={sel}
                playable={playable&&!sel}
                disabled={!isMyTurn||(!isFirst&&!canPlayTile(tile,chain))}
                onClick={()=>handleTileClick(idx)}
                onDragStart={playable?e=>startDrag(tile,idx,e):null}
                onDragEnd={()=>setGhostTile(null)}
              />
            )
          })}
        </div>
      </div>

      {/* Drag ghost */}
      {ghostTile && (
        <div style={{position:'fixed',left:ghostPos.x,top:ghostPos.y,transform:'translate(-50%,-50%) scale(1.1)',pointerEvents:'none',zIndex:9999,opacity:.88}}>
          <Domino tile={ghostTile} />
        </div>
      )}
    </div>
  )
}
