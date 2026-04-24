import React from 'react'
import Domino from './Domino'

// Shows a player's remaining hand after round ends
function PlayerHand({ player, hand, isWinner }) {
  if (!player) return null
  const tc = player.team === 1 ? 'var(--t1)' : 'var(--t2)'
  const pipCount = (hand || []).reduce((s, t) => s + t[0] + t[1], 0)

  return (
    <div style={{
      background: 'var(--surf2)',
      border: `1px solid ${isWinner ? 'var(--green)' : 'var(--br)'}`,
      borderRadius: 10,
      padding: '.6rem .8rem',
      marginBottom: '.5rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          {isWinner && <span style={{ fontSize: '.7rem' }}>🏆</span>}
          <span style={{ fontSize: '.78rem', fontWeight: 700, color: tc }}>{player.name}</span>
          <span style={{ fontSize: '.62rem', fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>T{player.team}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '.4rem' }}>
          {(hand || []).length === 0
            ? <span style={{ fontSize: '.65rem', background: 'var(--green)', color: '#fff', borderRadius: 20, padding: '1px 7px', fontFamily: 'var(--mono)' }}>Out!</span>
            : <span style={{ fontSize: '.65rem', fontFamily: 'var(--mono)', color: 'var(--tx2)' }}>{pipCount} pips</span>
          }
        </div>
      </div>

      {(hand || []).length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'flex-end' }}>
          {hand.map((tile, i) => (
            <Domino key={i} tile={tile} size="mini" onBoard />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>No tiles remaining</div>
      )}
    </div>
  )
}

export function RoundModal({ scores, result, capicu, blocked, isHost, onNextRound, players, hands }) {
  const winTeamName = result?.winTeam ? `Team ${result.winTeam}` : null

  return (
    <div className="mw open">
      <div className="modal" style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="mt" style={{ marginBottom: '.2rem' }}>
          {capicu ? '🏆 Capicú!' : blocked ? '🔒 Blocked!' : 'Round Over'}
        </div>
        <div className="ms">
          {winTeamName
            ? `${winTeamName} scores ${result.points} pts${capicu ? ' (Capicú +10)' : ''}`
            : 'Tied — no points this round'}
        </div>

        {/* Score totals */}
        <div className="msc">
          <div className="mb">
            <div className="mbl tc1">Team 1</div>
            <div className="mbv tc1">{scores?.t1 || 0}</div>
          </div>
          <div className="mb">
            <div className="mbl tc2">Team 2</div>
            <div className="mbv tc2">{scores?.t2 || 0}</div>
          </div>
        </div>

        {/* Player hands */}
        {players && hands && (
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
              Remaining tiles
            </div>
            {players.map(p => (
              <PlayerHand
                key={p.id}
                player={p}
                hand={hands[p.id] || []}
                isWinner={result?.winTeam === p.team && (hands[p.id] || []).length === 0}
              />
            ))}
          </div>
        )}

        {isHost
          ? <button className="btn bp" onClick={onNextRound}>Next Round →</button>
          : <div style={{ fontSize: '.78rem', color: 'var(--tx2)', fontFamily: 'var(--mono)' }}>Waiting for host to start next round...</div>
        }
      </div>
    </div>
  )
}

export function WinModal({ scores, winTeam, onPlayAgain, onHome, players, hands }) {
  return (
    <div className="mw open">
      <div className="modal" style={{ maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ fontSize: '2rem', marginBottom: '.3rem' }}>🏆</div>
        <div className="mt">Team {winTeam} Wins!</div>
        <div className="ms">Game complete</div>

        {/* Final scores */}
        <div className="msc">
          <div className="mb">
            <div className="mbl tc1">Team 1</div>
            <div className="mbv tc1">{scores?.t1 || 0}</div>
          </div>
          <div className="mb">
            <div className="mbl tc2">Team 2</div>
            <div className="mbv tc2">{scores?.t2 || 0}</div>
          </div>
        </div>

        {/* Final hands */}
        {players && hands && (
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <div style={{ fontSize: '.65rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: '.5rem' }}>
              Final hands
            </div>
            {players.map(p => (
              <PlayerHand
                key={p.id}
                player={p}
                hand={hands[p.id] || []}
                isWinner={p.team === winTeam && (hands[p.id] || []).length === 0}
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
