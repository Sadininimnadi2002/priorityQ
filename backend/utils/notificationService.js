const Notification = require('../models/Notification');
const { sendNotificationToUser } = require('./socket');

/**
 * Creates and persists a notification in MongoDB, then emits it in real-time
 * to the authenticated customer's private room.
 *
 * Enforces idempotency to prevent duplicate notifications for the same queue event.
 */
async function notifyQueueEvent({
  user,
  queueEntry,
  service,
  type,
  title,
  message,
  tokenLabel = '',
  serviceName = '',
}) {
  try {
    const userId = user && (user._id || user);
    const queueEntryId = queueEntry && (queueEntry._id || queueEntry);
    const serviceId = service && (service._id || service);

    if (!userId || !queueEntryId) {
      return null;
    }

    // 1. Check if a notification for this specific event already exists
    let notification = await Notification.findOne({
      queueEntry: queueEntryId,
      type,
    });

    if (!notification) {
      notification = await Notification.create({
        user: userId,
        queueEntry: queueEntryId,
        service: serviceId || null,
        type,
        title,
        message,
        tokenLabel: tokenLabel || queueEntry.tokenLabel || '',
        serviceName: serviceName || (service && service.name) || '',
        isRead: false,
      });
    }

    // 2. Deliver via Socket.IO directly to the customer's private room
    sendNotificationToUser(userId, notification);

    return notification;
  } catch (err) {
    // Handle concurrent duplicate insertion gracefully
    if (err.code === 11000) {
      const queueEntryId = queueEntry && (queueEntry._id || queueEntry);
      return await Notification.findOne({ queueEntry: queueEntryId, type });
    }
    console.error('[NotificationService] Error creating notification:', err.message);
    return null;
  }
}

/**
 * Notifies all customers with active waiting tokens in a service when the queue is paused or resumed.
 * Creates persistent notifications in MongoDB and delivers them in real-time to authenticated customer rooms.
 * Prevents duplicate notifications when requests do not actually change status.
 */
async function notifyQueueStatusChange({ service, newStatus, prevStatus }) {
  if (!service || !newStatus || newStatus === prevStatus) return [];

  // Only PAUSED and RESUMED (OPEN from PAUSED) trigger notifications
  if (newStatus !== 'PAUSED' && !(newStatus === 'OPEN' && prevStatus === 'PAUSED')) {
    return [];
  }

  const QueueEntry = require('../models/QueueEntry');
  const serviceId = service._id || service;
  const serviceName = service.name || 'Service';

  // Find all customers with active waiting tokens in this service
  const waitingEntries = await QueueEntry.find({
    service: serviceId,
    status: 'WAITING',
  }).populate('user', 'name email');

  if (waitingEntries.length === 0) return [];

  const isPause = newStatus === 'PAUSED';
  const type = isPause ? 'QUEUE_PAUSED' : 'QUEUE_RESUMED';
  const title = isPause ? 'Queue Temporarily Paused' : 'Queue Resumed';
  const message = isPause
    ? `The ${serviceName} queue has been temporarily paused. Please wait for further updates.`
    : `The ${serviceName} queue is now active. Your queue position and estimated waiting time have been updated.`;

  const notifications = [];

  for (const entry of waitingEntries) {
    const userId = entry.user?._id || entry.user;
    if (!userId) continue;

    try {
      const notif = await Notification.create({
        user: userId,
        queueEntry: entry._id,
        service: serviceId,
        type,
        title,
        message,
        tokenLabel: entry.tokenLabel,
        serviceName,
        isRead: false,
      });

      sendNotificationToUser(userId, notif);
      notifications.push(notif);
    } catch (err) {
      console.error('[NotificationService] Failed to notify customer for queue status change:', err.message);
    }
  }

  return notifications;
}

module.exports = {
  notifyQueueEvent,
  notifyQueueStatusChange,
};
