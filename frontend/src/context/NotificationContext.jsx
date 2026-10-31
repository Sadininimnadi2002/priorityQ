import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { tokenStorage } from '../services/api';
import { notificationApi } from '../services/endpoints';
import { playNotificationSound } from '../utils/sound';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [activeToast, setActiveToast] = useState(null);
  const [lastQueueUpdate, setLastQueueUpdate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Fetch persisted notifications from MongoDB
  const fetchNotifications = useCallback(async () => {
    if (!tokenStorage.get()) return;
    try {
      setLoading(true);
      const res = await notificationApi.list();
      setNotifications(res.notifications || []);
      setUnreadCount(res.unreadCount || 0);
    } catch (err) {
      // Silent error fallback - application remains functional
    } finally {
      setLoading(false);
    }
  }, []);

  // Dismiss currently active toast popup
  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(null);
  }, []);

  // Display a toast and schedule its auto-dismissal
  const triggerToast = useCallback((notif) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setActiveToast(notif);
    toastTimerRef.current = setTimeout(() => {
      setActiveToast(null);
    }, 9000);
  }, []);

  // Mark single notification as read
  const markAsRead = useCallback(async (id) => {
    try {
      await notificationApi.markRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      // Silent error handling
    }
  }, []);

  // Mark all notifications as read
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      // Silent error handling
    }
  }, []);

  // Initialize Socket.IO connection and notification history when user logs in
  useEffect(() => {
    const token = tokenStorage.get();
    if (!user || !token) {
      setNotifications([]);
      setUnreadCount(0);
      setActiveToast(null);
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return undefined;
    }

    // Load persisted history from MongoDB
    fetchNotifications();

    // Determine backend socket host URL
    const backendUrl =
      import.meta.env.VITE_WS_URL ||
      (import.meta.env.VITE_API_URL
        ? import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '')
        : 'http://localhost:5000');

    const socket = io(backendUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
    });

    socket.on('disconnect', () => {
      setConnected(false);
    });

    socket.on('connect_error', () => {
      setConnected(false);
    });

    // Handle incoming customer-specific real-time notification
    socket.on('notification', (newNotif) => {
      if (!newNotif) return;

      // Prepend to notification list (preventing duplicates if already present)
      setNotifications((prev) => {
        if (prev.some((n) => n._id === newNotif._id)) return prev;
        return [newNotif, ...prev];
      });

      // Increment badge
      setUnreadCount((prev) => prev + 1);

      // Trigger modern toast notification
      triggerToast(newNotif);

      // Play soft audio chime (safeguarded against browser autoplay policies)
      playNotificationSound();
    });

    // Handle incoming customer-specific real-time queue position and status updates
    socket.on('queue:update', (payload) => {
      if (!payload) return;
      setLastQueueUpdate(payload);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, [user, fetchNotifications, triggerToast]);

  const value = {
    notifications,
    unreadCount,
    activeToast,
    lastQueueUpdate,
    loading,
    connected,
    dismissToast,
    markAsRead,
    markAllAsRead,
    fetchNotifications,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used inside <NotificationProvider>');
  return ctx;
}
