import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// In-memory game store (fallback when DB is not available)
const games = new Map();

// GET /api/game/:id - get game state
router.get('/:id', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  res.json(game);
});

// POST /api/game/create - create a new in-memory game
router.post('/create', (req, res) => {
  const { white, black, timeControl } = req.body;
  const id = uuidv4();
  const game = {
    id,
    white: white || 'Anonymous',
    black: black || 'Anonymous',
    timeControl: timeControl || null,
    moves: [],
    fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    status: 'waiting',
    createdAt: new Date().toISOString()
  };
  games.set(id, game);
  res.status(201).json(game);
});

// POST /api/game/:id/move - add a move
router.post('/:id/move', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { from, to, promotion, san, fen } = req.body;
  if (!from || !to) return res.status(400).json({ error: 'from and to are required' });

  game.moves.push({ from, to, promotion, san, fen, timestamp: new Date().toISOString() });
  if (fen) game.fen = fen;
  game.status = 'active';

  res.json(game);
});

// POST /api/game/:id/end - end a game
router.post('/:id/end', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });

  const { result, termination } = req.body;
  game.status = 'completed';
  game.result = result || null;
  game.termination = termination || null;
  game.endedAt = new Date().toISOString();

  res.json(game);
});

// DELETE /api/game/:id - abort a game
router.delete('/:id', (req, res) => {
  const game = games.get(req.params.id);
  if (!game) return res.status(404).json({ error: 'Game not found' });
  game.status = 'aborted';
  games.delete(req.params.id);
  res.json({ message: 'Game aborted' });
});

export default router;
