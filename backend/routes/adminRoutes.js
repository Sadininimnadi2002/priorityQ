const express = require('express');
const admin = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');
const {
  validate,
  idParam,
  adminUserCreateRules,
  adminUserUpdateRules,
  assignRules,
} = require('../middleware/validators');

const router = express.Router();

// Admins only
router.use(protect, authorize('admin'));

router.get('/users', admin.listUsers);
router.post('/users', adminUserCreateRules, validate, admin.createUser);
router.get('/users/:id', idParam(), validate, admin.getUser);
router.put('/users/:id', idParam(), adminUserUpdateRules, validate, admin.updateUser);
router.delete('/users/:id', idParam(), validate, admin.deleteUser);

router.patch('/staff/:id/assign', idParam(), assignRules, validate, admin.assignStaff);

router.get('/queues', admin.getActiveQueues);
router.get('/priority-logs', admin.getPriorityLogs);
router.get('/stats', admin.getStats);
router.get('/reports', admin.getReports);
router.get('/analytics', admin.getAnalytics);

module.exports = router;
