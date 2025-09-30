import React, { useState, useEffect } from 'react';
import { Bell, Pin, AlertCircle, Info, Calendar, X } from 'lucide-react';
import { Announcement } from '../types';
import { getAnnouncements, markAnnouncementAsRead } from '../services/supabaseService';
import { useAuth } from '../hooks/useAuth';

interface AnnouncementsPanelProps {
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export function AnnouncementsPanel({ onClose, onUnreadCountChange }: AnnouncementsPanelProps) {
  const { profile } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);

  useEffect(() => {
    if (profile) {
      loadAnnouncements();
    }
  }, [profile]);

  const loadAnnouncements = async () => {
    if (!profile) return;
    
    try {
      setLoading(true);
      const data = await getAnnouncements(profile.id, profile.role);
      setAnnouncements(data);
      
      // Update unread count
      const unreadCount = data.filter(a => !a.is_read).length;
      onUnreadCountChange?.(unreadCount);
    } catch (error) {
      console.error('Failed to load announcements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAnnouncementClick = async (announcement: Announcement) => {
    setSelectedAnnouncement(announcement);
    
    // Mark as read if student and not already read
    if (profile?.role === 'student' && !announcement.is_read) {
      try {
        await markAnnouncementAsRead(announcement.id, profile.id);
        setAnnouncements(prev => 
          prev.map(a => a.id === announcement.id ? { ...a, is_read: true } : a)
        );
        
        // Update unread count
        const unreadCount = announcements.filter(a => 
          a.id === announcement.id ? false : !a.is_read
        ).length;
        onUnreadCountChange?.(unreadCount);
      } catch (error) {
        console.error('Failed to mark announcement as read:', error);
      }
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'high':
        return <AlertCircle className="w-5 h-5 text-orange-500" />;
      case 'normal':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Info className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityBadge = (priority: string) => {
    const styles = {
      urgent: 'bg-red-500/20 text-red-400 border-red-500/30',
      high: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      normal: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      low: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    
    return (
      <span className={`px-2 py-0.5 text-xs font-semibold rounded border ${styles[priority as keyof typeof styles]}`}>
        {priority.toUpperCase()}
      </span>
    );
  };

  const formatDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-[var(--color-sidebar)] rounded-xl p-8 max-w-md w-full mx-4">
          <div className="flex items-center justify-center">
            <div className="animate-shimmer h-8 w-48 rounded" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[var(--color-sidebar)] rounded-xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col border border-[var(--color-border)] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/20 rounded-lg">
              <Bell className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Announcements</h2>
              <p className="text-sm text-gray-400">
                {announcements.length} total
                {profile?.role === 'student' && announcements.filter(a => !a.is_read).length > 0 && (
                  <span className="ml-2 text-blue-400">
                    • {announcements.filter(a => !a.is_read).length} unread
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[var(--color-card)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {announcements.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-gray-800/50 rounded-full mb-4">
                <Bell className="w-12 h-12 text-gray-500" />
              </div>
              <h3 className="text-xl font-semibold text-gray-300 mb-2">No Announcements</h3>
              <p className="text-gray-500">Check back later for updates from your teachers</p>
            </div>
          ) : (
            <div className="space-y-3">
              {announcements.map((announcement) => (
                <div
                  key={announcement.id}
                  onClick={() => handleAnnouncementClick(announcement)}
                  className={`
                    p-4 rounded-xl border transition-all cursor-pointer
                    ${announcement.is_pinned 
                      ? 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/15' 
                      : 'bg-[var(--color-card)] border-[var(--color-border)] hover:bg-[var(--color-card)]/80'
                    }
                    ${!announcement.is_read && profile?.role === 'student'
                      ? 'ring-2 ring-blue-500/30'
                      : ''
                    }
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-1">
                      {getPriorityIcon(announcement.priority)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {announcement.is_pinned && (
                            <Pin className="w-4 h-4 text-blue-400 flex-shrink-0" />
                          )}
                          <h3 className="text-lg font-semibold text-white line-clamp-1">
                            {announcement.title}
                          </h3>
                          {!announcement.is_read && profile?.role === 'student' && (
                            <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full">
                              NEW
                            </span>
                          )}
                        </div>
                        {getPriorityBadge(announcement.priority)}
                      </div>
                      
                      <p className="text-gray-300 text-sm mb-3 line-clamp-2">
                        {announcement.content}
                      </p>
                      
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {formatDate(announcement.created_at)}
                        </span>
                        {announcement.teacher_name && (
                          <span>By {announcement.teacher_name}</span>
                        )}
                        {announcement.expires_at && (
                          <span className="text-orange-400">
                            Expires {formatDate(announcement.expires_at)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedAnnouncement && (
        <div 
          className="fixed inset-0 bg-black/70 z-60 flex items-center justify-center p-4"
          onClick={() => setSelectedAnnouncement(null)}
        >
          <div 
            className="bg-[var(--color-sidebar)] rounded-xl max-w-2xl w-full p-6 border border-[var(--color-border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {getPriorityIcon(selectedAnnouncement.priority)}
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {selectedAnnouncement.is_pinned && (
                      <Pin className="w-4 h-4 text-blue-400" />
                    )}
                    <h3 className="text-2xl font-bold text-white">
                      {selectedAnnouncement.title}
                    </h3>
                  </div>
                  {getPriorityBadge(selectedAnnouncement.priority)}
                </div>
              </div>
              <button
                onClick={() => setSelectedAnnouncement(null)}
                className="p-2 hover:bg-[var(--color-card)] rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="prose prose-invert max-w-none mb-4">
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                {selectedAnnouncement.content}
              </p>
            </div>

            <div className="flex items-center gap-4 text-sm text-gray-500 pt-4 border-t border-[var(--color-border)]">
              <span className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                Posted {formatDate(selectedAnnouncement.created_at)}
              </span>
              {selectedAnnouncement.teacher_name && (
                <span>By {selectedAnnouncement.teacher_name}</span>
              )}
              {selectedAnnouncement.expires_at && (
                <span className="text-orange-400">
                  Expires {formatDate(selectedAnnouncement.expires_at)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
