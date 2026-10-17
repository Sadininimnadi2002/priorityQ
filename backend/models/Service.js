const mongoose = require('mongoose');
const { QUEUE_STATUSES } = require('../utils/constants');

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Service name is required'],
      unique: true,
      trim: true,
      maxlength: [80, 'Name cannot exceed 80 characters'],
    },
    // Short code used in token labels, e.g. "BIL" -> BIL-001
    code: {
      type: String,
      required: [true, 'Service code is required'],
      unique: true,
      uppercase: true,
      trim: true,
      match: [/^[A-Z]{2,5}$/, 'Code must be 2-5 letters'],
    },
    description: { type: String, trim: true, default: '', maxlength: 300 },
    avgServiceMinutes: {
      type: Number,
      default: 5,
      min: [1, 'Average service time must be at least 1 minute'],
    },
    isActive: { type: Boolean, default: true }, // admin switch
    queueStatus: { type: String, enum: QUEUE_STATUSES, default: 'OPEN' }, // staff switch

    // How many high-priority people were called in a row (used by the fairness rule)
    consecutiveHighServed: { type: Number, default: 0 },

    // Daily token counter: resets to 1 each new day
    tokenCounter: {
      date: { type: String, default: '' },
      seq: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Service', serviceSchema);
