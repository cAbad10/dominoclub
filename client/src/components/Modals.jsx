import React from 'react'
import Domino from './Domino'

// ── SCORE PROGRESS BAR ────────────────────────────────────────────────────────
function ScoreBar({ t1, t2, target }) {
  const total = target || 100
  const p1 = Math.min(100, Math.round((t1 / total) * 100))
  const p2 = Math.min(100, Math.round((t2 / total) * 100))

  return (
    <div style={{ margin: '.6rem 0 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '.3rem' }}>
        <span style={{ fontSize: '.65rem', fontFamily: 'var(--mono)', color: 'var(--t1)' }}>Team 1 — {t1} pts</span>
        <span style={{ fontSize: '.65rem', fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>{total} to win</span>
        <span style={{ fontSize: '.65rem', fontFamily: 'var(--mono)', color: 'var(--t2)' }}>{t2} pts — Team 2</span>
      </div>
      {/* Team 1 bar */}
      <div style={{ height: 8, background: 'var(--surf3)', borderRadius: 4, marginBottom: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p1}%`, background: 'var(--t1)', borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
      {/* Team 2 bar */}
      <div style={{ height: 8, background: 'var(--surf3)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p2}%`, background: 'var(--t2)', borderRadius: 4, transition: 'width .4s ease' }} />
      </div>
    </div>
  )
}

// ── SCORE HISTORY TABLE ───────────────────────────────────────────────────────
function ScoreHistory({ history }) {
  if (!history || history.length === 0) return null

  return (
    <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
      <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.4rem' }}>
        Round History
      </div>
      <div style={{ background: 'var(--surf2)', borderRadius: 8, overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px', padding: '.35rem .6rem', borderBottom: '1px solid var(--br)', fontSize: '.6rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase' }}>
          <span>#</span>
          <span style={{ color: 'var(--t1)' }}>Team 1</span>
          <span style={{ color: 'var(--t2)' }}>Team 2</span>
          <span>Points</span>
        </div>
        {/* Rows */}
        {history.map((row, i) => (
          <div key={i} style={{
            display: 'grid', gridTemplateColumns: '40px 1fr 1fr 80px',
            padding: '.32rem .6rem',
            borderBottom: i < history.length - 1 ? '1px solid var(--br)' : 'none',
            fontSize: '.72rem', fontFamily: 'var(--mono)',
            background: i === history.length - 1 ? 'rgba(255,255,255,0.03)' : 'transparent',
          }}>
            <span style={{ color: 'var(--tx3)' }}>{row.round}</span>
            <span style={{ color: row.winTeam === 1 ? 'var(--t1)' : 'var(--tx2)', fontWeight: row.winTeam === 1 ? 700 : 400 }}>
              {row.t1}
            </span>
            <span style={{ color: row.winTeam === 2 ? 'var(--t2)' : 'var(--tx2)', fontWeight: row.winTeam === 2 ? 700 : 400 }}>
              {row.t2}
            </span>
            <span style={{ color: 'var(--tx3)', fontSize: '.62rem' }}>
              {row.winTeam ? `+${row.points}${row.capicu ? ' ⚡' : ''}` : row.blocked ? 'blocked' : 'tied'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── PLAYER HAND DISPLAY ───────────────────────────────────────────────────────
function PlayerHand({ player, hand, isWinner, showAlways = false }) {
  if (!player) return null
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const pipCount = (hand || []).reduce((s, t) => s + t[0] + t[1], 0)
  const empty = !hand || hand.length === 0

  return (
    <div style={{
      background: 'var(--surf2)',
      border: `1px solid ${isWinner ? 'rgba(76,175,125,0.4)' : 'var(--br)'}`,
      borderRadius: 9,
      padding: '.55rem .75rem',
      marginBottom: '.4rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: empty ? 0 : '.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
          {isWinner && <span style={{ fontSize: '.7rem' }}>🏆</span>}
          <span style={{ fontSize: '.76rem', fontWeight: 700, color: tc }}>{player.name}</span>
          <span style={{ fontSize: '.6rem', fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>T{player.team}</span>
        </div>
        {empty
          ? <span style={{ fontSize: '.62rem', background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '1px 8px', fontFamily: 'var(--mono)' }}>Out!</span>
          : <span style={{ fontSize: '.62rem', fontFamily: 'var(--mono)', color: 'var(--tx2)' }}>{pipCount} pips</span>
        }
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-end', minHeight: empty ? 0 : 24 }}>
          {empty
            ? <span style={{ fontSize: '.62rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>No tiles remaining</span>
            : (hand || []).map((tile, i) => <Domino key={i} tile={tile} size="mini" onBoard />)
          }
        </div>
    </div>
  )
}

// ── ROUND MODAL ───────────────────────────────────────────────────────────────
export function RoundModal({ scores, result, capicu, blocked, isHost, onNextRound, players, hands, scoreHistory, target }) {
  const winTeamName = result?.winTeam ? `Team ${result.winTeam}` : null

  return (
    <div className="mw open">
      <div className="modal" style={{ maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>
        <div className="mt" style={{ marginBottom: '.2rem' }}>
          {capicu ? '⚡ Capicú!' : blocked ? '🔒 Blocked!' : 'Round Over'}
        </div>
        <div className="ms">
          {winTeamName
            ? `${winTeamName} scores ${result.points} pts${capicu ? ' (Capicú +10)' : ''}`
            : 'Tied — no points this round'}
        </div>

        {/* Score progress */}
        <ScoreBar t1={scores?.t1 || 0} t2={scores?.t2 || 0} target={target} />

        {/* Round history */}
        <ScoreHistory history={scoreHistory} />

        {/* Remaining hands */}
        {players && hands && (
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.4rem' }}>
              Remaining tiles
            </div>
            {players.map(p => (
              <PlayerHand
                key={p.id}
                player={p}
                hand={hands[p.id] || []}
                isWinner={result?.winTeam === p.team && (!hands[p.id] || hands[p.id].length === 0)}
                showAlways
              />
            ))}
          </div>
        )}

        {isHost
          ? <button className="btn bp" onClick={onNextRound}>Next Round →</button>
          : <div style={{ fontSize: '.78rem', color: 'var(--tx2)', fontFamily: 'var(--mono)' }}>Waiting for host...</div>
        }
      </div>
    </div>
  )
}

// ── WIN MODAL ─────────────────────────────────────────────────────────────────
export function WinModal({ scores, winTeam, onPlayAgain, onHome, players, hands, scoreHistory, target }) {
  return (
    <div className="mw open">
      <div className="modal" style={{ maxWidth: 480, maxHeight: '88vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '2rem', marginBottom: '.2rem' }}>🏆</div>
        <div className="mt">Team {winTeam} Wins!</div>
        <div className="ms">Game complete · first to {target} pts</div>

        {/* Final score bars */}
        <ScoreBar t1={scores?.t1 || 0} t2={scores?.t2 || 0} target={target} />

        {/* Full round history */}
        <ScoreHistory history={scoreHistory} />

        {/* Final hands */}
        {players && hands && (
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.4rem' }}>
              Final hands
            </div>
            {players.map(p => (
              <PlayerHand
                key={p.id}
                player={p}
                hand={hands[p.id] || []}
                isWinner={p.team === winTeam && (!hands[p.id] || hands[p.id].length === 0)}
              />
            ))}
          </div>
        )}

        <button className="btn bp" onClick={onPlayAgain}>Play Again</button>
        <button className="btn bs" style={{ marginTop: '.3rem' }} onClick={onHome}>Home</button>
      </div>
    </div>
  )
}
