import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { createAnnouncement, updateAnnouncement } from '../services/supabaseService';
import { Announcement } from '../types';
import { X, Save, Loader2, AlertTriangle, Pin, Bell } from 'lucide-react';

interface CreateAnnouncementModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  announcementToEdit?: Announcement | null;
}

export function CreateAnnouncementModal({ isOpen, onClose, onSave, announcementToEdit }: CreateAnnouncementModalProps) {
  const { profile } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [priority, setPriority] = useState<'low' | 'normal' | 'high' | 'urgent'>('normal');
  const [isPinned, setIsPinned] = useState(false);
  const [expiresAt, setExpiresAt] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!announcementToEdit;

  useEffect(() => {
    if (announcementToEdit) {
      setTitle(announcementToEdit.title);
      setContent(announcementToEdit.content);
      setPriority(announcementToEdit.priority);
      setIsPinned(announcementToEdit.is_pinned);
      setExpiresAt(announcementToEdit.expires_at ? new Date(announcementToEdit.expires_at).toISOString().split('T')[0] : '');
    } else {
      // Reset form for creation
      setTitle('');
      setContent('');
      setPriority('normal');
      setIsPinned(false);
      setExpiresAt('');
    }
    setError(null);
  }, [announcementToEdit, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const expirationDate = expiresAt ? new Date(expiresAt) : undefined;

      if (isEditing && announcementToEdit) {
        await updateAnnouncement(announcementToEdit.id, {
          title,
          content,
          priority,
          is_pinned: isPinned,
          expires_at: expirationDate,
        });
      } else {
        await createAnnouncement(
          profile.id,
          title,
          content,
          priority,
          isPinned,
          expirationDate
        );
      }
      onSave();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save announcement.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div 
        className="bg-[var(--color-card)] rounded-xl shadow-xl max-w-2xl w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Bell size={20}/> {isEditing ? 'Edit' : 'Create'} Announcement
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-[var(--color-border)] rounded-lg">
            <X size={18}/>
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-900/30 border border-red-500/30 rounded-lg text-red-400">
                <AlertTriangle size={16} />
                <span className="text-sm">{error}</span>
              </div>
            )}
            <div>
              <label className="input-label">Title *</label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Important: Midterm Exam Schedule"
                required
                className="input-style"
              />
            </div>
            <div>
              <label className="input-label">Content *</label>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Describe the announcement in detail..."
                required
                rows={5}
                className="input-style"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="input-label">Priority</label>
                <select value={priority} onChange={e => setPriority(e.target.value as any)} className="input-style">
                  <option value="low">Low</option>
                  <option value="normal">Normal</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="input-label">Expiration Date (Optional)</label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={e => setExpiresAt(e.target.value)}
                  className="input-style"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isPinned"
                checked={isPinned}
                onChange={e => setIsPinned(e.target.checked)}
                className="rounded border-gray-600 text-blue-500 focus:ring-blue-500 focus:ring-2"
              />
              <label htmlFor="isPinned" className="flex items-center gap-1 text-sm text-gray-300">
                <Pin size={14}/> Pin this announcement to the top
              </label>
            </div>
          </div>
          <div className="p-4 bg-gray-900/50 border-t border-[var(--color-border)] flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary w-auto px-6 py-2"
            >
              {isSubmitting ? (
                <><Loader2 size={16} className="animate-spin mr-2"/> Saving...</>
              ) : (
                <><Save size={16} className="mr-2"/> {isEditing ? 'Save Changes' : 'Post Announcement'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
