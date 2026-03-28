/**
 * useTranscription.ts
 *
 * Client-side hook for real-time audio transcription.
 *
 * Architecture:
 *   1. Captures mic audio with MediaRecorder API
 *   2. Every N seconds, sends audio blob as FormData to /api/copilot/transcribe
 *   3. Server route calls Groq Whisper (fast, accurate) and returns text
 *   4. Received text is emitted as a TranscriptChunk via onChunk callback
 *
 * This approach avoids loading 100MB+ browser ML models and gives
 * consistent, high-quality transcription in under 500ms per chunk.
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptChunk } from '@/lib/copilot/copilot.types';

export type TranscriptionStatus = 'idle' | 'ready' | 'recording' | 'paused' | 'error';

interface UseTranscriptionOptions {
  sessionId: string;
  language?: string;
  onChunk:   (chunk: TranscriptChunk) => void;
  /** How often (ms) to flush audio and transcribe. Default: 4000 */
  chunkIntervalMs?: number;
}

interface UseTranscriptionReturn {
  status:          TranscriptionStatus;
  error:           string | null;
  startRecording:  () => Promise<void>;
  stopRecording:   () => void;
  pauseRecording:  () => void;
  resumeRecording: () => void;
  elapsedMs:       number;
}

export function useTranscription({
  sessionId,
  language = 'en',
  onChunk,
  chunkIntervalMs = 4000,
}: UseTranscriptionOptions): UseTranscriptionReturn {
  const [status,    setStatus]    = useState<TranscriptionStatus>('idle');
  const [error,     setError]     = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const mediaStreamRef    = useRef<MediaStream | null>(null);
  const mediaRecorderRef  = useRef<MediaRecorder | null>(null);
  const startTimeRef      = useRef<number>(0);
  const intervalRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioChunksRef    = useRef<Blob[]>([]);
  const chunkStartMsRef   = useRef<number>(0);
  const processingRef     = useRef(false);
  const activeRef         = useRef(false);  // track if we should keep cycling
  const onChunkRef        = useRef(onChunk);
  onChunkRef.current = onChunk;

  // ── Elapsed timer ──────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
  }, []);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // ── Core: send audio blob to server for transcription ─────────────────────

  const transcribeBlob = useCallback(async (blob: Blob, startMs: number) => {
    if (processingRef.current || blob.size < 2000) return; // skip tiny/empty blobs
    processingRef.current = true;

      try {
        const formData = new FormData();
        formData.append('audio', blob, 'audio.webm');
        formData.append('language', language);
        formData.append('sessionId', sessionId);

        const res  = await fetch('/api/copilot/transcribe', {
          method: 'POST',
          body:   formData,
        });

      if (!res.ok) {
        console.warn('[useTranscription] API error:', res.status);
        return;
      }

      const { text, noApiKey } = await res.json() as { text?: string; noApiKey?: boolean };

      if (noApiKey) {
        // Show a one-time warning in the transcript feed
        const warnChunk: TranscriptChunk = {
          sessionId,
          chunkId:   uuidv4(),
          speaker:   'system' as 'seller',
          text:      '⚠️ No transcription API key configured. Set GROQ_API_KEY in .env.local to enable live transcription.',
          confidence: 0,
          startMs,
          endMs:     Date.now() - startTimeRef.current,
          createdAt: new Date().toISOString(),
        };
        onChunkRef.current(warnChunk);
        return;
      }

      if (!text || text.trim().length === 0) return; // silence / no speech

      const chunk: TranscriptChunk = {
        sessionId,
        chunkId:   uuidv4(),
        speaker:   'seller',
        text:      text.trim(),
        confidence: 0.92,
        startMs,
        endMs:     Date.now() - startTimeRef.current,
        createdAt: new Date().toISOString(),
      };

      onChunkRef.current(chunk);
    } catch (e) {
      console.warn('[useTranscription] transcribeBlob failed:', e);
    } finally {
      processingRef.current = false;
    }
  }, [sessionId, language]);

  // ── Flush: stop current recorder, process blob, restart ───────────────────

  const flushChunk = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    const stream   = mediaStreamRef.current;
    if (!recorder || !stream || !activeRef.current) return;

    const startMs = chunkStartMsRef.current;
    chunkStartMsRef.current = Date.now() - startTimeRef.current;

    if (recorder.state === 'recording') {
      // onstop will fire → captures audioChunksRef → calls transcribeBlob
      recorder.stop();
      // Restart after short pause for onstop to fire
      setTimeout(() => {
        if (!activeRef.current || !mediaStreamRef.current) return;
        try {
          const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : 'audio/webm';
          const newRec = new MediaRecorder(stream, { mimeType });
          mediaRecorderRef.current = newRec;
          newRec.ondataavailable = (e) => {
            if (e.data.size > 0) audioChunksRef.current.push(e.data);
          };
          newRec.onstop = async () => {
            if (audioChunksRef.current.length > 0) {
              const blob = new Blob(audioChunksRef.current, { type: newRec.mimeType });
              audioChunksRef.current = [];
              await transcribeBlob(blob, chunkStartMsRef.current);
            }
          };
          newRec.start();
        } catch (e) {
          console.warn('[useTranscription] restart failed:', e);
        }
      }, 100);
    }

    // Also fire transcription for whatever we have so far
    if (audioChunksRef.current.length > 0) {
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType });
      audioChunksRef.current = [];
      transcribeBlob(blob, startMs);
    }
  }, [transcribeBlob]);

  // ── Start recording ───────────────────────────────────────────────────────

  const startRecording = useCallback(async () => {
    try {
      setStatus('ready');
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current   = stream;
      activeRef.current        = true;
      chunkStartMsRef.current  = 0;
      audioChunksRef.current   = [];

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Only process if we're not cleaning up
        if (audioChunksRef.current.length > 0) {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          audioChunksRef.current = [];
          await transcribeBlob(blob, chunkStartMsRef.current);
        }
      };

      recorder.start();
      startTimer();
      setStatus('recording');

      // Schedule periodic flush every chunkIntervalMs
      chunkTimerRef.current = setInterval(flushChunk, chunkIntervalMs);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Microphone access denied.';
      setError(msg);
      setStatus('error');
      throw e; // re-throw so caller (handleStart) can catch and show mic error
    }
  }, [startTimer, flushChunk, transcribeBlob, chunkIntervalMs]);

  // ── Stop recording ────────────────────────────────────────────────────────

  const stopRecording = useCallback(() => {
    activeRef.current = false;

    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop(); // final onstop → transcribes last chunk
    }

    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    mediaStreamRef.current   = null;
    mediaRecorderRef.current = null;

    stopTimer();
    setStatus('idle');
    setElapsedMs(0);
  }, [stopTimer]);

  // ── Pause & resume ────────────────────────────────────────────────────────

  const pauseRecording = useCallback(() => {
    mediaRecorderRef.current?.pause();
    if (chunkTimerRef.current) {
      clearInterval(chunkTimerRef.current);
      chunkTimerRef.current = null;
    }
    stopTimer();
    setStatus('paused');
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    mediaRecorderRef.current?.resume();
    startTimer();
    chunkTimerRef.current = setInterval(flushChunk, chunkIntervalMs);
    setStatus('recording');
  }, [startTimer, flushChunk, chunkIntervalMs]);

  // ── Cleanup on unmount ────────────────────────────────────────────────────

  useEffect(() => {
    return () => {
      activeRef.current = false;
      if (chunkTimerRef.current) clearInterval(chunkTimerRef.current);
      mediaStreamRef.current?.getTracks().forEach(t => t.stop());
      stopTimer();
    };
  }, [stopTimer]);

  return { status, error, startRecording, stopRecording, pauseRecording, resumeRecording, elapsedMs };
}
