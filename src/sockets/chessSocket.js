import { Chess } from 'chess.js';
import { v4 as uuidv4 } from 'uuid';
import Game from '../models/Game.js';

// In-memory room store: roomId -> room state
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      roomId,
      chess: new Chess(),
      players: {},  // { white: socketId, black: socketId }
      spectators: new Set(),
      status: 'waiting',
      result: null,
      gameId: uuidv4()
    });
  }
  return rooms.get(roomId);
}

export function registerChessSocketHandlers(io) {
  const chess_ns = io.of('/chess');

  chess_ns.on('connection', (socket) => {
    let currentRoom = null;
    let playerColor = null;

    // Join a game room
    socket.on('join_room', ({ roomId, username }) => {
      const room = getOrCreateRoom(roomId);
      currentRoom = roomId;
      socket.join(roomId);

      if (!room.players.white) {
        room.players.white = { socketId: socket.id, username: username || 'Anonymous' };
        playerColor = 'white';
      } else if (!room.players.black) {
        room.players.black = { socketId: socket.id, username: username || 'Anonymous' };
        playerColor = 'black';
        room.status = 'active';
        chess_ns.to(roomId).emit('game_start', {
          white: room.players.white.username,
          black: room.players.black.username,
          fen: room.chess.fen()
        });
      } else {
        room.spectators.add(socket.id);
        playerColor = 'spectator';
      }

      socket.emit('room_joined', {
        roomId,
        color: playerColor,
        fen: room.chess.fen(),
        status: room.status,
        players: {
          white: room.players.white?.username,
          black: room.players.black?.username
        }
      });
    });

    // Make a move
    socket.on('make_move', async ({ roomId, move }) => {
      const room = rooms.get(roomId);
      if (!room) return socket.emit('error', { message: 'Room not found' });
      if (room.status !== 'active') return socket.emit('error', { message: 'Game is not active' });

      const turn = room.chess.turn() === 'w' ? 'white' : 'black';
      const playerEntry = room.players[turn];
      if (!playerEntry || playerEntry.socketId !== socket.id) {
        return socket.emit('error', { message: 'Not your turn' });
      }

      try {
        const result = room.chess.move(move);
        if (!result) return socket.emit('error', { message: 'Invalid move' });

        const fen = room.chess.fen();
        chess_ns.to(roomId).emit('move_made', { move: result, fen });

        // Check for game end
        let gameResult = null;
        let termination = null;
        if (room.chess.isCheckmate()) {
          gameResult = turn;
          termination = 'checkmate';
        } else if (room.chess.isDraw()) {
          gameResult = 'draw';
          termination = room.chess.isStalemate()
            ? 'stalemate'
            : room.chess.isThreefoldRepetition()
            ? 'repetition'
            : 'insufficient material';
        }

        if (gameResult) {
          room.status = 'completed';
          room.result = gameResult;
          chess_ns.to(roomId).emit('game_over', { result: gameResult, termination });

          try {
            await Game.findOneAndUpdate(
              { gameId: room.gameId },
              {
                $push: { moves: { from: result.from, to: result.to, san: result.san, fen } },
                fen,
                status: 'completed',
                result: gameResult,
                termination,
                pgn: room.chess.pgn()
              },
              { upsert: true, new: true }
            );
          } catch (_) {
            // DB unavailable – continue without persistence
          }
        }
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Offer/accept/decline draw
    socket.on('offer_draw', ({ roomId }) => {
      chess_ns.to(roomId).emit('draw_offered', { from: socket.id });
    });

    socket.on('accept_draw', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      room.status = 'completed';
      room.result = 'draw';
      chess_ns.to(roomId).emit('game_over', { result: 'draw', termination: 'agreement' });
    });

    socket.on('decline_draw', ({ roomId }) => {
      chess_ns.to(roomId).emit('draw_declined');
    });

    // Resign
    socket.on('resign', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room) return;
      const turn = room.chess.turn() === 'w' ? 'white' : 'black';
      const resigning = turn === 'white' ? 'black' : 'white';
      room.status = 'completed';
      room.result = resigning;
      chess_ns.to(roomId).emit('game_over', { result: resigning, termination: 'resignation' });
    });

    // Chat message
    socket.on('chat_message', ({ roomId, message, username }) => {
      chess_ns.to(roomId).emit('chat_message', {
        username: username || 'Anonymous',
        message,
        timestamp: Date.now()
      });
    });

    // Disconnect
    socket.on('disconnect', () => {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;

      if (playerColor !== 'spectator') {
        room.spectators.forEach((id) => {
          chess_ns.to(id).emit('player_disconnected', { color: playerColor });
        });
        const opponent = playerColor === 'white' ? 'black' : 'white';
        if (room.players[opponent]) {
          chess_ns.to(room.players[opponent].socketId).emit('player_disconnected', {
            color: playerColor
          });
        }
      } else {
        room.spectators.delete(socket.id);
      }
    });
  });
}
