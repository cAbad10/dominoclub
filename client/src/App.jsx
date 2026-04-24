import React, { useState, useEffect, useRef } from 'react'
import { useSocket } from './hooks/useSocket'
import HomeScreen from './components/HomeScreen'
import LobbyScreen from './components/LobbyScreen'
import GameScreen from './components/GameScreen'
import { RoundModal, WinModal } from './components/Modals'
import { canPlayTile, getChainEnds } from './game/engine'

// ── DOMINO HELPERS ────────────────────────────────────────────────────────────
const FULL_SET = []
for (let i = 0; i <= 9; i++)
  for (let j = i; j <= 9; j++)
    FULL_SET.push([i, j])

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function dealHands(players, n = 10) {
  const s = shuffle(FULL_SET)
  const hands = {}
  players.forEach((p, i) => { hands[p.id] = s.slice(i * n, (i + 1) * n) })
  return hands
}

function findFirst(hands, players) {
  let best = -1, bp = null
  for (const p of players)
    for (const t of (hands[p.id] || []))
      if (t[0] === t[1] && t[0] > best) { best = t[0]; bp = p.id }
  if (!bp) {
    let mx = -1
    for (const p of players) {
      const s = (hands[p.id] || []).reduce((a, t) => a + t[0] + t[1], 0)
      if (s > mx) { mx = s; bp = p.id }
    }
  }
  return bp
}

function buildEntry(tile, side, chain) {
  if (!chain.length) return { tile, eL: tile[0], eR: tile[1], flipped: false }
  const { L, R } = getChainEnds(chain)
  if (side === 'left') {
    const fl = tile[1] === L
    return { tile, eL: fl ? tile[0] : tile[1], eR: fl ? tile[1] : tile[0], flipped: fl, side: 'left' }
  }
  const fl = tile[0] === R
  return { tile, eL: fl ? tile[1] : tile[0], eR: fl ? tile[0] : tile[1], flipped: fl, side: 'right' }
}

function pipSum(hand) {
  return (hand || []).reduce((s, t) => s + t[0] + t[1], 0)
}

function botPick(hand, chain) {
  const plays = (hand || []).filter(t => canPlayTile(t, chain))
  if (!plays.length) return null
  plays.sort((a, b) => {
    if (a[0] === a[1] && b[0] !== b[1]) return -1
    if (a[0] !== a[1] && b[0] === b[1]) return 1
    return (b[0] + b[1]) - (a[0] + a[1])
  })
  const tile = plays[0]
  if (!chain.length) return { tile, side: 'left' }
  const { L, R } = getChainEnds(chain)
  const fL = tile[0] === L || tile[1] === L
  const fR = tile[0] === R || tile[1] === R
  return { tile, side: fL && !fR ? 'left' : !fL && fR ? 'right' : Math.random() < 0.5 ? 'left' : 'right' }
}

function cloneGame(game) {
  return {
    ...game,
    chain: [...game.chain],
    hands: Object.fromEntries(Object.entries(game.hands).map(([k, v]) => [k, [...v]])),
    handCounts: { ...game.handCounts },
    scores: { ...game.scores },
  }
}

// ── PLAYERS ───────────────────────────────────────────────────────────────────
const DEMO_PLAYERS = [
  { id: 'you', name: 'You', team: 1, ready: true },
  { id: 'bot2', name: 'Carlos', team: 2, ready: true },
  { id: 'bot3', name: 'Ana', team: 1, ready: true },
  { id: 'bot4', name: 'Roberto', team: 2, ready: true },
]

