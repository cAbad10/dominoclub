import React, { useState } from 'react'

export default function LobbyScreen({ room, myId, onReady, onSetTeam, onStartGame, onChat, onLeave }) {
  const [chatInput, setChatInput] = useState('')
  const me = room.players.find(p => p.id === myId)
  const isHost = room.hostId === myId
  const allFilled = room.players.length >= 2
  const allReady = allFilled && room.players.every(p => p.ready)

  function handleChat(e) {
    e.preventDefault()
    if (!chatInput.trim()) return
    onChat(chatInput.trim())
    setChatInput('')
  }

  return (
    <div className="screen" style={{ justifyContent: 'flex-start', paddingTop: '1rem' }}>
      <div style={{ width: '100%', maxWidth: 760 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.9rem' }}>
          <button className="bk" onClick={onLeave}>← Leave</button>
          <span className="tag">{room.mode === 'teams' ? 'Teams 2v2' : 'Free-for-All'}</span>
        </div>

        <div className="lw">
          <div>
            <div className="pan" style={{ marginBottom: '.75rem' }}>
              <div className="pt">Room Code</div>
              <div className="rcode">{room.code}</div>
              <div style={{ fontSize: '.7rem', color: 'var(--tx2)', marginBottom: '.75rem' }}>
                Share this code with friends
              </div>
              <div className="pg">
                {room.players.map(p => (
                  <div key={p.id} className={`ps ${p.team === 1 ? 'f1' : 'f2'}`}>
                    <div className="pn">
                      {p.name}
                      {p.id === myId && <span style={{ fontSize: '.6rem', color: 'var(--tx2)' }}> (you)</span>}
                      {p.id === room.hostId && <span style={{ fontSize: '.6rem', color: 'var(--gold)' }}> ★</span>}
                    </div>
                    <div className={`ptg ${p.team === 1 ? 'tc1' : 'tc2'}`}>Team {p.team}</div>
                    {p.ready
                      ? <span className="rb">Ready</span>
                      : <span className="wb">Not ready</span>
                    }
                  </div>
                ))}
                {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
                  <div key={`empty-${i}`} className="ps emp">
                    <span style={{ fontSize: '.7rem', color: 'var(--tx3)' }}>Waiting...</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pan">
              <div className="pt">Your Team</div>
              <div style={{ display: 'flex', gap: '.45rem' }}>
                <button className={`btn bsm ${me?.team === 1 ? 'bp' : 'bs'}`} onClick={() => onSetTeam(1)}>
                  Team 1
                </button>
                <button className={`btn bsm ${me?.team === 2 ? 'bp' : 'bs'}`} onClick={() => onSetTeam(2)}>
                  Team 2
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div className="pan">
              <div className="pt">Settings</div>
              <div className="sr"><span className="sl">Ruleset</span><span className="sv">Cuban</span></div>
              <div className="sr"><span className="sl">Tile set</span><span className="sv">Double-9</span></div>
              <div className="sr"><span className="sl">Tiles/player</span><span className="sv">10</span></div>
              <div className="sr"><span className="sl">Points to win</span><span className="sv">{room.target}</span></div>
              <div className="sr"><span className="sl">Capicú bonus</span><span className="sv">ON</span></div>
            </div>

            <div className="pan" style={{ flex: 1 }}>
              <div className="pt">Chat</div>
              <div className="ca" id="chatArea">
                {room.chat?.map((m, i) => (
                  m.system
                    ? <div key={i} className="cm" style={{ color: 'var(--tx3)' }}>{m.text}</div>
                    : <div key={i} className="cm"><span>{m.from}</span>: {m.text}</div>
                ))}
              </div>
              <form onSubmit={handleChat} style={{ display: 'flex', gap: '.35rem' }}>
                <input
                  className="fi"
                  placeholder="Say something..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  style={{ flex: 1, padding: '.38rem .65rem', fontSize: '.75rem' }}
                />
                <button type="submit" className="btn bs bsm">Send</button>
              </form>
            </div>

            <div>
              <button
                className={`btn ${me?.ready ? 'bs' : 'bp'}`}
                onClick={() => onReady(!me?.ready)}
              >
                {me?.ready ? 'Not Ready ✗' : 'Ready Up ✓'}
              </button>

              {isHost && allReady && (
                <button className="btn bp" style={{ marginTop: '.3rem' }} onClick={onStartGame}>
                  Start Game →
                </button>
              )}
              {isHost && !allReady && allFilled && (
                <div style={{ fontSize: '.7rem', color: 'var(--tx3)', fontFamily: 'var(--mono)', marginTop: '.5rem', textAlign: 'center' }}>
                  Waiting for all players to ready up
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
