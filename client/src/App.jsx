import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSocket } from './hooks/useSocket'
import HomeScreen from './components/HomeScreen'
import LobbyScreen from './components/LobbyScreen'
import GameScreen from './components/GameScreen'
import { RoundModal, WinModal } from './components/Modals'
import { canPlayTile, getChainEnds } from './game/engine'

// ── BOT LOGIC (for demo mode) ─────────────────────────────────────────────────
function botChooseMove(hand, chain) {
  const plays = hand.filter(t => canPlayTile(t, chain))
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
  const side = fL && !fR ? 'left' : !fL && fR ? 'right' : Math.random() < .5 ? 'left' : 'right'
  return { tile, side }
}

// ── DEMO MODE (local bots, no server) ────────────────────────────────────────
function useDemoGame() {
  const FULL = []
  for (let i = 0; i <= 9; i++) for (let j = i; j <= 9; j++) FULL.push([i, j])

  function shuf(a) {
    const b = [...a]
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[b[i], b[j]] = [b[j], b[i]] }
    return b
  }

  function buildGame(players) {
    const s = shuf(FULL), hands = {}
    players.forEach((p, i) => { hands[p.id] = s.slice(i * 10, (i + 1) * 10) })
    let first = null, best = -1
    for (const [pid, h] of Object.entries(hands))
      for (const t of h) if (t[0] === t[1] && t[0] > best) { best = t[0]; first = pid }
    if (!first) { let mx = -1; for (const [pid, h] of Object.entries(hands)) { const s = h.reduce((a, t) => a + t[0] + t[1], 0); if (s > mx) { mx = s; first = pid } } }

    const handCounts = {}
    players.forEach(p => { handCounts[p.id] = hands[p.id].length })

    return {
      hands,
      chain: [],
      currentPlayerId: first,
      scores: { t1: 0, t2: 0 },
      consecutivePasses: 0,
      handCounts,
    }
  }

  return { buildGame }
}

