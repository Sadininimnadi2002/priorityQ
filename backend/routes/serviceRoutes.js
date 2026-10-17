const express = require('express');
const {
  getServices,
  getService,
  createService,
  updateService,
  setServiceStatus,
  deleteService,
} = require('../controllers/serviceController');
const { protect, authorize, optionalAuth } = require('../middleware/auth');
const {
  validate,
  idParam,
  serviceCreateRules,
  serviceUpdateRules,
  serviceStatusRules,
} = require('../middleware/validators');

const router = express.Router();

// Public
router.get('/', optionalAuth, getServices);
router.get('/:id', idParam(), validate, getService);

// Admin only
router.post('/', protect, authorize('admin'), serviceCreateRules, validate, createService);
router.put('/:id', protect, authorize('admin'), idParam(), serviceUpdateRules, validate, updateService);
router.patch('/:id/status', protect, authorize('admin'), idParam(), serviceStatusRules, validate, setServiceStatus);
router.delete('/:id', protect, authorize('admin'), idParam(), validate, deleteService);

module.exports = router;
