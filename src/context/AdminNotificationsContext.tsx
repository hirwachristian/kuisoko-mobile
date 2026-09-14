import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { fetchOrders, fetchUsers, fetchAdminUnreadCount, fetchEnquiryUnreadCount } from '../api/admin';

// Ports the website's per-nav-item sidebar badges (frontend/components/AdminLayout.tsx +
// AppContext.tsx's unreadOrderCount/unreadUserCount/chatAdminUnreadCount/enquiryUnreadCount) onto
// the mobile bottom tab bar. The website recomputes these from a 10s poll (AppContext.tsx's
// notificationPollTick) plus optimistic updates right after an admin marks something read; this
// does the same with a plain interval instead of a shared poll tick, since each admin screen here
// already fetches its own data independently.
const POLL_MS = 15000;

interface AdminNotificationsValue {
  pendingOrdersCount: number;
  unreadUsersCount: number;
  chatUnreadCount: number;
  enquiryUnreadCount: number;
  // "More" tab aggregates the two sections inside it that carry unread badges on the website
  // (Messages + Enquiries) - Returns has no badge requested here, matching the user's ask.
  moreCount: number;
  refresh: () => void;
}

const AdminNotificationsContext = createContext<AdminNotificationsValue | undefined>(undefined);

export const AdminNotificationsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, user } = useAuth();
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [unreadUsersCount, setUnreadUsersCount] = useState(0);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);
  const [enquiryUnreadCount, setEnquiryUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(() => {
    if (!token || user?.role !== 'admin') return;
    // Each count is independent of the others (mirrors the website's split fetches) so one
    // endpoint failing doesn't blank out the badges that did succeed.
    fetchOrders(token)
      .then(({ orders }) => setPendingOrdersCount(orders.filter((o) => o.status === 'Pending').length))
      .catch(() => {});
    fetchUsers(token)
      .then(({ users }) => setUnreadUsersCount(users.filter((u) => u.unread).length))
      .catch(() => {});
    fetchAdminUnreadCount(token)
      .then(({ count }) => setChatUnreadCount(count))
      .catch(() => {});
    fetchEnquiryUnreadCount(token)
      .then(({ count }) => setEnquiryUnreadCount(count))
      .catch(() => {});
  }, [token, user?.role]);

  useEffect(() => {
    if (!token || user?.role !== 'admin') {
      setPendingOrdersCount(0);
      setUnreadUsersCount(0);
      setChatUnreadCount(0);
      setEnquiryUnreadCount(0);
      return;
    }
    refresh();
    intervalRef.current = setInterval(refresh, POLL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, user?.role, refresh]);

  return (
    <AdminNotificationsContext.Provider
      value={{
        pendingOrdersCount,
        unreadUsersCount,
        chatUnreadCount,
        enquiryUnreadCount,
        moreCount: chatUnreadCount + enquiryUnreadCount,
        refresh,
      }}
    >
      {children}
    </AdminNotificationsContext.Provider>
  );
};

export const useAdminNotifications = () => {
  const ctx = useContext(AdminNotificationsContext);
  if (!ctx) throw new Error('useAdminNotifications must be used within an AdminNotificationsProvider');
  return ctx;
};
