/**
 * useTranscription.ts
 *
 * Client-side hook for real-time audio transcription.
 *
 * Architecture:
 *   1. Utilizes native browser Web Speech API (window.SpeechRecognition)
 *   2. Captures audio continuously for free using Google/Microsoft's OS engine
 *   3. Emits TranscriptChunks directly into the CRM Copilot feed.
 *   4. Zero cost, zero API keys, true privacy mode.
 */

'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { TranscriptChunk } from '@/lib/copilot/copilot.types';

export type TranscriptionStatus = 'idle' | 'ready' | 'recording' | 'paused' | 'error';

interface UseTranscriptionOptions {
  sessionId: string;
  tenantId: string;
  language?: string;
  onChunk:   (chunk: TranscriptChunk) => void;
  chunkIntervalMs?: number; // Kept for backwards compatibility but unused
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
  tenantId,
  language = 'en-US',
  onChunk,
}: UseTranscriptionOptions): UseTranscriptionReturn {
  const [status,    setStatus]    = useState<TranscriptionStatus>('idle');
  const [error,     setError]     = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recognitionRef = useRef<any>(null);
  const startTimeRef   = useRef<number>(0);
  const intervalRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const onChunkRef     = useRef(onChunk);
  onChunkRef.current = onChunk;

  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now() - elapsedMs; // Account for pauses
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startTimeRef.current);
    }, 500);
  }, [elapsedMs]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const initRecognition = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Web Speech API is not supported in this browser. Please use Chrome or Edge.');
      return null;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false; // Only final results to match chunking logic cleanly
    recognition.lang = language;

    recognition.onresult = (event: any) => {
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      const txt = finalTranscript.trim();
      if (!txt) return;

      const chunk: TranscriptChunk = {
        sessionId,
        chunkId:   uuidv4(),
        speaker:   'seller',
        text:      txt,
        confidence: event.results[event.results.length - 1]?.[0]?.confidence ?? 0.95,
        startMs:   Date.now() - startTimeRef.current - 3000, // Approx start time
        endMs:     Date.now() - startTimeRef.current,
        createdAt: new Date().toISOString(),
      };
      
      console.log("[Native Speech] Chunk Captured:", txt);
      onChunkRef.current(chunk);
    };

    recognition.onerror = (event: any) => {
      console.error('[Native Speech] Error:', event.error);
      if (event.error === 'not-allowed') {
        setError('Microphone access denied.');
        setStatus('error');
        stopTimer();
      }
    };

    recognition.onend = () => {
      // In continuous mode, if silence forces an end, we can auto-restart if we are supposed to be recording
      setStatus((prev) => {
        if (prev === 'recording') {
          try { recognition.start(); } catch {} 
          return 'recording';
        }
        return prev;
      });
    };

    return recognition;
  }, [language, sessionId, stopTimer]);

  const startRecording = useCallback(async () => {
    setError(null);
    setStatus('ready');

    try {
      // Prompt for Mic permission via standard getUserMedia just to be 100% sure it's allowed before triggering dictation
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      stream.getTracks().forEach(t => t.stop());
    } catch (e: any) {
      setError('Microphone access denied.');
      setStatus('error');
      throw e;
    }

    const rec = initRecognition();
    if (!rec) throw new Error('Speech recognition not supported');
    
    recognitionRef.current = rec;
    
    try {
      rec.start();
      setElapsedMs(0);
      startTimer();
      setStatus('recording');
    } catch (e) {
      console.warn('Recognition start failed:', e);
    }
  }, [initRecognition, startTimer]);

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // Prevent auto-restart
      recognitionRef.current.stop();
    }
    stopTimer();
    setStatus('idle');
    setElapsedMs(0);
  }, [stopTimer]);

  const pauseRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
    }
    stopTimer();
    setStatus('paused');
  }, [stopTimer]);

  const resumeRecording = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = () => {
        setStatus((prev) => {
          if (prev === 'recording') {
            try { recognitionRef.current.start(); } catch {} 
            return 'recording';
          }
          return prev;
        });
      };
      try { recognitionRef.current.start(); } catch {}
    }
    startTimer();
    setStatus('recording');
  }, [startTimer]);

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        try { recognitionRef.current.stop(); } catch {}
      }
      stopTimer();
    };
  }, [stopTimer]);

  return { status, error, startRecording, stopRecording, pauseRecording, resumeRecording, elapsedMs };
}
