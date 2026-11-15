"use client";

import * as React from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink, X } from "lucide-react";
import { markNotificationAsReadAction } from "@/app/actions/governance";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

export function NotificationsPopover({
  initialNotifications,
}: {
  initialNotifications: NotificationItem[];
}) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>(initialNotifications);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // Close on outside click
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    await markNotificationAsReadAction(id);
  };

  return (
    <div className="relative" ref={popoverRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 bg-[#F4F1E8] brutal-border hover:bg-[#DDEBDD] transition-colors cursor-pointer"
        title="Notifications"
        aria-label="View notifications"
      >
        <Bell className="w-4 h-4 text-[#17251C]" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#D94C4C] text-white font-mono text-[9px] font-bold flex items-center justify-center rounded-full">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white brutal-card brutal-shadow p-0 z-50 overflow-hidden">
          <div className="p-3 bg-[#F4F1E8] border-b-2 border-[#253C2B] flex items-center justify-between">
            <span className="font-mono text-xs font-bold text-[#17251C] uppercase flex items-center space-x-1.5">
              <Bell className="w-3.5 h-3.5 text-[#16834A]" />
              <span>NOTIFICATIONS ({unreadCount} UNREAD)</span>
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-[#DDEBDD] brutal-border text-[#17251C]"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#253C2B]">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-xs font-mono text-[#637367]">
                No notifications logged.
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 text-xs font-mono transition-colors ${
                    n.is_read ? "bg-white text-[#637367]" : "bg-[#F4F1E8] text-[#17251C] font-semibold"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold block text-[11px] text-[#17251C]">
                      {n.title}
                    </span>
                    <span className="text-[9px] text-[#637367] whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#637367] mt-1 leading-snug">
                    {n.message}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1 border-t border-[#253C2B]/20">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => {
                          handleMarkAsRead(n.id);
                          setIsOpen(false);
                        }}
                        className="text-[10px] text-[#16834A] font-bold hover:underline inline-flex items-center space-x-1"
                      >
                        <span>VIEW DETAILS</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </Link>
                    ) : <span />}

                    {!n.is_read && (
                      <button
                        onClick={(e) => handleMarkAsRead(n.id, e)}
                        className="text-[10px] text-[#17251C] hover:text-[#16834A] inline-flex items-center space-x-1"
                      >
                        <Check className="w-3 h-3" />
                        <span>MARK READ</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
