const Service = require('../models/Service');
const QueueEntry = require('../models/QueueEntry');
const { buildQueueView, describeWaiting } = require('./queueService');
const { sendQueueUpdateToUser } = require('./socket');

/**
 * Calculates current queue positions and wait estimates using the backend priority engine,
 * and emits live updates to every customer in the service via their secure Socket.IO user room.
 */
async function broadcastQueueUpdatesForService(serviceId) {
  if (!serviceId) return;
  try {
    const service = await Service.findById(serviceId);
    if (!service) return;

    const view = await buildQueueView(service);
    const updatedAt = new Date().toISOString();

    // 1. Broadcast to each waiting customer their calculated position & ETA
    view.ordered.forEach((item, index) => {
      const info = describeWaiting(item, index, view);
      const userId = item.entry.user?._id || item.entry.user;
      if (!userId) return;

      const queueInfo = {
        position: info.position,
        peopleAhead: info.peopleAhead,
        estimatedWaitMinutes: info.estimatedWaitMinutes,
        avgMinutes: view.avgMinutes,
        effectivePriority: info.effectivePriority,
        boosted: info.boosted,
        queueStatus: service.queueStatus,
        totalWaiting: view.ordered.length,
      };

      sendQueueUpdateToUser(userId, {
        entry: info,
        queueInfo,
        updatedAt,
      });
    });

    // 2. Broadcast to each in-progress customer (CALLED or SERVING)
    view.inProgress.forEach((entry) => {
      const userId = entry.user?._id || entry.user;
      if (!userId) return;

      const queueInfo = {
        position: 0,
        peopleAhead: 0,
        estimatedWaitMinutes: 0,
        avgMinutes: view.avgMinutes,
        effectivePriority: entry.priority,
        boosted: false,
        queueStatus: service.queueStatus,
        totalWaiting: view.ordered.length,
      };

      sendQueueUpdateToUser(userId, {
        entry,
        queueInfo,
        updatedAt,
      });
    });
  } catch (err) {
    // Graceful error recovery: log error but do not crash calling controller
    console.error('Failed to broadcast queue updates for service:', err);
  }
}

/**
 * Sends a terminal status update (COMPLETED, SKIPPED, CANCELLED) to an individual customer.
 */
async function notifyCustomerTerminalUpdate(entry, service) {
  if (!entry) return;
  try {
    const userId = entry.user?._id || entry.user;
    if (!userId) return;

    const updatedAt = new Date().toISOString();
    const avgMinutes = service?.avgServiceMinutes || 10;
    const queueStatus = service?.queueStatus || 'OPEN';

    sendQueueUpdateToUser(userId, {
      entry,
      queueInfo: {
        position: 0,
        peopleAhead: 0,
        estimatedWaitMinutes: 0,
        avgMinutes,
        effectivePriority: entry.priority,
        boosted: false,
        queueStatus,
        totalWaiting: 0,
      },
      updatedAt,
    });
  } catch (err) {
    console.error('Failed to notify customer terminal update:', err);
  }
}

module.exports = {
  broadcastQueueUpdatesForService,
  notifyCustomerTerminalUpdate,
};
