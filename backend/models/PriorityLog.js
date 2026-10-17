const mongoose = require('mongoose');
const { PRIORITIES } = require('../utils/constants');

// Audit trail: one document each time a staff member changes a token's priority
const priorityLogSchema = new mongoose.Schema(
  {
    queueEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'QueueEntry', required: true },
    service: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    oldPriority: { type: String, enum: PRIORITIES, required: true },
    newPriority: { type: String, enum: PRIORITIES, required: true },
    reason: {
      type: String,
      required: [true, 'A reason is required'],
      trim: true,
      minlength: [5, 'Reason must be at least 5 characters'],
      maxlength: [300, 'Reason cannot exceed 300 characters'],
    },
  },
  { timestamps: true }
);

priorityLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model('PriorityLog', priorityLogSchema);
