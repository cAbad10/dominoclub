const { v4: uuidv4 } = require('uuid');
const {
  deal,
  findFirstPlayer,
  getChainEnds,
  canPlayTile,
  buildChainEntry,
  isCapicu,
  calcRoundScore,
} = require('./engine');

// In-memory store: roomCode -> room object
const rooms = new Map();

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function createRoom({ hostSocketId, hostName, mode, target }) {
  let code;
  do { code = generateCode(); } while (rooms.has(code));

  const room = {
    code,
    mode,         // 'teams' | 'ffa'
    target,       // points to win
    hostId: hostSocketId,
    phase: 'lobby', // 'lobby' | 'playing'
    players: [{
      id: hostSocketId,
      name: hostName,
      team: 1,
      ready: false,
      connected: true,
    }],
    game: null,
    chat: [{ system: true, text: `Room ${code} created` }],
    createdAt: Date.now(),
  };

  rooms.set(code, room);
  return room;
}

function joinRoom({ code, socketId, playerName }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.phase === 'playing') return { error: 'Game already in progress' };
  if (room.players.length >= 4) return { error: 'Room is full' };
  if (room.players.find(p => p.id === socketId)) return { error: 'Already in room' };

  // Auto-assign team for balance
  const t1 = room.players.filter(p => p.team === 1).length;
  const t2 = room.players.filter(p => p.team === 2).length;
  const team = t1 <= t2 ? 1 : 2;

  room.players.push({
    id: socketId,
    name: playerName,
    team,
    ready: false,
    connected: true,
  });

  room.chat.push({ system: true, text: `${playerName} joined Team ${team}` });
  return { room };
}

function setReady({ code, socketId, ready }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const player = room.players.find(p => p.id === socketId);
  if (!player) return { error: 'Player not in room' };
  player.ready = ready;
  return { room };
}

function setTeam({ code, socketId, team }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const player = room.players.find(p => p.id === socketId);
  if (!player) return { error: 'Player not in room' };
  player.team = team;
  return { room };
}

function addChat({ code, socketId, message }) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  const player = room.players.find(p => p.id === socketId);
  if (!player) return { error: 'Not in room' };
  const msg = { from: player.name, text: message, ts: Date.now() };
  room.chat.push(msg);
  return { room, msg };
}

function startGame(code, socketId) {
  const room = rooms.get(code);
  if (!room) return { error: 'Room not found' };
  if (room.hostId !== socketId) return { error: 'Only host can start' };
  if (room.players.length < 2) return { error: 'Need at least 2 players' };

  const { hands, boneyard } = deal(room.players, 10);
  const firstPlayerId = findFirstPlayer(hands);

  room.phase = 'playing';
  room.game = {
    hands,
    boneyard,
    chain: [],
    currentPlayerId: firstPlayerId,
    scores: { t1: 0, t2: 0 },
    consecutivePasses: 0,
    roundNum: 1,
  };

  return { room };
}

function playTile({ code, socketId, tile, side }) {
  const room = rooms.get(code);
  if (!room || !room.game) return { error: 'No active game' };
  const game = room.game;

  if (game.currentPlayerId !== socketId) return { error: 'Not your turn' };

  const hand = game.hands[socketId];
  if (!hand) return { error: 'No hand found' };

  const tileIdx = hand.findIndex(t => t[0] === tile[0] && t[1] === tile[1]);
  if (tileIdx === -1) return { error: 'Tile not in hand' };

  if (!canPlayTile(tile, game.chain)) return { error: 'Tile cannot be played' };

  // Validate side fits
  if (game.chain.length > 0) {
    const { L, R } = getChainEnds(game.chain);
    const fitsLeft = tile[0] === L || tile[1] === L;
    const fitsRight = tile[0] === R || tile[1] === R;
    if (side === 'left' && !fitsLeft) return { error: 'Tile does not fit left end' };
    if (side === 'right' && !fitsRight) return { error: 'Tile does not fit right end' };
  }

  const cap = isCapicu(tile, game.chain);
  const entry = buildChainEntry(tile, side, game.chain);
  if (side === 'left') game.chain.unshift(entry);
  else game.chain.push(entry);

  hand.splice(tileIdx, 1);
  game.consecutivePasses = 0;

  // Check win
  if (hand.length === 0) {
    const result = calcRoundScore(socketId, room.players, game.hands, cap);
    return { room, roundOver: true, result, capicu: cap };
  }

  // Next turn
  advanceTurn(room);
  return { room };
}

