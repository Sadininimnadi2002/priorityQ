const express = require('express');
const { joinQueue, getMyActive, getHistory, leaveQueue } = require('../controllers/queueController');
const { protect, authorize } = require('../middleware/auth');
const { validate, idParam, joinRules } = require('../middleware/validators');

const router = express.Router();

// Customers only
router.use(protect, authorize('user'));

router.post('/join', joinRules, validate, joinQueue);
router.get('/my-active', getMyActive);
router.get('/history', getHistory);
router.delete('/:id/leave', idParam(), validate, leaveQueue);

module.exports = router;
