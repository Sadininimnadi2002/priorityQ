const Service = require('../models/Service');
const User = require('../models/User');
const QueueEntry = require('../models/QueueEntry');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { getServiceCounts, withQueueInfo } = require('../utils/queueService');

// GET /api/services  (public). Admins can add ?includeInactive=true
exports.getServices = asyncHandler(async (req, res) => {
  const filter = {};
  const isAdmin = req.user && req.user.role === 'admin';
  if (!(isAdmin && req.query.includeInactive === 'true')) filter.isActive = true;

  const services = await Service.find(filter).sort({ name: 1 });
  const counts = await getServiceCounts(services.map((s) => s._id));

  res.json({ success: true, count: services.length, services: services.map((s) => withQueueInfo(s, counts)) });
});

// GET /api/services/:id  (public)
exports.getService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);
  const counts = await getServiceCounts([service._id]);
  res.json({ success: true, service: withQueueInfo(service, counts) });
});

// POST /api/services  (admin)
exports.createService = asyncHandler(async (req, res) => {
  const { name, code, description, avgServiceMinutes } = req.body;
  const service = await Service.create({ name, code, description, avgServiceMinutes });
  res.status(201).json({ success: true, service });
});

// PUT /api/services/:id  (admin)
exports.updateService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);

  ['name', 'code', 'description', 'avgServiceMinutes'].forEach((field) => {
    if (req.body[field] !== undefined) service[field] = req.body[field];
  });

  await service.save();
  res.json({ success: true, service });
});

// PATCH /api/services/:id/status  (admin) - activate / deactivate
exports.setServiceStatus = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);

  const isActive = req.body.isActive === true || req.body.isActive === 'true';
  service.isActive = isActive;
  if (!isActive) service.queueStatus = 'CLOSED'; // no new joins while deactivated
  await service.save();

  res.json({ success: true, service });
});

// DELETE /api/services/:id  (admin)
exports.deleteService = asyncHandler(async (req, res) => {
  const service = await Service.findById(req.params.id);
  if (!service) throw new AppError('Service not found', 404);

  const hasEntries = await QueueEntry.exists({ service: service._id });
  if (hasEntries) {
    throw new AppError('This service has queue history and cannot be deleted. Deactivate it instead.', 409);
  }

  await User.updateMany({ assignedService: service._id }, { assignedService: null });
  await service.deleteOne();
  res.json({ success: true, message: 'Service deleted' });
});
