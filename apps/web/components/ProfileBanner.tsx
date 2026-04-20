'use client';

import React, { useRef, useState } from 'react';
import { Camera } from 'lucide-react';
import { Avatar } from './Avatar';
import { toast } from 'sonner';

interface ProfileBannerProps {
  title: string;
  subtitle?: string;
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  initials?: string;
  onAvatarUpload?: (file: File) => Promise<void>;
  onBannerUpload?: (file: File) => Promise<void>;
  children?: React.ReactNode;
}

export function ProfileBanner({
  title,
  subtitle,
  avatarUrl,
  bannerUrl, // Unused visually but kept to satisfy interface
  initials,
  onAvatarUpload,
  onBannerUpload,
  children
}: ProfileBannerProps) {
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const handleAvatarFile = async (_dataUrl: string, file: File) => {
    if (!onAvatarUpload) return;
    setUploadingAvatar(true);
    try {
      await onAvatarUpload(file);
    } catch (err) {
      console.error('Avatar upload failed', err);
      toast.error('Failed to upload avatar');
    } finally {
      setUploadingAvatar(false);
    }
  };

  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-xl shadow-sm mb-6 flex items-center px-4 py-3 gap-4">
      {/* Avatar */}
      <div className="relative shrink-0" style={{ width: 48, height: 48 }}>
        {uploadingAvatar && (
          <div className="absolute inset-0 z-10 bg-white/70 rounded-full flex items-center justify-center backdrop-blur-sm">
            <div className="w-4 h-4 border-2 border-[var(--brand-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        <Avatar 
          name={title}
          initials={initials}
          src={avatarUrl}
          size="lg"
          editable={!!onAvatarUpload}
          onUpload={handleAvatarFile}
          className="w-full h-full shadow-sm"
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Name and Details */}
      <div className="flex flex-col min-w-0 flex-1">
         <h1 className="text-xl font-extrabold text-[var(--text-primary)] tracking-tight truncate leading-tight">
           {title}
         </h1>
         {subtitle && (
           <p className="text-[12px] font-medium text-[var(--text-secondary)] mt-0.5 truncate max-w-lg">
             {subtitle}
           </p>
         )}
      </div>
      {children && (
        <div className="ml-auto flex items-center pr-2">
          {children}
        </div>
      )}
    </div>
  );
}
