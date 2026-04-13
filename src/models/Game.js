import mongoose from 'mongoose';

const moveSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    promotion: String,
    san: String,
    fen: String,
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const gameSchema = new mongoose.Schema(
  {
    gameId: {
      type: String,
      required: true,
      unique: true
    },
    white: {
      type: String,
      default: 'Anonymous'
    },
    black: {
      type: String,
      default: 'Anonymous'
    },
    whiteId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    blackId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null
    },
    moves: [moveSchema],
    pgn: {
      type: String,
      default: ''
    },
    fen: {
      type: String,
      default: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
    },
    status: {
      type: String,
      enum: ['waiting', 'active', 'completed', 'aborted'],
      default: 'waiting'
    },
    result: {
      type: String,
      enum: ['white', 'black', 'draw', null],
      default: null
    },
    termination: {
      type: String,
      default: null
    },
    timeControl: {
      type: String,
      default: null
    },
    whiteTime: {
      type: Number,
      default: null
    },
    blackTime: {
      type: Number,
      default: null
    }
  },
  { timestamps: true }
);

const Game = mongoose.model('Game', gameSchema);
export default Game;
