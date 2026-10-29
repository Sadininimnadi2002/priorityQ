const mongoose = require('mongoose');
const { PRIORITIES, STATUSES, ALLOWED_TRANSITIONS } = require('../utils/constants');

const queueEntrySchema = new mongoose.Schema(
  {
    // References (like foreign keys) to other collections
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

    tokenNumber: { type: Number, required: true },
    tokenLabel: { type: String, required: true }, // e.g. "GEN-007"

    priority: { type: String, enum: PRIORITIES, default: 'NORMAL' },
    status: { type: String, enum: STATUSES, default: 'WAITING' },

    joinedAt: { type: Date, default: Date.now },
    calledAt: { type: Date, default: null },
    servingStartedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    skippedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },

    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Indexes make the most common searches fast
queueEntrySchema.index({ service: 1, status: 1 });
queueEntrySchema.index({ user: 1, status: 1 });
// Enforce at the database level that a user can have at most one active token
queueEntrySchema.index(
  { user: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $in: ['WAITING', 'CALLED', 'SERVING'] } },
  }
);

// State machine check: is status -> `to` allowed?
queueEntrySchema.methods.canMoveTo = function (to) {
  return ALLOWED_TRANSITIONS[this.status].includes(to);
};

module.exports = mongoose.model('QueueEntry', queueEntrySchema);
