import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// GET /api/ratings/leaderboard - top players by rating
router.get('/leaderboard', async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const players = await User.find({}, 'username rating gamesPlayed wins losses draws')
      .sort({ rating: -1 })
      .limit(Number(limit));
    res.json({ players });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ratings/:username - get a player's rating info
router.get('/:username', async (req, res) => {
  try {
    const user = await User.findOne(
      { username: req.params.username },
      'username rating gamesPlayed wins losses draws'
    );
    if (!user) return res.status(404).json({ error: 'Player not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ratings/update - update ratings after a game result
router.post('/update', async (req, res) => {
  try {
    const { winnerId, loserId, draw } = req.body;

    if (!winnerId && !draw) {
      return res.status(400).json({ error: 'winnerId or draw is required' });
    }

    const K = 32; // Elo K-factor

    if (draw && winnerId && loserId) {
      const [playerA, playerB] = await Promise.all([
        User.findById(winnerId),
        User.findById(loserId)
      ]);
      if (!playerA || !playerB) return res.status(404).json({ error: 'Player not found' });

      const [newRatingA, newRatingB] = calculateElo(playerA.rating, playerB.rating, 0.5, K);
      playerA.rating = newRatingA;
      playerA.draws += 1;
      playerA.gamesPlayed += 1;
      playerB.rating = newRatingB;
      playerB.draws += 1;
      playerB.gamesPlayed += 1;

      await Promise.all([playerA.save(), playerB.save()]);
      return res.json({ playerA, playerB });
    }

    if (winnerId && loserId) {
      const [winner, loser] = await Promise.all([
        User.findById(winnerId),
        User.findById(loserId)
      ]);
      if (!winner || !loser) return res.status(404).json({ error: 'Player not found' });

      const [newWinnerRating, newLoserRating] = calculateElo(winner.rating, loser.rating, 1, K);
      winner.rating = newWinnerRating;
      winner.wins += 1;
      winner.gamesPlayed += 1;
      loser.rating = newLoserRating;
      loser.losses += 1;
      loser.gamesPlayed += 1;

      await Promise.all([winner.save(), loser.save()]);
      return res.json({ winner, loser });
    }

    res.status(400).json({ error: 'Invalid request body' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function calculateElo(ratingA, ratingB, scoreA, K) {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 - expectedA;
  const newA = Math.round(ratingA + K * (scoreA - expectedA));
  const newB = Math.round(ratingB + K * (1 - scoreA - expectedB));
  return [newA, newB];
}

export default router;
