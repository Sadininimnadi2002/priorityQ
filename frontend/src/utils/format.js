// Turn any API error into one readable sentence
export const getErrorMessage = (err) => {
  const body = err?.response?.data;
  if (body?.errors?.length) return body.errors.map((e) => e.message).join('. ');
  if (body?.message) return body.message;
  if (err?.request && !err?.response) return 'Cannot reach the server. Check that the backend is running.';
  return err?.message || 'Something went wrong';
};

export const formatMinutes = (minutes) => {
  if (minutes === null || minutes === undefined) return '-';
  if (minutes < 1) return 'Under 1 min';
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m ? `${h} h ${m} min` : `${h} h`;
};

export const formatDateTime = (value) =>
  value ? new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '-';

export const formatTime = (value) =>
  value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';

export const minutesBetween = (from, to) =>
  from && to ? Math.max(0, Math.round((new Date(to) - new Date(from)) / 60000)) : null;

export const homePathForRole = (role) => {
  if (role === 'admin') return '/admin';
  if (role === 'staff') return '/staff';
  return '/dashboard';
};

export const titleCase = (text) => (text ? text.charAt(0) + text.slice(1).toLowerCase() : '');
