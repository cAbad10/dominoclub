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

// ── CORS ORIGIN CHECK ─────────────────────────────────────────────────────────
// Accepts: localhost dev, any vercel.app preview, and the CLIENT_URL env var
function isAllowedOrigin(origin) {
  if (!origin) return true; // same-origin / server-to-server
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return true;
  if (origin.endsWith('.vercel.app')) return true;
  const clientUrl = process.env.CLIENT_URL || '';
  if (clientUrl && origin === clientUrl) return true;
  return false;
}

const corsOptions = {
  origin: (origin, callback) => {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Blocked origin: ${origin}`);
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  credentials: true,
};

const io = new Server(server, {
  cors: corsOptions,
  transports: ['polling', 'websocket'],
});

app.use(cors(corsOptions));
app.use(express.json());

// ── HEALTH CHECK ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.json({ service: 'Dominó server', status: 'running' });
});

// ── SOCKET EVENTS ─────────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  console.log(`[+] Connected: ${socket.id} from ${socket.handshake.headers.origin || 'unknown'}`);

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
      console.log(`[Room] Created ${room.code} by ${name}`);
      callback({ ok: true, room: sanitizeForPlayer(room, socket.id) });
    } catch (err) {
      console.error('room:create error', err);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('room:join', ({ code, name }, callback) => {
    try {
      const result = joinRoom({ code: code?.toUpperCase(), socketId: socket.id, playerName: name || 'Player' });
      if (result.error) return callback({ ok: false, error: result.error });
      socket.join(code.toUpperCase());
      socket.data.roomCode = code.toUpperCase();
      socket.to(code.toUpperCase()).emit('lobby:updated', sanitizeForPlayer(result.room, null));
      console.log(`[Room] ${name} joined ${code}`);
      callback({ ok: true, room: sanitizeForPlayer(result.room, socket.id) });
    } catch (err) {
      console.error('room:join error', err);
      callback({ ok: false, error: err.message });
    }
  });

  socket.on('lobby:ready', ({ ready }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = setReady({ code, socketId: socket.id, ready });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('lobby:updated', sanitizeForPlayer(result.room, null));
    callback?.({ ok: true });
  });

  socket.on('lobby:setTeam', ({ team }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = setTeam({ code, socketId: socket.id, team });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('lobby:updated', sanitizeForPlayer(result.room, null));
    callback?.({ ok: true });
  });

  socket.on('lobby:chat', ({ message }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return;
    const result = addChat({ code, socketId: socket.id, message });
    if (result.error) return callback?.({ ok: false, error: result.error });
    io.to(code).emit('chat:message', result.msg);
    callback?.({ ok: true });
  });

  socket.on('game:start', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = startGame(code, socket.id);
    if (result.error) return callback?.({ ok: false, error: result.error });
    result.room.players.forEach(player => {
      const ps = io.sockets.sockets.get(player.id);
      if (ps) ps.emit('game:started', sanitizeForPlayer(result.room, player.id));
    });
    console.log(`[Game] Started in room ${code}`);
    callback?.({ ok: true });
  });

  socket.on('game:playTile', ({ tile, side }, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = playTile({ code, socketId: socket.id, tile, side });
    if (result.error) return callback?.({ ok: false, error: result.error });
    if (result.roundOver) {
      const scoreResult = applyRoundScore(code, result.result);
      const room = getRoom(code);
      const event = scoreResult.gameWon ? 'game:over' : 'game:roundOver';
      io.to(code).emit(event, {
        scores: room.game.scores,
        result: result.result,
        capicu: result.capicu || false,
        blocked: false,
      });
    } else {
      const room = getRoom(code);
      room.players.forEach(player => {
        const ps = io.sockets.sockets.get(player.id);
        if (ps) ps.emit('game:stateUpdate', sanitizeForPlayer(room, player.id));
      });
    }
    callback?.({ ok: true });
  });

  socket.on('game:pass', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const result = passTurn({ code, socketId: socket.id });
    if (result.error) return callback?.({ ok: false, error: result.error });
    if (result.roundOver) {
      const scoreResult = applyRoundScore(code, result.result);
      const room = getRoom(code);
      const event = scoreResult.gameWon ? 'game:over' : 'game:roundOver';
      io.to(code).emit(event, {
        scores: room.game.scores,
        result: result.result,
        blocked: true,
      });
    } else {
      const room = getRoom(code);
      room.players.forEach(player => {
        const ps = io.sockets.sockets.get(player.id);
        if (ps) ps.emit('game:stateUpdate', sanitizeForPlayer(room, player.id));
      });
    }
    callback?.({ ok: true });
  });

  socket.on('game:nextRound', (_, callback) => {
    const code = socket.data.roomCode;
    if (!code) return callback?.({ ok: false, error: 'Not in a room' });
    const room = getRoom(code);
    if (!room || room.hostId !== socket.id) return callback?.({ ok: false, error: 'Only host can advance round' });
    const result = startNextRound(code);
    if (result.error) return callback?.({ ok: false, error: result.error });
    result.room.players.forEach(player => {
      const ps = io.sockets.sockets.get(player.id);
      if (ps) ps.emit('game:roundStarted', sanitizeForPlayer(result.room, player.id));
    });
    callback?.({ ok: true });
  });

  socket.on('room:leave', (_, callback) => {
    handleLeave(socket);
    callback?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    handleLeave(socket);
  });
});

function handleLeave(socket) {
  const result = playerDisconnect(socket.id);
  if (result) {
    socket.to(result.code).emit('player:left', {
      playerName: result.playerName,
      room: sanitizeForPlayer(result.room, null),
    });
    socket.leave(result.code);
  }
}

// ── START ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`\n🁣  Dominó server running on port ${PORT}`);
  console.log(`   Accepting origins: *.vercel.app + ${process.env.CLIENT_URL || 'localhost'}\n`);
});