function passTurn({ code, socketId }) {
  const room = rooms.get(code);
  if (!room || !room.game) return { error: 'No active game' };
  const game = room.game;

  if (game.currentPlayerId !== socketId) return { error: 'Not your turn' };

  const hand = game.hands[socketId] || [];
  const hasPlay = hand.some(t => canPlayTile(t, game.chain));
  if (hasPlay) return { error: 'You have playable tiles — cannot pass' };

  game.consecutivePasses++;

  if (game.consecutivePasses >= room.players.length) {
    const result = calcRoundScore(null, room.players, game.hands, false);
    return { room, roundOver: true, result, blocked: true };
  }

  advanceTurn(room);
  return { room };
}

function applyRoundScore(code, result) {
  const room = rooms.get(code);
  if (!room || !room.game) return { error: 'No game' };

  if (result.winTeam === 1) room.game.scores.t1 += result.points;
  else if (result.winTeam === 2) room.game.scores.t2 += result.points;

  const gameWon = room.game.scores.t1 >= room.target || room.game.scores.t2 >= room.target;
  return { room, gameWon };
}

function startNextRound(code) {
  const room = rooms.get(code);
  if (!room || !room.game) return { error: 'No game' };

  const { hands, boneyard } = deal(room.players, 10);
  const firstPlayerId = findFirstPlayer(hands);
  const prevScores = { ...room.game.scores };

  room.game = {
    hands,
    boneyard,
    chain: [],
    currentPlayerId: firstPlayerId,
    scores: prevScores,
    consecutivePasses: 0,
    roundNum: (room.game.roundNum || 1) + 1,
  };

  return { room };
}

function advanceTurn(room) {
  const game = room.game;
  const players = room.players;
  const idx = players.findIndex(p => p.id === game.currentPlayerId);
  game.currentPlayerId = players[(idx + 1) % players.length].id;
}

function playerDisconnect(socketId) {
  // Find any room with this player and mark them disconnected
  for (const [code, room] of rooms.entries()) {
    const player = room.players.find(p => p.id === socketId);
    if (player) {
      player.connected = false;
      // Clean up empty lobby rooms
      if (room.phase === 'lobby' && room.players.every(p => !p.connected)) {
        rooms.delete(code);
      }
      return { code, room, playerName: player.name };
    }
  }
  return null;
}

function getRoom(code) {
  return rooms.get(code) || null;
}

// Sanitize room for client: remove other players' hands
function sanitizeForPlayer(room, playerId) {
  if (!room) return null;
  const safe = { ...room };
  if (safe.game) {
    safe.game = { ...safe.game };
    safe.game.hands = {};
    // Only send this player's own hand
    if (room.game.hands[playerId]) {
      safe.game.hands[playerId] = room.game.hands[playerId];
    }
    // Send hand counts for others
    safe.game.handCounts = {};
    for (const [pid, hand] of Object.entries(room.game.hands)) {
      safe.game.handCounts[pid] = hand.length;
    }
  }
  return safe;
}

module.exports = {
  createRoom,
  joinRoom,
  setReady,
  setTeam,
  addChat,
  startGame,
  playTile,
  passTurn,
  applyRoundScore,
  startNextRound,
  playerDisconnect,
  getRoom,
  sanitizeForPlayer,
};
