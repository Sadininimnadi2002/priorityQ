const { body, param, validationResult } = require('express-validator');
const { PRIORITIES, QUEUE_STATUSES, ROLES } = require('../utils/constants');

// Put this AFTER a list of rules. If any rule failed, reply 400 with the details.
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  return res.status(400).json({
    success: false,
    message: 'Validation failed',
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

const idParam = (name = 'id') => [param(name).isMongoId().withMessage(`Invalid ${name}`)];

const registerRules = [
  body('name').trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage('Phone is too long'),
];

const loginRules = [
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

const profileRules = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }).withMessage('Name must be 2-80 characters'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }).withMessage('Phone is too long'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
];

const serviceCreateRules = [
  body('name').trim().notEmpty().withMessage('Service name is required').isLength({ max: 80 }),
  body('code').trim().matches(/^[A-Za-z]{2,5}$/).withMessage('Code must be 2-5 letters'),
  body('description').optional().trim().isLength({ max: 300 }),
  body('avgServiceMinutes').optional().isFloat({ min: 1 }).withMessage('Average minutes must be at least 1'),
];

const serviceUpdateRules = [
  body('name').optional().trim().notEmpty().isLength({ max: 80 }),
  body('code').optional().trim().matches(/^[A-Za-z]{2,5}$/).withMessage('Code must be 2-5 letters'),
  body('description').optional().trim().isLength({ max: 300 }),
  body('avgServiceMinutes').optional().isFloat({ min: 1 }).withMessage('Average minutes must be at least 1'),
];

const serviceStatusRules = [body('isActive').isBoolean().withMessage('isActive must be true or false')];

const joinRules = [body('serviceId').isMongoId().withMessage('A valid serviceId is required')];

const priorityRules = [
  body('priority').isIn(PRIORITIES).withMessage(`Priority must be one of: ${PRIORITIES.join(', ')}`),
  body('reason').trim().isLength({ min: 5, max: 300 }).withMessage('Reason must be 5-300 characters'),
];

const queueStatusRules = [
  body('status').isIn(QUEUE_STATUSES).withMessage(`Status must be one of: ${QUEUE_STATUSES.join(', ')}`),
];

const adminUserCreateRules = [
  ...registerRules,
  body('role').optional().isIn(ROLES).withMessage(`Role must be one of: ${ROLES.join(', ')}`),
  body('assignedService').optional({ nullable: true }).isMongoId().withMessage('Invalid assignedService'),
  body('defaultPriority').optional().isIn(PRIORITIES),
];

const adminUserUpdateRules = [
  body('name').optional().trim().isLength({ min: 2, max: 80 }),
  body('email').optional().trim().isEmail(),
  body('password').optional().isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('phone').optional({ nullable: true }).trim().isLength({ max: 20 }),
  body('role').optional().isIn(ROLES),
  body('isActive').optional().isBoolean(),
  body('defaultPriority').optional().isIn(PRIORITIES),
  body('assignedService').optional({ nullable: true }).isMongoId().withMessage('Invalid assignedService'),
];

const assignRules = [
  body('serviceId').optional({ nullable: true }).isMongoId().withMessage('Invalid serviceId'),
];

module.exports = {
  validate,
  idParam,
  registerRules,
  loginRules,
  profileRules,
  serviceCreateRules,
  serviceUpdateRules,
  serviceStatusRules,
  joinRules,
  priorityRules,
  queueStatusRules,
  adminUserCreateRules,
  adminUserUpdateRules,
  assignRules,
};