// ── TOAST NOTIFICATION ────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState(null)
  const timerRef = useRef(null)

  function show(msg, ms = 2600) {
    setToast(msg)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setToast(null), ms)
  }

  return { toast, show }
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const { emit, on, off, connected } = useSocket()
  const { toast, show: showToast } = useToast()
  const { buildGame } = useDemoGame()

  const [screen, setScreen] = useState('home') // home | create | join | lobby | game
  const [room, setRoom] = useState(null)
  const [myId, setMyId] = useState(null)
  const [myHand, setMyHand] = useState([])
  const [roundResult, setRoundResult] = useState(null)
  const [gameResult, setGameResult] = useState(null)
  const [isDemo, setIsDemo] = useState(false)
  const botTimerRef = useRef(null)

  // ── SOCKET LISTENERS ────────────────────────────────────────────────────────
  useEffect(() => {
    const cleanups = [
      on('lobby:updated', (updatedRoom) => {
        setRoom(r => ({ ...r, ...updatedRoom }))
      }),
      on('chat:message', (msg) => {
        setRoom(r => r ? { ...r, chat: [...(r.chat || []), msg] } : r)
      }),
      on('game:started', (updatedRoom) => {
        const hand = updatedRoom.game?.hands?.[myId] || []
        setMyHand(hand)
        setRoom(updatedRoom)
        setScreen('game')
        setRoundResult(null)
        setGameResult(null)
      }),
      on('game:stateUpdate', (updatedRoom) => {
        const hand = updatedRoom.game?.hands?.[myId] || myHand
        setMyHand(hand)
        setRoom(updatedRoom)
      }),
      on('game:roundOver', ({ scores, result, capicu, blocked }) => {
        setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)
        setRoundResult({ scores, result, capicu, blocked })
      }),
      on('game:over', ({ scores, result, capicu }) => {
        setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)
        setGameResult({ scores, winTeam: result?.winTeam })
        setRoundResult(null)
      }),
      on('game:roundStarted', (updatedRoom) => {
        const hand = updatedRoom.game?.hands?.[myId] || []
        setMyHand(hand)
        setRoom(updatedRoom)
        setRoundResult(null)
      }),
      on('player:left', ({ playerName, room: updatedRoom }) => {
        showToast(`${playerName} left the game`)
        if (updatedRoom) setRoom(r => ({ ...r, ...updatedRoom }))
      }),
    ]
    return () => cleanups.forEach(fn => fn?.())
  }, [on, myId])

  // ── CREATE ROOM ─────────────────────────────────────────────────────────────
  async function handleCreate({ name, mode, target }) {
    const res = await emit('room:create', { name, mode, target })
    if (!res.ok) return showToast(res.error)
    setMyId(res.room.players[0].id)  // socket id comes back embedded
    setRoom(res.room)
    setScreen('lobby')
  }

  // ── JOIN ROOM ───────────────────────────────────────────────────────────────
  async function handleJoin({ name, code }) {
    const res = await emit('room:join', { name, code })
    if (!res.ok) return showToast(res.error)
    const me = res.room.players.find(p => p.name === name)
    setMyId(me?.id)
    setRoom(res.room)
    setScreen('lobby')
  }

  // ── LOBBY ACTIONS ───────────────────────────────────────────────────────────
  async function handleReady(ready) {
    await emit('lobby:ready', { ready })
  }

  async function handleSetTeam(team) {
    await emit('lobby:setTeam', { team })
  }

  async function handleChat(message) {
    await emit('lobby:chat', { message })
  }

  async function handleStartGame() {
    const res = await emit('game:start', {})
    if (!res.ok) showToast(res.error)
  }

  // ── GAME ACTIONS ────────────────────────────────────────────────────────────
  async function handlePlayTile(tile, side) {
    if (isDemo) {
      demoPlayTile(tile, side)
      return
    }
    const res = await emit('game:playTile', { tile, side })
    if (!res?.ok) showToast(res?.error || 'Could not play tile')
  }

  async function handlePass() {
    if (isDemo) { demoPass(); return }
    const res = await emit('game:pass', {})
    if (!res?.ok) showToast(res?.error || 'Could not pass')
  }

  async function handleNextRound() {
    if (isDemo) { demoNextRound(); return }
    const res = await emit('game:nextRound', {})
    if (!res?.ok) showToast(res?.error)
  }

  function handleLeaveGame() {
    if (isDemo) { resetToHome(); return }
    emit('room:leave', {})
    resetToHome()
  }

  function resetToHome() {
    setScreen('home')
    setRoom(null)
    setMyId(null)
    setMyHand([])
    setRoundResult(null)
    setGameResult(null)
    setIsDemo(false)
    clearTimeout(botTimerRef.current)
  }

  // ── DEMO MODE ───────────────────────────────────────────────────────────────
  const demoPlayers = [
    { id: 'you', name: 'You', team: 1, ready: true },
    { id: 'bot2', name: 'Carlos', team: 2, ready: true },
    { id: 'bot3', name: 'Ana', team: 1, ready: true },
    { id: 'bot4', name: 'Roberto', team: 2, ready: true },
  ]

  function startDemo() {
    setIsDemo(true)
    setMyId('you')
    const game = buildGame(demoPlayers)
    const demoRoom = {
      code: 'DEMO',
      mode: 'teams',
      target: 100,
      hostId: 'you',
      phase: 'playing',
      players: demoPlayers,
      chat: [],
      game,
    }
    setRoom(demoRoom)
    setMyHand(game.hands['you'])
    setScreen('game')
    setRoundResult(null)
    setGameResult(null)
    if (game.currentPlayerId !== 'you') {
      botTimerRef.current = setTimeout(() => runBots(demoRoom, game.hands['you']), 1200)
    }
  }

  function demoPlayTile(tile, side) {
    setRoom(prev => {
      const game = { ...prev.game }
      const chain = [...game.chain]
      const hands = { ...game.hands }
      const hand = [...hands['you']]

      // Build chain entry
      const { L, R } = getChainEnds(chain)
      let entry
      if (!chain.length) {
        entry = { tile, eL: tile[0], eR: tile[1], flipped: false }
      } else if (side === 'left') {
        const fl = tile[1] === L
        entry = { tile, eL: fl ? tile[0] : tile[1], eR: fl ? tile[1] : tile[0], flipped: fl, side: 'left' }
      } else {
        const fl = tile[0] === R
        entry = { tile, eL: fl ? tile[1] : tile[0], eR: fl ? tile[0] : tile[1], flipped: fl, side: 'right' }
      }

      if (side === 'left') chain.unshift(entry); else chain.push(entry)
      const idx = hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1])
      hand.splice(idx, 1)
      hands['you'] = hand
      setMyHand(hand)

      game.chain = chain
      game.hands = hands
      game.consecutivePasses = 0
      game.handCounts = { ...game.handCounts, you: hand.length }

      if (!hand.length) {
        finishDemoRound({ ...prev, game }, 'you', false)
        return { ...prev, game }
      }

      // Advance turn
      const players = prev.players
      const myI = players.findIndex(p => p.id === 'you')
      game.currentPlayerId = players[(myI + 1) % players.length].id

      const newRoom = { ...prev, game }
      botTimerRef.current = setTimeout(() => runBots(newRoom, hand), 900)
      return newRoom
    })
  }

  function demoPass() {
    setRoom(prev => {
      const game = { ...prev.game }
      game.consecutivePasses = (game.consecutivePasses || 0) + 1
      if (game.consecutivePasses >= prev.players.length) {
        finishDemoRound({ ...prev, game }, null, false)
        return { ...prev, game }
      }
      const players = prev.players
      const myI = players.findIndex(p => p.id === 'you')
      game.currentPlayerId = players[(myI + 1) % players.length].id
      const newRoom = { ...prev, game }
      botTimerRef.current = setTimeout(() => runBots(newRoom, myHand), 900)
      return newRoom
    })
  }

  function runBots(currentRoom, humanHand) {
    setRoom(prev => {
      if (!prev?.game) return prev
      let game = { ...prev.game }
      const players = prev.players
      let curId = game.currentPlayerId

      while (curId !== 'you') {
        const hand = [...(game.hands[curId] || [])]
        const move = botChooseMove(hand, game.chain)

        if (!move) {
          game.consecutivePasses = (game.consecutivePasses || 0) + 1
          if (game.consecutivePasses >= players.length) {
            finishDemoRound({ ...prev, game }, null, false)
            return { ...prev, game }
          }
        } else {
          const { tile, side } = move
          const chain = [...game.chain]
          const { L, R } = getChainEnds(chain)
          let entry
          if (!chain.length) {
            entry = { tile, eL: tile[0], eR: tile[1], flipped: false }
          } else if (side === 'left') {
            const fl = tile[1] === L
            entry = { tile, eL: fl ? tile[0] : tile[1], eR: fl ? tile[1] : tile[0], flipped: fl, side: 'left' }
          } else {
            const fl = tile[0] === R
            entry = { tile, eL: fl ? tile[1] : tile[0], eR: fl ? tile[0] : tile[1], flipped: fl, side: 'right' }
          }
          if (side === 'left') chain.unshift(entry); else chain.push(entry)
          const tIdx = hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1])
          hand.splice(tIdx, 1)
          game.hands = { ...game.hands, [curId]: hand }
          game.chain = chain
          game.consecutivePasses = 0
          game.handCounts = { ...game.handCounts, [curId]: hand.length }

          if (!hand.length) {
            finishDemoRound({ ...prev, game }, curId, false)
            return { ...prev, game }
          }
        }

        const idx = players.findIndex(p => p.id === curId)
        curId = players[(idx + 1) % players.length].id
        game.currentPlayerId = curId
      }

      return { ...prev, game }
    })
  }

  function finishDemoRound(currentRoom, winnerId, cap) {
    const game = currentRoom.game
    const players = currentRoom.players

    let winTeam = null, points = 0
    if (winnerId) {
      const w = players.find(p => p.id === winnerId)
      winTeam = w.team
      const oppPips = players.filter(p => p.id !== winnerId).reduce((s, p) => s + (game.hands[p.id] || []).reduce((a, t) => a + t[0] + t[1], 0), 0)
      points = Math.ceil(oppPips / 5) * 5
      if (cap) points += 10
    } else {
      const tp = { 1: 0, 2: 0 }
      players.forEach(p => { tp[p.team] += (game.hands[p.id] || []).reduce((a, t) => a + t[0] + t[1], 0) })
      if (tp[1] < tp[2]) { winTeam = 1; points = Math.ceil((tp[2] - tp[1]) / 5) * 5 }
      else if (tp[2] < tp[1]) { winTeam = 2; points = Math.ceil((tp[1] - tp[2]) / 5) * 5 }
    }

    const scores = { ...game.scores }
    if (winTeam === 1) scores.t1 += points
    else if (winTeam === 2) scores.t2 += points

    setRoom(r => r ? { ...r, game: { ...r.game, scores } } : r)

    const won = scores.t1 >= currentRoom.target || scores.t2 >= currentRoom.target
    if (won) {
      setGameResult({ scores, winTeam: scores.t1 >= currentRoom.target ? 1 : 2 })
    } else {
      setRoundResult({ scores, result: { winTeam, points }, capicu: cap, blocked: !winnerId })
    }
  }

  function demoNextRound() {
    const game = buildGame(demoPlayers)
    setRoom(prev => {
      const scores = prev.game.scores
      game.scores = scores
      game.handCounts = {}
      demoPlayers.forEach(p => { game.handCounts[p.id] = game.hands[p.id].length })
      return { ...prev, game }
    })
    setMyHand(game.hands['you'])
    setRoundResult(null)
    if (game.currentPlayerId !== 'you') {
      botTimerRef.current = setTimeout(() => {
        setRoom(r => {
          if (r) runBots(r, game.hands['you'])
          return r
        })
      }, 1200)
    }
  }

  // ── CREATE / JOIN FORM STATE ─────────────────────────────────────────────────
  const [createForm, setCreateForm] = useState({ name: '', mode: 'teams', target: 100 })
  const [joinForm, setJoinForm] = useState({ name: '', code: '' })

  // ── RENDER ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>

      {/* Connection badge */}
      {!connected && !isDemo && (
        <div style={{
          position: 'fixed', top: '.5rem', right: '.5rem', zIndex: 300,
          background: 'var(--red)', color: '#fff', borderRadius: 6,
          padding: '3px 10px', fontSize: '.65rem', fontFamily: 'var(--mono)',
        }}>
          Connecting...
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="ntf show">{toast}</div>
      )}

      {/* HOME */}
      {screen === 'home' && (
        <HomeScreen
          onCreate={() => setScreen('create')}
          onJoin={() => setScreen('join')}
          onDemo={startDemo}
        />
      )}

      {/* CREATE */}
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

      {/* JOIN */}
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

      {/* LOBBY */}
      {screen === 'lobby' && room && (
        <LobbyScreen
          room={room}
          myId={myId}
          onReady={handleReady}
          onSetTeam={handleSetTeam}
          onStartGame={handleStartGame}
          onChat={handleChat}
          onLeave={resetToHome}
        />
      )}

      {/* GAME */}
      {screen === 'game' && room && (
        <>
          <GameScreen
            room={room}
            myId={myId}
            myHand={myHand}
            onPlayTile={handlePlayTile}
            onPass={handlePass}
            onLeave={handleLeaveGame}
          />

          {roundResult && (
            <RoundModal
              scores={roundResult.scores}
              result={roundResult.result}
              capicu={roundResult.capicu}
              blocked={roundResult.blocked}
              isHost={room.hostId === myId || isDemo}
              onNextRound={handleNextRound}
            />
          )}

          {gameResult && (
            <WinModal
              scores={gameResult.scores}
              winTeam={gameResult.winTeam}
              onPlayAgain={isDemo ? startDemo : () => emit('game:start', {})}
              onHome={resetToHome}
            />
          )}
        </>
      )}
    </div>
  )
}