// ── TOAST ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  const t = useRef(null)
  function show(msg, ms = 2600) {
    setToast(msg); clearTimeout(t.current)
    t.current = setTimeout(() => setToast(null), ms)
  }
  return { toast, show }
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { emit, on, connected } = useSocket()
  const { toast, show: showToast } = useToast()

  const [screen, setScreen] = useState('home')
  const [room, setRoom] = useState(null)
  const [myId, setMyId] = useState(null)
  const [myHand, setMyHand] = useState([])
  const [roundResult, setRoundResult] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', mode: 'teams', target: 100 })
  const [joinForm, setJoinForm] = useState({ name: '', code: '' })
  const [demoForm, setDemoForm] = useState({ mode: 'teams', target: 100 })
  const [scoreHistory, setScoreHistory] = useState([])

  // refs so bot callbacks always see latest state without stale closures
  const roomRef = useRef(null)
  const botTimer = useRef(null)
  const demoActive = useRef(false)

  function syncRoom(r) {
    roomRef.current = r
    setRoom(r)
  }

  // ── SOCKET LISTENERS ────────────────────────────────────────────────────────
  useEffect(() => {
    const offs = [
      on('lobby:updated', r => setRoom(p => ({ ...p, ...r }))),
      on('chat:message', msg => setRoom(r => r ? { ...r, chat: [...(r.chat || []), msg] } : r)),
      on('game:started', r => {
        setMyHand(r.game?.hands?.[myId] || [])
        syncRoom(r); setScreen('game')
        setRoundResult(null); setGameResult(null)
      }),
      on('game:stateUpdate', r => {
        setMyHand(r.game?.hands?.[myId] || [])
        syncRoom(r)
      }),
      on('game:roundOver', ({ scores, result, capicu, blocked }) => {
        setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)
        setRoundResult({ scores, result, capicu, blocked })
      }),
      on('game:over', ({ scores, result }) => {
        setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)
        setGameResult({ scores, winTeam: result?.winTeam }); setRoundResult(null)
      }),
      on('game:roundStarted', r => {
        setMyHand(r.game?.hands?.[myId] || [])
        syncRoom(r); setRoundResult(null)
      }),
      on('player:left', ({ playerName, room: r }) => {
        showToast(`${playerName} left`)
        if (r) setRoom(p => ({ ...p, ...r }))
      }),
    ]
    return () => offs.forEach(f => f?.())
  }, [on, myId])

  // ── RESET ────────────────────────────────────────────────────────────────────
  function reset() {
    clearTimeout(botTimer.current)
    demoActive.current = false
    roomRef.current = null
    setScreen('home'); setRoom(null); setMyId(null)
    setMyHand([]); setRoundResult(null); setGameResult(null)
    setIsDemo(false); setScoreHistory([])
  }

  // ── ONLINE ───────────────────────────────────────────────────────────────────
  async function handleCreate({ name, mode, target }) {
    const res = await emit('room:create', { name, mode, target })
    if (!res.ok) return showToast(res.error)
    setMyId(res.room.players[0].id); syncRoom(res.room); setScreen('lobby')
  }

  async function handleJoin({ name, code }) {
    const res = await emit('room:join', { name, code })
    if (!res.ok) return showToast(res.error)
    const me = res.room.players.find(p => p.name === name)
    setMyId(me?.id); syncRoom(res.room); setScreen('lobby')
  }

  async function handleStartGame() {
    const res = await emit('game:start', {})
    if (!res.ok) showToast(res.error)
  }

  // ── DEMO: INIT ───────────────────────────────────────────────────────────────
  function startDemo(settings) {
    clearTimeout(botTimer.current)
    demoActive.current = true
    const cfg = settings || demoForm

    const hands = dealHands(DEMO_PLAYERS, 10)
    const firstId = findFirst(hands, DEMO_PLAYERS)
    const handCounts = {}
    DEMO_PLAYERS.forEach(p => { handCounts[p.id] = hands[p.id].length })

    const initialRoom = {
      code: 'DEMO', mode: cfg.mode, target: cfg.target,
      hostId: 'you', phase: 'playing',
      players: DEMO_PLAYERS, chat: [],
      game: {
        hands, chain: [],
        currentPlayerId: firstId,
        scores: { t1: 0, t2: 0 },
        consecutivePasses: 0,
        handCounts,
        roundNum: 1,
      },
    }

    setIsDemo(true)
    setMyId('you')
    setMyHand([...hands['you']])
    setRoundResult(null)
    setGameResult(null)
    setScoreHistory([])
    syncRoom(initialRoom)
    setScreen('game')

    if (firstId !== 'you') {
      botTimer.current = setTimeout(() => runBots(), 1200)
    }
  }

  // ── DEMO: APPLY MOVE (pure — returns new room or null) ───────────────────────
  function applyMove(currentRoom, pid, tile, side) {
    const game = cloneGame(currentRoom.game)
    const hand = game.hands[pid]
    if (!hand) return null

    const idx = hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1])
    if (idx === -1) return null

    if (!canPlayTile(tile, game.chain)) return null

    const entry = buildEntry(tile, side, game.chain)
    if (side === 'left') game.chain.unshift(entry)
    else game.chain.push(entry)
    hand.splice(idx, 1)
    game.consecutivePasses = 0
    game.handCounts[pid] = hand.length

    return { ...currentRoom, game }
  }

  function applyPass(currentRoom, pid) {
    const game = cloneGame(currentRoom.game)
    game.consecutivePasses = (game.consecutivePasses || 0) + 1
    return { ...currentRoom, game }
  }

  function advanceTurn(currentRoom) {
    const game = cloneGame(currentRoom.game)
    const players = currentRoom.players
    const idx = players.findIndex(p => p.id === game.currentPlayerId)
    game.currentPlayerId = players[(idx + 1) % players.length].id
    return { ...currentRoom, game }
  }

  // ── DEMO: HUMAN PLAYS ────────────────────────────────────────────────────────
  function handlePlayTile(tile, side) {
    if (!isDemo) {
      emit('game:playTile', { tile, side }).then(r => { if (!r?.ok) showToast(r?.error) })
      return
    }

    const current = roomRef.current
    if (!current) return

    const after = applyMove(current, 'you', tile, side)
    if (!after) { showToast("Can't play that tile"); return }

    setMyHand([...after.game.hands['you']])

    if (after.game.hands['you'].length === 0) {
      syncRoom(after)
      setTimeout(() => endRound(after, 'you', false), 100)
      return
    }

    const next = advanceTurn(after)
    syncRoom(next)

    if (next.game.currentPlayerId !== 'you') {
      clearTimeout(botTimer.current)
      botTimer.current = setTimeout(() => runBots(), 850)
    }
  }

  function handlePass() {
    if (!isDemo) {
      emit('game:pass', {}).then(r => { if (!r?.ok) showToast(r?.error) })
      return
    }

    const current = roomRef.current
    if (!current) return

    const after = applyPass(current, 'you')

    if (after.game.consecutivePasses >= after.players.length) {
      syncRoom(after)
      setTimeout(() => endRound(after, null, false), 100)
      return
    }

    const next = advanceTurn(after)
    syncRoom(next)

    if (next.game.currentPlayerId !== 'you') {
      clearTimeout(botTimer.current)
      botTimer.current = setTimeout(() => runBots(), 850)
    }
  }

  // ── DEMO: BOTS ────────────────────────────────────────────────────────────────
  function runBots() {
    if (!demoActive.current) return
    const current = roomRef.current
    if (!current?.game) return
    if (current.game.currentPlayerId === 'you') return

    const curId = current.game.currentPlayerId
    const hand = current.game.hands[curId] || []
    const move = botPick(hand, current.game.chain)

    let next

    if (!move) {
      // bot passes
      const after = applyPass(current, curId)
      if (after.game.consecutivePasses >= after.players.length) {
        syncRoom(after)
        setTimeout(() => endRound(after, null, false), 100)
        return
      }
      next = advanceTurn(after)
    } else {
      const after = applyMove(current, curId, move.tile, move.side)
      if (!after) { next = advanceTurn(current) }
      else if (after.game.hands[curId].length === 0) {
        syncRoom(after)
        setTimeout(() => endRound(after, curId, false), 100)
        return
      } else {
        next = advanceTurn(after)
      }
    }

    syncRoom(next)

    if (next.game.currentPlayerId === 'you') return

    clearTimeout(botTimer.current)
    botTimer.current = setTimeout(() => runBots(), 650 + Math.random() * 500)
  }

  // ── DEMO: SCORING ────────────────────────────────────────────────────────────
  function endRound(currentRoom, winnerId, cap) {
    clearTimeout(botTimer.current)
    const { game, players, target } = currentRoom
    let winTeam = null, points = 0

    if (winnerId) {
      const w = players.find(p => p.id === winnerId)
      winTeam = w?.team
      const opp = players.filter(p => p.id !== winnerId).reduce((s, p) => s + pipSum(game.hands[p.id]), 0)
      points = Math.ceil(opp / 5) * 5
      if (cap) points += 10
    } else {
      const tp = { 1: 0, 2: 0 }
      players.forEach(p => { tp[p.team] = (tp[p.team] || 0) + pipSum(game.hands[p.id]) })
      if (tp[1] < tp[2]) { winTeam = 1; points = Math.ceil((tp[2] - tp[1]) / 5) * 5 }
      else if (tp[2] < tp[1]) { winTeam = 2; points = Math.ceil((tp[1] - tp[2]) / 5) * 5 }
    }

    const scores = { ...game.scores }
    if (winTeam === 1) scores.t1 += points
    else if (winTeam === 2) scores.t2 += points

    setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)

    // Record this round in history
    const roundNum = currentRoom.game.roundNum || 1
    setScoreHistory(h => [...h, {
      round: roundNum,
      t1: scores.t1,
      t2: scores.t2,
      winTeam,
      points,
      capicu: cap,
      blocked: !winnerId,
    }])

    if (scores.t1 >= target || scores.t2 >= target) {
      setGameResult({ scores, winTeam: scores.t1 >= target ? 1 : 2 })
    } else {
      setRoundResult({ scores, result: { winTeam, points }, capicu: cap, blocked: !winnerId })
    }
  }

  function handleNextRound() {
    if (!isDemo) { emit('game:nextRound', {}).then(r => { if (!r?.ok) showToast(r?.error) }); return }

    clearTimeout(botTimer.current)
    setRoundResult(null)

    const prev = roomRef.current
    if (!prev) return

    const hands = dealHands(DEMO_PLAYERS, 10)
    const firstId = findFirst(hands, DEMO_PLAYERS)
    const handCounts = {}
    DEMO_PLAYERS.forEach(p => { handCounts[p.id] = hands[p.id].length })

    const newRoom = {
      ...prev,
      game: {
        hands, chain: [],
        currentPlayerId: firstId,
        scores: prev.game.scores,
        consecutivePasses: 0,
        handCounts,
        roundNum: (prev.game.roundNum || 1) + 1,
      },
    }

    setMyHand([...hands['you']])
    syncRoom(newRoom)

    if (firstId !== 'you') {
      botTimer.current = setTimeout(() => runBots(), 1200)
    }
  }

  // ── RENDER ────────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {!connected && !isDemo && (
        <div style={{
          position: 'fixed', top: '.5rem', right: '.5rem', zIndex: 300,
          background: '#e05252', color: '#fff', borderRadius: 6,
          padding: '3px 10px', fontSize: '.65rem', fontFamily: 'monospace',
        }}>Connecting...</div>
      )}

      {toast && <div className="ntf show">{toast}</div>}

      {screen === 'home' && (
        <HomeScreen
          onCreate={() => setScreen('create')}
          onJoin={() => setScreen('join')}
          onDemo={() => setScreen('demoSetup')}
        />
      )}

      {screen === 'demoSetup' && (
        <div className="screen">
          <button className="bk" onClick={() => setScreen('home')}>← Back</button>
          <div className="fp">
            <div className="ftt">Play vs Bots</div>
            <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem', background: 'var(--surf2)', borderRadius: 10, padding: 4 }}>
              <div style={{ flex: 1, textAlign: 'center', padding: '.6rem', background: 'var(--surf3)', borderRadius: 8, fontSize: '.8rem' }}>
                <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', marginBottom: 2 }}>You + Ana</div>
                <div style={{ color: 'var(--t1)', fontWeight: 700, fontSize: '.8rem' }}>Team 1</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', color: 'var(--tx3)', fontSize: '.8rem' }}>vs</div>
              <div style={{ flex: 1, textAlign: 'center', padding: '.6rem', background: 'var(--surf3)', borderRadius: 8, fontSize: '.8rem' }}>
                <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', marginBottom: 2 }}>Carlos + Roberto</div>
                <div style={{ color: 'var(--t2)', fontWeight: 700, fontSize: '.8rem' }}>Team 2</div>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Game Mode</label>
              <div className="pills">
                <button className={'pill ' + (demoForm.mode === 'teams' ? 'on' : '')} onClick={() => setDemoForm(f => ({ ...f, mode: 'teams' }))}>Teams 2v2</button>
                <button className={'pill ' + (demoForm.mode === 'ffa' ? 'on' : '')} onClick={() => setDemoForm(f => ({ ...f, mode: 'ffa' }))}>Free-for-All</button>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Points to Win</label>
              <select className="fi" value={demoForm.target} onChange={e => setDemoForm(f => ({ ...f, target: parseInt(e.target.value) }))}>
                <option value={50}>50 pts (Quick)</option>
                <option value={100}>100 pts (Standard)</option>
                <option value={150}>150 pts</option>
                <option value={200}>200 pts</option>
              </select>
            </div>
            <button className="btn bp" onClick={() => startDemo(demoForm)}>Start Game →</button>
          </div>
        </div>
      )}

      {screen === 'create' && (
        <div className="screen">
          <button className="bk" onClick={() => setScreen('home')}>← Back</button>
          <div className="fp">
            <div className="ftt">Create Room</div>
            <div className="fg">
              <label className="fl">Your Name</label>
              <input className="fi" placeholder="e.g. Miguel" maxLength={16}
                value={createForm.name} onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Game Mode</label>
              <div className="pills">
                <button className={`pill ${createForm.mode === 'teams' ? 'on' : ''}`} onClick={() => setCreateForm(f => ({ ...f, mode: 'teams' }))}>Teams 2v2</button>
                <button className={`pill ${createForm.mode === 'ffa' ? 'on' : ''}`} onClick={() => setCreateForm(f => ({ ...f, mode: 'ffa' }))}>Free-for-All</button>
              </div>
            </div>
            <div className="fg">
              <label className="fl">Points to Win</label>
              <select className="fi" value={createForm.target} onChange={e => setCreateForm(f => ({ ...f, target: parseInt(e.target.value) }))}>
                <option value={100}>100 pts (Standard)</option>
                <option value={150}>150 pts</option>
                <option value={200}>200 pts</option>
                <option value={50}>50 pts (Quick)</option>
              </select>
            </div>
            <button className="btn bp" onClick={() => createForm.name && handleCreate(createForm)}>Create Room →</button>
          </div>
        </div>
      )}

      {screen === 'join' && (
        <div className="screen">
          <button className="bk" onClick={() => setScreen('home')}>← Back</button>
          <div className="fp">
            <div className="ftt">Join Room</div>
            <div className="fg">
              <label className="fl">Your Name</label>
              <input className="fi" placeholder="e.g. Carlos" maxLength={16}
                value={joinForm.name} onChange={e => setJoinForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="fg">
              <label className="fl">Room Code</label>
              <input className="fi" placeholder="ABCD" maxLength={4}
                style={{ textTransform: 'uppercase', fontFamily: 'var(--mono)', letterSpacing: '.2em', fontSize: '1.1rem' }}
                value={joinForm.code} onChange={e => setJoinForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <button className="btn bp" onClick={() => joinForm.name && joinForm.code && handleJoin(joinForm)}>Join Room →</button>
          </div>
        </div>
      )}

      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room} myId={myId}
          onReady={r => emit('lobby:ready', { ready: r })}
          onSetTeam={t => emit('lobby:setTeam', { team: t })}
          onStartGame={handleStartGame}
          onChat={m => emit('lobby:chat', { message: m })}
          onLeave={reset}
        />
      )}

      {screen === 'game' && room && (
        <>
          <GameScreen
            room={room} myId={myId} myHand={myHand}
            onPlayTile={handlePlayTile}
            onPass={handlePass}
            onLeave={() => { if (!isDemo) emit('room:leave', {}); reset() }}
            scoreHistory={scoreHistory}
          />
          {roundResult && (
            <RoundModal
              scores={roundResult.scores} result={roundResult.result}
              capicu={roundResult.capicu} blocked={roundResult.blocked}
              isHost={room.hostId === myId || isDemo}
              onNextRound={handleNextRound}
              players={room.players}
              hands={room.game?.hands}
              scoreHistory={scoreHistory}
              target={room.target}
            />
          )}
          {gameResult && (
            <WinModal
              scores={gameResult.scores} winTeam={gameResult.winTeam}
              onPlayAgain={isDemo ? () => startDemo(demoForm) : () => emit('game:start', {})}
              onHome={reset}
              players={room.players}
              hands={room.game?.hands}
              scoreHistory={scoreHistory}
              target={room.target}
            />
          )}
        </>
      )}
    </div>
  )
}
