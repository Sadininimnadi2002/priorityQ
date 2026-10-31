const Notification = require('../models/Notification');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');

// GET /api/notifications  (authenticated)
exports.getNotifications = asyncHandler(async (req, res) => {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50),
    Notification.countDocuments({ user: req.user._id, isRead: false }),
  ]);

  res.json({
    success: true,
    count: notifications.length,
    unreadCount,
    notifications,
  });
});

// PATCH /api/notifications/:id/read  (authenticated)
exports.markAsRead = asyncHandler(async (req, res) => {
  const notification = await Notification.findById(req.params.id);

  if (!notification || String(notification.user) !== String(req.user._id)) {
    throw new AppError('Notification not found', 404);
  }

  notification.isRead = true;
  await notification.save();

  const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });

  res.json({
    success: true,
    notification,
    unreadCount,
  });
});

// PATCH /api/notifications/mark-all-read  (authenticated)
exports.markAllAsRead = asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.user._id, isRead: false },
    { $set: { isRead: true } }
  );

  res.json({
    success: true,
    message: 'All notifications marked as read',
    unreadCount: 0,
  });
});
