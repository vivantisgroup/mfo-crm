'use client';

import React from 'react';
import { I18nProvider } from '@/lib/i18n/context';
import { AuthProvider } from '@/lib/AuthContext';
import { UserSettingsProvider } from '@/lib/UserSettingsContext';
import { ThemeProvider } from '@/lib/ThemeContext';
import { TaskQueueProvider } from '@/lib/TaskQueueContext';
import { PageTitleProvider } from '@/lib/PageTitleContext';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <UserSettingsProvider>
          <ThemeProvider>
            <TaskQueueProvider>
              <PageTitleProvider>
                {children}
              </PageTitleProvider>
            </TaskQueueProvider>
          </ThemeProvider>
        </UserSettingsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
