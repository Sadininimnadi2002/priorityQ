import api from './api';

// Every function returns the response body (res.data), so pages never touch axios directly
const data = (promise) => promise.then((res) => res.data);

export const authApi = {
  register: (body) => data(api.post('/auth/register', body)),
  login: (body) => data(api.post('/auth/login', body)),
  me: () => data(api.get('/auth/me')),
  updateMe: (body) => data(api.put('/auth/me', body)),
};

export const servicesApi = {
  list: (params) => data(api.get('/services', { params })),
  get: (id) => data(api.get(`/services/${id}`)),
  create: (body) => data(api.post('/services', body)),
  update: (id, body) => data(api.put(`/services/${id}`, body)),
  setActive: (id, isActive) => data(api.patch(`/services/${id}/status`, { isActive })),
  remove: (id) => data(api.delete(`/services/${id}`)),
};

export const queueApi = {
  join: (serviceId) => data(api.post('/queue/join', { serviceId })),
  myActive: () => data(api.get('/queue/my-active')),
  history: () => data(api.get('/queue/history')),
  leave: (id) => data(api.delete(`/queue/${id}/leave`)),
};

export const staffApi = {
  myService: () => data(api.get('/staff/my-service')),
  queue: (serviceId) => data(api.get(`/staff/queues/${serviceId}`)),
  callNext: (serviceId) => data(api.post(`/staff/queues/${serviceId}/call-next`)),
  call: (id) => data(api.patch(`/staff/queue/${id}/call`)),
  serve: (id) => data(api.patch(`/staff/queue/${id}/serve`)),
  complete: (id) => data(api.patch(`/staff/queue/${id}/complete`)),
  skip: (id) => data(api.patch(`/staff/queue/${id}/skip`)),
  restore: (id) => data(api.patch(`/staff/queue/${id}/restore`)),
  changePriority: (id, priority, reason) => data(api.patch(`/staff/queue/${id}/priority`, { priority, reason })),
  setQueueStatus: (serviceId, status) => data(api.patch(`/staff/service/${serviceId}/queue-status`, { status })),
  stats: (serviceId) => data(api.get(`/staff/stats/${serviceId}`)),
  history: (serviceId, params) => data(api.get(`/staff/history/${serviceId}`, { params })),
};

export const adminApi = {
  listUsers: (params) => data(api.get('/admin/users', { params })),
  createUser: (body) => data(api.post('/admin/users', body)),
  updateUser: (id, body) => data(api.put(`/admin/users/${id}`, body)),
  deleteUser: (id) => data(api.delete(`/admin/users/${id}`)),
  assignStaff: (id, serviceId) => data(api.patch(`/admin/staff/${id}/assign`, { serviceId })),
  queues: () => data(api.get('/admin/queues')),
  priorityLogs: (params) => data(api.get('/admin/priority-logs', { params })),
  stats: () => data(api.get('/admin/stats')),
  reports: (days) => data(api.get('/admin/reports', { params: { days } })),
  analytics: (params) => data(api.get('/admin/analytics', { params })),
};

export const notificationApi = {
  list: () => data(api.get('/notifications')),
  markRead: (id) => data(api.patch(`/notifications/${id}/read`)),
  markAllRead: () => data(api.patch('/notifications/mark-all-read')),
};

