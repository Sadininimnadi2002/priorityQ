// Turn any API error into a clear, user-friendly message
export const getErrorMessage = (err) => {
  if (err?.code === 'ECONNABORTED' || err?.message?.toLowerCase().includes('timeout')) {
    return 'Request timed out. Please check your network connection and try again.';
  }
  if (err?.request && !err?.response) {
    return 'Unable to reach the server. Please verify your internet connection or check if the backend is running.';
  }

  const status = err?.response?.status;
  const body = err?.response?.data;

  if (body?.errors?.length) {
    return body.errors.map((e) => e.message).join('. ');
  }
  if (body?.message) {
    return body.message;
  }

  if (status === 401) {
    return 'Your session has expired. Please log in again to continue.';
  }
  if (status === 403) {
    return 'You do not have permission to perform this action.';
  }
  if (status === 404) {
    return 'The requested queue, token, or service was not found.';
  }
  if (status === 409) {
    return 'A conflict occurred. The token or queue may have already been updated.';
  }
  if (status >= 500) {
    return 'An internal server error occurred. Please try again in a few moments.';
  }

  return err?.message || 'An unexpected error occurred. Please try again.';
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
