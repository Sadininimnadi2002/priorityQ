const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    queueEntry: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'QueueEntry',
      required: [true, 'Queue entry ID is required'],
      index: true,
    },
    service: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    type: {
      type: String,
      enum: [
        'TOKEN_CALLED',
        'TOKEN_SERVING',
        'TOKEN_COMPLETED',
        'TOKEN_SKIPPED',
        'QUEUE_PAUSED',
        'QUEUE_RESUMED',
      ],
      required: [true, 'Notification type is required'],
    },
    title: {
      type: String,
      required: [true, 'Notification title is required'],
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Notification message is required'],
      trim: true,
    },
    tokenLabel: {
      type: String,
      default: '',
      trim: true,
    },
    serviceName: {
      type: String,
      default: '',
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true }
);

// Enforce unique notification for singular lifecycle events (prevents duplicates)
notificationSchema.index(
  { queueEntry: 1, type: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: { $in: ['TOKEN_CALLED', 'TOKEN_SERVING', 'TOKEN_COMPLETED', 'TOKEN_SKIPPED'] },
    },
  }
);
notificationSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
