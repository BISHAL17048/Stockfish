import express from 'express';
import { Chess } from 'chess.js';

const router = express.Router();

// POST /api/ai/review - analyze a game and return move evaluations
router.post('/review', (req, res) => {
  try {
    const { pgn, moves, fens } = req.body;

    if (!pgn && !moves && !fens) {
      return res.status(400).json({ error: 'pgn, moves, or fens is required' });
    }

    const chess = new Chess();
    const review = [];

    if (pgn) {
      chess.loadPgn(pgn);
      const history = chess.history({ verbose: true });
      chess.reset();

      for (const move of history) {
        chess.move(move);
        review.push({
          move: move.san,
          from: move.from,
          to: move.to,
          fen: chess.fen(),
          comment: classifyMove(move)
        });
      }
    } else if (fens && Array.isArray(fens)) {
      for (let i = 0; i < fens.length; i++) {
        review.push({
          fen: fens[i],
          moveIndex: i,
          comment: 'Position recorded'
        });
      }
    }

    res.json({ review, total: review.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ai/hint - get a hint for the current position
router.post('/hint', (req, res) => {
  try {
    const { fen } = req.body;
    if (!fen) return res.status(400).json({ error: 'fen is required' });

    const chess = new Chess(fen);
    const legalMoves = chess.moves({ verbose: true });

    if (legalMoves.length === 0) {
      return res.json({ hint: null, message: 'No legal moves available' });
    }

    // Return a random legal move as a hint
    const hint = legalMoves[Math.floor(Math.random() * legalMoves.length)];
    res.json({ hint: { from: hint.from, to: hint.to, san: hint.san } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function classifyMove(move) {
  if (move.flags.includes('c') || move.flags.includes('e')) return 'capture';
  if (move.flags.includes('p')) return 'promotion';
  if (move.flags.includes('k') || move.flags.includes('q')) return 'castle';
  return 'normal';
}

export default router;
