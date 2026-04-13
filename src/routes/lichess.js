import express from 'express';

const router = express.Router();

const LICHESS_BASE = 'https://lichess.org/api';

// GET /api/lichess/user/:username - fetch a Lichess user's public data
router.get('/user/:username', async (req, res) => {
  try {
    const response = await fetch(`${LICHESS_BASE}/user/${req.params.username}`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Lichess user not found' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lichess/games/:username - fetch recent games for a user
router.get('/games/:username', async (req, res) => {
  try {
    const { max = 10 } = req.query;
    const response = await fetch(
      `${LICHESS_BASE}/games/user/${req.params.username}?max=${max}&moves=true&opening=true`,
      { headers: { Accept: 'application/x-ndjson' } }
    );
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Could not fetch games from Lichess' });
    }
    const text = await response.text();
    const games = text
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line));
    res.json({ games });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/lichess/puzzle - fetch a daily puzzle
router.get('/puzzle', async (req, res) => {
  try {
    const response = await fetch(`${LICHESS_BASE}/puzzle/daily`);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'Could not fetch puzzle from Lichess' });
    }
    const data = await response.json();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
