import express from 'express';
import Game from '../models/Game.js';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// GET /api/games - list recent games
router.get('/', async (req, res) => {
  try {
    const { limit = 20, page = 1, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const games = await Game.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit));

    const total = await Game.countDocuments(filter);
    res.json({ games, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/games/:id - get a single game by gameId
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findOne({ gameId: req.params.id });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/games - create a new game
router.post('/', async (req, res) => {
  try {
    const { white, black, timeControl } = req.body;
    const game = new Game({
      gameId: uuidv4(),
      white: white || 'Anonymous',
      black: black || 'Anonymous',
      timeControl: timeControl || null
    });
    await game.save();
    res.status(201).json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/games/:id - update game (add move, change status, etc.)
router.patch('/:id', async (req, res) => {
  try {
    const game = await Game.findOneAndUpdate(
      { gameId: req.params.id },
      { $set: req.body },
      { new: true }
    );
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/games/:id - delete a game
router.delete('/:id', async (req, res) => {
  try {
    const game = await Game.findOneAndDelete({ gameId: req.params.id });
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({ message: 'Game deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
