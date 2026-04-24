const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const {
  createRoom, joinRoom, setReady, setTeam, addChat,
  startGame, playTile, passTurn, applyRoundScore,
  startNextRound, playerDisconnect, getRoom, sanitizeForPlayer,
} = require('./rooms');

const app = express();
const server = http.createServer(app);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const io = new Server(server, {
  cors: {
    origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

app.use(cors({ origin: CLIENT_URL }));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── SOCKET EVENTS ────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id}`);

  // ── CREATE ROOM ──────────────────────────────────────────────────────────
  socket.on('room:create', ({ name, mode, target }, callback) => {
    try {
      const room = createRoom({
        hostSocketId: socket.id,
        hostName: name || 'Player',
        mode: mode || 'teams',
        target: target || 100,
      });
      socket.join(room.code);
      socket.data.roomCode = room.code;
      socket.data.playerName = name;
      console.log(`[Room] Created ${room.code} by ${name}`);
      callback({ ok: true, room: sanitizeForPlayer(room, socket.id) });
    } catch (err) {
      console.error('room:create error', err);
      callback({ ok: false, error: err.message });
    }
  });

  // ── JOIN ROOM ────────────────────────────────────────────────────────────
  socket.on('room:join', ({ code, name }, callback) => {
    try {
      const result = joinRoom({ code: code.toUpperCase(), socketId: socket.id, playerName: name || 'Player' });
      if (result.error) return callback({ ok: false, error: result.error });

      socket.join(code.toUpperCase());
      socket.data.roomCode = code.toUpperCase();
      socket.data.playerName = name;

      // Notify others
      socket.to(code).emit('lobby:updated', sanitizeForPlayer(result.room, null));
      console.log(`[Room] ${name} joined ${code}`);
      callback({ ok: true, room: sanitizeForPlayer(result.room, socket.id) });
    } catch (err) {
      console.error('room:join error', err);
      callback({ ok: false, error: err.message });
    }
  });

  // ── SET READY ────────────────────────────────────────────────────────────
  socket.on('lobby:ready', ({ ready }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = setReady({ code, socketId: socket.id, ready });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('lobby:updated', sanitizeForPlayer(result.room, null));
    callback?.({ ok: true });
  });

  // ── SET TEAM ─────────────────────────────────────────────────────────────
  socket.on('lobby:setTeam', ({ team }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = setTeam({ code, socketId: socket.id, team });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('lobby:updated', sanitizeForPlayer(result.room, null));
    callback?.({ ok: true });
  });

  // ── CHAT ─────────────────────────────────────────────────────────────────
  socket.on('lobby:chat', ({ message }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const result = addChat({ code, socketId: socket.id, message });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('chat:message', result.msg);
    callback?.({ ok: true });
  });

  // ── START GAME ───────────────────────────────────────────────────────────
  socket.on('game:start', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = startGame(code, socket.id);
    if (result.error) return callback?.({ ok: false, error: result.error });

    // Send each player their own hand privately
    result.room.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('game:started', sanitizeForPlayer(result.room, player.id));
      }
    });

    console.log(`[Game] Started in room ${code}`);
    callback?.({ ok: true });
  });

  // ── PLAY TILE ────────────────────────────────────────────────────────────
  socket.on('game:playTile', ({ tile, side }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });

    const result = playTile({ code, socketId: socket.id, tile, side });
    if (result.error) return callback?.({ ok: false, error: result.error });

    if (result.roundOver) {
      const scoreResult = applyRoundScore(code, result.result);
      const room = getRoom(code);

      if (scoreResult.gameWon) {
        io.to(code).emit('game:over', {
          scores: room.game.scores,
          result: result.result,
          capicu: result.capicu,
        });
      } else {
        io.to(code).emit('game:roundOver', {
          scores: room.game.scores,
          result: result.result,
          capicu: result.capicu,
          blocked: result.blocked || false,
        });
      }
    } else {
      // Broadcast updated game state to all (no hands exposed)
      const room = getRoom(code);
      room.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.emit('game:stateUpdate', sanitizeForPlayer(room, player.id));
        }
      });
    }

    callback?.({ ok: true });
  });

  // ── PASS TURN ────────────────────────────────────────────────────────────
  socket.on('game:pass', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });

    const result = passTurn({ code, socketId: socket.id });
    if (result.error) return callback?.({ ok: false, error: result.error });

    if (result.roundOver) {
      const scoreResult = applyRoundScore(code, result.result);
      const room = getRoom(code);

      if (scoreResult.gameWon) {
        io.to(code).emit('game:over', {
          scores: room.game.scores,
          result: result.result,
          blocked: true,
        });
      } else {
        io.to(code).emit('game:roundOver', {
          scores: room.game.scores,
          result: result.result,
          blocked: true,
        });
      }
    } else {
      const room = getRoom(code);
      room.players.forEach(player => {
        const playerSocket = io.sockets.sockets.get(player.id);
        if (playerSocket) {
          playerSocket.emit('game:stateUpdate', sanitizeForPlayer(room, player.id));
        }
      });
    }

    callback?.({ ok: true });
  });

  // ── NEXT ROUND ───────────────────────────────────────────────────────────
  socket.on('game:nextRound', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });

    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return callback?.({ ok: false, error: 'Only host can advance round' });

    const result = startNextRound(code);
    if (result.error) return callback?.({ ok: false, error: result.error });

    result.room.players.forEach(player => {
      const playerSocket = io.sockets.sockets.get(player.id);
      if (playerSocket) {
        playerSocket.emit('game:roundStarted', sanitizeForPlayer(result.room, player.id));
      }
    });

    callback?.({ ok: true });
  });

  // ── LEAVE ROOM ───────────────────────────────────────────────────────────
  socket.on('room:leave', (_, callback) => {
    handleDisconnect(socket);
    callback?.({ ok: true });
  });

  // ── DISCONNECT ───────────────────────────────────────────────────────────
  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    handleDisconnect(socket);
  });
});

function handleDisconnect(socket) {
  const result = playerDisconnect(socket.id);
  if (result) {
    socket.to(result.code).emit('player:left', {
      playerName: result.playerName,
      room: sanitizeForPlayer(result.room, null),
    });
    socket.leave(result.code);
    console.log(`[Room] ${result.playerName} left ${result.code}`);
  }
}

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🁣  Dominó server running on port ${PORT}`);
  console.log(`   Client URL: ${CLIENT_URL}\n`);
});
