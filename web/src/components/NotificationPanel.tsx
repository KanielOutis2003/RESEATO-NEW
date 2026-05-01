import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth/useAuth";
import {
  listMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type AppNotification,
} from "../lib/api/notifications.api";

export default function NotificationPanel({ variant }: { variant: "vendor" | "admin" }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  const fetchNotifications = useCallback(async () => {
    try {
      const data = await listMyNotifications();
      setNotifications(data);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchNotifications();
    if (!user) return;
    const channelName = variant === "admin" ? "admin-notif-panel" : "vendor-notif-panel";
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => [row, ...prev]);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as AppNotification;
          setNotifications((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchNotifications, user, variant]);

  async function handleMarkRead(id: string) {
    try {
      await markNotificationRead(id);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    } catch { /* ignore */ }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    } catch { /* ignore */ }
  }

  const isAdmin = variant === "admin";
  const accentBg = isAdmin ? "bg-[#3153a1]" : "bg-[#8b3d4a]";
  const accentText = isAdmin ? "text-[#3153a1]" : "text-[#8b3d4a]";
  const dotColor = isAdmin ? "bg-[#6f89c8]" : "bg-[#b76a73]";
  const hoverBg = isAdmin ? "hover:bg-[#f0f3fa]" : "hover:bg-[#faf5f6]";

  return (
    <aside className="hidden lg:flex w-[300px] shrink-0 flex-col border-l border-[#e5e7eb] bg-white">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#e5e7eb] bg-white px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Bell className={`h-4 w-4 ${accentText}`} />
          <span className="text-sm font-bold text-[#1f2937]">Notifications</span>
          {unreadCount > 0 && (
            <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full ${accentBg} px-1.5 text-[10px] font-bold text-white`}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className={`flex items-center gap-1 text-[10px] font-semibold ${accentText} hover:opacity-80 transition`}
          >
            <Check className="h-3 w-3" /> Mark all
          </button>
        )}
      </div>

      {/* Notification list */}
      <div className="flex-1 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-8 w-8 text-[#d1d5db] mb-3" />
            <p className="text-sm text-[#9ca3af]">No notifications yet</p>
          </div>
        ) : (
          notifications.slice(0, 50).map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => {
                if (!n.is_read) handleMarkRead(n.id);
                if (n.link) navigate(n.link);
              }}
              className={`w-full text-left px-4 py-3 border-b border-[#f3f4f6] transition ${hoverBg} ${
                n.is_read ? "opacity-55" : ""
              }`}
            >
              <div className="flex items-start gap-2.5">
                {!n.is_read && <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${dotColor}`} />}
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[#1f2937] truncate">{n.title}</div>
                  <div className="text-[11px] text-[#6b7280] line-clamp-2 mt-0.5">{n.body}</div>
                  <div className="text-[10px] text-[#9ca3af] mt-1">
                    {new Date(n.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
