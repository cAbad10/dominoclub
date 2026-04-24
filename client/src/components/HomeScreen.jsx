import React from 'react'

export default function HomeScreen({ onCreate, onJoin, onDemo }) {
  return (
    <div className="screen">
      <div style={{ textAlign: 'center' }}>
        <div className="logo">DOMI<em>NÓ</em></div>
        <div className="sub">Cuban Rules · Real-time Multiplayer</div>
      </div>
      <div className="home-grid">
        <div className="hcard" onClick={onCreate}>
          <div className="hci">🎯</div>
          <div className="hct">Create Room</div>
          <div className="hcd">Host a new lobby</div>
        </div>
        <div className="hcard" onClick={onJoin}>
          <div className="hci">🚪</div>
          <div className="hct">Join Room</div>
          <div className="hcd">Enter a room code</div>
        </div>
      </div>
      <button className="btn bs" style={{ maxWidth: 190, marginTop: '1rem' }} onClick={onDemo}>
        ▶ Play vs Bots
      </button>
    </div>
  )
}
