const express = require('express');
const staff = require('../controllers/staffController');
const { protect, authorize } = require('../middleware/auth');
const { validate, idParam, priorityRules, queueStatusRules } = require('../middleware/validators');

const router = express.Router();

// Staff and admins only
router.use(protect, authorize('staff', 'admin'));

router.get('/my-service', staff.getMyService);
router.get('/queues/:serviceId', idParam('serviceId'), validate, staff.getQueue);
router.post('/queues/:serviceId/call-next', idParam('serviceId'), validate, staff.callNext);
router.get('/stats/:serviceId', idParam('serviceId'), validate, staff.getStats);
router.get('/history/:serviceId', idParam('serviceId'), validate, staff.getHistory);
router.patch(
  '/service/:serviceId/queue-status',
  idParam('serviceId'),
  queueStatusRules,
  validate,
  staff.setQueueStatus
);

router.patch('/queue/:id/call', idParam(), validate, staff.callToken);
router.patch('/queue/:id/serve', idParam(), validate, staff.serveToken);
router.patch('/queue/:id/complete', idParam(), validate, staff.completeToken);
router.patch('/queue/:id/skip', idParam(), validate, staff.skipToken);
router.patch('/queue/:id/restore', idParam(), validate, staff.restoreToken);
router.patch('/queue/:id/priority', idParam(), priorityRules, validate, staff.changePriority);

module.exports = router;
