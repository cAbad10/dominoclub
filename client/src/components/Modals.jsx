import React from 'react'

export function RoundModal({ scores, result, capicu, blocked, isHost, onNextRound }) {
  const winTeamName = result?.winTeam ? `Team ${result.winTeam}` : null

  return (
    <div className="mw open">
      <div className="modal">
        <div className="mt">{capicu ? '🏆 Capicú!' : blocked ? '🔒 Blocked!' : 'Round Over'}</div>
        <div className="ms">
          {winTeamName
            ? `${winTeamName} scores ${result.points} pts${capicu ? ' (Capicú +10)' : ''}`
            : 'Tied — no points this round'}
        </div>
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
        {isHost
          ? <button className="btn bp" onClick={onNextRound}>Next Round →</button>
          : <div style={{ fontSize: '.8rem', color: 'var(--tx2)', fontFamily: 'var(--mono)' }}>Waiting for host to start next round...</div>
        }
      </div>
    </div>
  )
}

export function WinModal({ scores, winTeam, onPlayAgain, onHome }) {
  return (
    <div className="mw open">
      <div className="modal">
        <div style={{ fontSize: '1.7rem', marginBottom: '.3rem' }}>🏆</div>
        <div className="mt">Team {winTeam} Wins!</div>
        <div className="ms">Game complete</div>
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
        <button className="btn bp" onClick={onPlayAgain}>Play Again</button>
        <button className="btn bs" style={{ marginTop: '.3rem' }} onClick={onHome}>Home</button>
      </div>
    </div>
  )
}
