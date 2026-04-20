'use client';

/**
 * /app/(dashboard)/copilot/page.tsx
 *
 * AI Sales Co-Pilot — Seller Sidecar View
 *
 * Layout:
 *   LEFT PANEL (35%)  — Session setup → MEDDIC/SPIN/Challenger tracker
 *   CENTER PANEL (40%) — Live transcript feed
 *   RIGHT PANEL (25%) — Real-time flashcard stream
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic, MicOff, Pause, Play, StopCircle, RefreshCw, ChevronLeft, Cpu, Zap,
} from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import { SessionSetup } from '@/components/copilot/SessionSetup';
import { MethodologyTracker } from '@/components/copilot/MethodologyTracker';
import { FlashcardStream } from '@/components/copilot/FlashcardStream';
import { TranscriptFeed } from '@/components/copilot/TranscriptFeed';
import { MicPermissionHelper } from '@/components/copilot/MicPermissionHelper';
import { useTranscription } from '@/hooks/useTranscription';
import {
  createSession, updateSessionStatus, appendChunkAndAnalyze,
  subscribeToFlashcards, subscribeToChunks, subscribeToMethodologyState,
  dismissFlashcard,
} from '@/lib/copilot/copilotService';
import type {
  SessionContext, TranscriptChunk, Flashcard,
  MethodologyState, IntentLabel, IntentResult,
} from '@/lib/copilot/copilot.types';

// ─── Elapsed timer formatter ────────────────────────────────────────────────────

function fmtElapsed(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60).toString().padStart(2, '0');
  const sc = (s % 60).toString().padStart(2, '0');
  return `${m}:${sc}`;
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function CopilotPage() {
  const { user, tenant } = useAuth();

  const [session,    setSession]    = useState<SessionContext | null>(null);
  const [cards,      setCards]      = useState<Flashcard[]>([]);
  const [chunks,     setChunks]     = useState<TranscriptChunk[]>([]);
  const [mState,     setMState]     = useState<MethodologyState | null>(null);
  const [intentMap,  setIntentMap]  = useState<Record<string, IntentLabel>>({});
  const [isStarting, setIsStarting] = useState(false);
  const [cardCount,  setCardCount]  = useState(0);
  const recentChunksRef = useRef<TranscriptChunk[]>([]);
  const currentStateRef = useRef<MethodologyState | null>(null);

  // Keep refs in sync
  useEffect(() => {
    recentChunksRef.current = chunks.slice(-5);
  }, [chunks]);
  useEffect(() => {
    currentStateRef.current = mState;
  }, [mState]);

  // Transcription hook
  const handleChunk = useCallback(async (chunk: TranscriptChunk) => {
    if (!session) return;
    setChunks(prev => [...prev, chunk]);
    await appendChunkAndAnalyze(
      chunk,
      session,
      recentChunksRef.current,
      currentStateRef.current,
    );
  }, [session]);

  const {
    status: txStatus, error: txError,
    startRecording, stopRecording, pauseRecording, resumeRecording, elapsedMs,
  } = useTranscription({ tenantId: "temp",
    sessionId: session?.sessionId ?? 'none',
    language:  session?.language ?? 'en',
    onChunk:   handleChunk,
  });

  const isRecording = txStatus === 'recording';
  const isStartingMic = txStatus === 'ready';

  // Firestore subscriptions
  useEffect(() => {
    if (!session) return;
    const sid = session.sessionId;

    const unsubs = [
      subscribeToFlashcards(sid, c => {
        setCards(c);
        setCardCount(prev => {
          const newCount = c.filter(f => !f.dismissed).length;
          return newCount > prev ? newCount : prev;
        });
      }),
      subscribeToChunks(sid, c => setChunks(c)),
      subscribeToMethodologyState(sid, session.methodology, s => setMState(s)),
    ];

    return () => unsubs.forEach(u => u());
  }, [session]);

  const [startError, setStartError] = useState<string | null>(null);
  const [lastCtx,    setLastCtx]    = useState<Omit<SessionContext,'sessionId'|'startedAt'|'status'> | null>(null);

  // Clear any stale mic error when this page is freshly mounted
  // (prevents a previous session's mic error from appearing on the next visit)
  useEffect(() => { setStartError(null); setLastCtx(null); }, []);

  // Is the current error a microphone permission error?
  const isMicError = !!startError && (
    startError.toLowerCase().includes('mic') ||
    startError.toLowerCase().includes('notallowed') ||
    startError.toLowerCase().includes('permission') ||
    startError.toLowerCase().includes('denied')
  );

  // Start session — probe mic FIRST so failures never create orphaned Firestore sessions
  async function handleStart(ctx: Omit<SessionContext, 'sessionId' | 'startedAt' | 'status'>) {
    setIsStarting(true);
    setStartError(null);
    setLastCtx(ctx);

    try {
      // ── Step 1: Verify mic is available before touching Firestore ─────────
      try {
        const probe = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        probe.getTracks().forEach(t => t.stop()); // release probe immediately
      } catch {
        setStartError('🎤 Microphone access denied.');
        return; // stop here — no session created
      }

      // ── Step 2: Create Firestore session ──────────────────────────────────
      const s = await createSession(ctx);
      await updateSessionStatus(s.sessionId, 'recording');

      // ── Step 3: All good — expose session to UI ───────────────────────────
      setSession(s);

      // ── Step 4: Start recording (may throw if mic revoked) ────────────────
      // Note: we use a tiny timeout to ensure React state propagates the sessionId to the useTranscription hook
      setTimeout(async () => {
        try {
          await startRecording();
        } catch (recErr: any) {
          await updateSessionStatus(s.sessionId, 'ended').catch(() => {});
          const msg = recErr?.message ?? 'Microphone error.';
          setStartError(msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('denied')
            ? '🎤 Microphone access denied.'
            : `⚠️ ${msg}`);
          setSession(null);
        }
      }, 50);
    } catch (e: any) {
      console.error('[copilot] session start failed:', e);
      const msg = e?.message ?? 'Failed to start session.';
      if (msg.toLowerCase().includes('mic') || msg.toLowerCase().includes('notallowed') || msg.toLowerCase().includes('permission')) {
        setStartError('🎤 Microphone access denied.');
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
        setStartError('🌐 Network error — check your connection and try again.');
      } else {
        setStartError(`⚠️ ${msg}`);
      }
    } finally {
      setIsStarting(false);
    }
  }

  // Retry — re-run the stored session context after fixing mic
  function handleMicRetry() {
    setStartError(null);
    if (lastCtx) handleStart(lastCtx);
  }

  // End session
  async function handleEnd() {
    if (!session) return;
    stopRecording();
    await updateSessionStatus(session.sessionId, 'ended');
    setSession(null);
    setCards([]);
    setChunks([]);
    setMState(null);
  }

  if (!user || !tenant) return null;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--bg-base)', overflow: 'hidden',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '12px 20px',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0, background: 'var(--bg-elevated)',
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8,
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 12px #6366f144',
        }}>
          <Cpu size={14} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text-primary)' }}>AI Sales Co-Pilot</div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
            {session ? `Session: ${session.callTitle ?? session.sessionId.slice(0, 8)}` : 'No active session'}
          </div>
        </div>

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {session && (
            <>
              {/* Cards counter */}
              {cardCount > 0 && (
                <div style={{
                  padding: '3px 10px', borderRadius: 20,
                  background: '#6366f122', border: '1px solid #6366f133',
                  fontSize: 10, fontWeight: 800, color: '#6366f1',
                }}>
                  <Zap size={10} style={{ display: 'inline', marginRight: 3 }} />
                  {cardCount} cards
                </div>
              )}

              {/* Elapsed */}
              <div style={{
                padding: '3px 10px', borderRadius: 20,
                background: isRecording ? '#ef444415' : isStartingMic ? '#f59e0b15' : 'var(--bg-overlay)',
                border: `1px solid ${isRecording ? '#ef444430' : isStartingMic ? '#f59e0b30' : 'var(--border)'}`,
                fontSize: 10, fontWeight: 800,
                color: isRecording ? '#ef4444' : isStartingMic ? '#f59e0b' : 'var(--text-secondary)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {isRecording && (
                  <motion.div animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444' }} />
                )}
                {isStartingMic ? '⏳ Starting mic…' : fmtElapsed(elapsedMs)}
              </div>

              {/* Controls */}
              {isRecording
                ? <button onClick={pauseRecording} style={ctrlBtn('#f59e0b')}>
                    <Pause size={12} />
                  </button>
                : txStatus === 'paused'
                  ? <button onClick={resumeRecording} style={ctrlBtn('#22c55e')}>
                      <Play size={12} />
                    </button>
                  : null}
              <button onClick={handleEnd} style={ctrlBtn('#ef4444')}>
                <StopCircle size={12} />
                <span style={{ fontSize: 10, fontWeight: 700 }}>End</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* LEFT PANEL: Setup / Methodology tracker */}
        <div style={{
          width: 280, flexShrink: 0,
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 16, scrollbarWidth: 'thin' }}>
            <AnimatePresence mode="wait">
              {!session ? (
                <motion.div key="setup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  {isMicError ? (
                    <MicPermissionHelper
                      onRetry={handleMicRetry}
                      onPermissionGranted={() => { setStartError(null); }}
                    />
                  ) : (
                    <SessionSetup
                      tenantId={tenant.id}
                      userId={user.uid}
                      onStart={handleStart}
                      isLoading={isStarting}
                      error={startError}
                    />
                  )}
                </motion.div>
              ) : (
                <motion.div key="tracker" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {session.methodology} Tracker
                    </div>
                  </div>
                  <MethodologyTracker methodology={session.methodology} state={mState} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* CENTER PANEL: Transcript */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          borderRight: '1px solid var(--border)',
          padding: '14px 16px', overflow: 'hidden',
        }}>
          <TranscriptFeed
            chunks={chunks}
            intents={intentMap}
            isRecording={isRecording}
          />
          {txError && (
            <div style={{ padding: '8px 12px', background: '#ef444415', border: '1px solid #ef444430', borderRadius: 8, fontSize: 11, color: '#ef4444', marginTop: 8 }}>
              ⚠ {txError}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Flashcard stream */}
        <div style={{
          width: 300, flexShrink: 0,
          display: 'flex', flexDirection: 'column',
          padding: '14px 14px', overflow: 'hidden',
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
            Co-Pilot Suggestions
          </div>
          <FlashcardStream
            cards={cards}
            onDismiss={(id) => {
              dismissFlashcard(session?.sessionId ?? '', id);
              setCards(prev => prev.map(c => c.cardId === id ? { ...c, dismissed: true } : c));
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ctrlBtn(color: string): React.CSSProperties {
  return {
    display: 'flex', alignItems: 'center', gap: 5,
    padding: '5px 10px', borderRadius: 7, border: `1px solid ${color}33`,
    background: `${color}15`, color, cursor: 'pointer',
  };
}
