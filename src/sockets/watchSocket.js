// In-memory map of gameId -> set of watcher socket IDs
const watchRooms = new Map();

export function registerWatchSocketHandlers(io) {
  const watch_ns = io.of('/watch');

  watch_ns.on('connection', (socket) => {
    let watchingGame = null;

    // Watch a game
    socket.on('watch_game', ({ gameId }) => {
      if (!gameId) return socket.emit('error', { message: 'gameId is required' });

      watchingGame = gameId;
      socket.join(`watch:${gameId}`);

      if (!watchRooms.has(gameId)) watchRooms.set(gameId, new Set());
      watchRooms.get(gameId).add(socket.id);

      socket.emit('watching', { gameId, spectators: watchRooms.get(gameId).size });

      // Notify others in the watch room
      socket.to(`watch:${gameId}`).emit('spectator_joined', {
        spectators: watchRooms.get(gameId).size
      });
    });

    // Stop watching
    socket.on('stop_watching', ({ gameId }) => {
      leaveWatchRoom(socket, gameId || watchingGame);
      watchingGame = null;
    });

    // Chat in watch room
    socket.on('watch_chat', ({ gameId, message, username }) => {
      watch_ns.to(`watch:${gameId}`).emit('watch_chat', {
        username: username || 'Guest',
        message,
        timestamp: Date.now()
      });
    });

    socket.on('disconnect', () => {
      if (watchingGame) leaveWatchRoom(socket, watchingGame);
    });
  });

  // Broadcast a live move update to all watchers of a game
  // Called externally from the chess socket handler when a move is made
  watch_ns.broadcastMove = (gameId, moveData) => {
    watch_ns.to(`watch:${gameId}`).emit('live_move', moveData);
  };

  watch_ns.broadcastGameOver = (gameId, result) => {
    watch_ns.to(`watch:${gameId}`).emit('game_over', result);
  };
}

function leaveWatchRoom(socket, gameId) {
  if (!gameId) return;
  socket.leave(`watch:${gameId}`);
  const room = watchRooms.get(gameId);
  if (room) {
    room.delete(socket.id);
    if (room.size === 0) watchRooms.delete(gameId);
  }
}
