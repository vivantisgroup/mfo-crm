'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

// How often (in ms) to allow a Firestore write for activity ping
// 3 minutes (180000ms) minimizes Firestore document writes while providing highly accurate online status.
const DEBOUNCE_MS = 3 * 60 * 1000; 

export function ActivityTracker() {
  const { user } = useAuth();
  const lastWriteRef = useRef<number>(0);
  const scheduledWriteRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // If user is not authenticated, do not track.
    if (!user?.uid) return;

    const pingActivity = () => {
      const now = Date.now();
      
      // If we haven't written recently, do it immediately.
      if (now - lastWriteRef.current >= DEBOUNCE_MS) {
        lastWriteRef.current = now;
        
        // Non-blocking fire-and-forget to Firestore
        updateDoc(doc(db, 'users', user.uid), {
          lastActivityAt: new Date().toISOString()
        }).catch((err) => {
          console.warn('[ActivityTracker] Failed to tick user activity:', err?.message);
        });

      } else {
        // If we are within the debounce window, schedule a background update 
        // at the end of the window so we don't drop the latest activity time.
        if (!scheduledWriteRef.current) {
          const delay = DEBOUNCE_MS - (now - lastWriteRef.current);
          scheduledWriteRef.current = setTimeout(() => {
            lastWriteRef.current = Date.now();
            updateDoc(doc(db, 'users', user.uid), {
              lastActivityAt: new Date().toISOString()
            }).catch(() => {});
            scheduledWriteRef.current = null;
          }, delay);
        }
      }
    };

    // Fire immediately on mount (if authenticated) to record login/refresh
    pingActivity();

    // Attach listeners for interaction
    const events = ['mousemove', 'keydown', 'touchstart', 'scroll', 'click'];
    const handleEvent = () => pingActivity();

    events.forEach(evt => window.addEventListener(evt, handleEvent, { passive: true }));

    return () => {
      events.forEach(evt => window.removeEventListener(evt, handleEvent));
      if (scheduledWriteRef.current) {
        clearTimeout(scheduledWriteRef.current);
      }
    };
  }, [user?.uid]);

  // Renders nothing, works silently in the background
  return null;
}
