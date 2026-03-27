'use client';

/**
 * MicPermissionHelper
 *
 * Shown when the Co-Pilot can't access the microphone.
 * - Auto-detects the current permission state via the Permissions API
 * - Shows browser-specific step-by-step instructions (Chrome, Firefox, Safari, Edge)
 * - Provides a live "Test Microphone" button with a visual volume meter
 * - If devicesAllowed but no devices exist, shows a "No microphone found" variant
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── Browser detection ─────────────────────────────────────────────────────────

function detectBrowser(): 'chrome' | 'firefox' | 'safari' | 'edge' | 'other' {
  if (typeof navigator === 'undefined') return 'other';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/'))     return 'edge';
  if (ua.includes('chrome'))   return 'chrome';
  if (ua.includes('firefox'))  return 'firefox';
  if (ua.includes('safari'))   return 'safari';
  return 'other';
}

type PermState = 'checking' | 'prompt' | 'granted' | 'denied' | 'unsupported';

// ─── Browser-specific instructions ────────────────────────────────────────────

const STEPS: Record<string, { icon: string; text: string }[]> = {
  chrome: [
    { icon: '🔒', text: 'Click the lock icon (🔒) in your browser address bar' },
    { icon: '🎤', text: 'Set "Microphone" to "Allow"' },
    { icon: '🔄', text: 'Reload this page and try again' },
  ],
  edge: [
    { icon: '🔒', text: 'Click the lock / info icon next to the address bar' },
    { icon: '🎤', text: 'Find "Microphone" and set it to "Allow"' },
    { icon: '🔄', text: 'Reload the page' },
  ],
  firefox: [
    { icon: '🛡️', text: 'Click the shield or lock icon in the address bar' },
    { icon: '🎤', text: 'Click "More Information" → Permissions → Microphone → Allow' },
    { icon: '🔄', text: 'Reload the page' },
  ],
  safari: [
    { icon: '⚙️', text: 'Open Safari → Settings (or Preferences) → Websites → Microphone' },
    { icon: '🎤', text: 'Find this site and set it to "Allow"' },
    { icon: '🔄', text: 'Reload the page and try again' },
  ],
  other: [
    { icon: '⚙️', text: 'Open your browser settings and search for "Microphone permissions"' },
    { icon: '🎤', text: 'Allow this site to access the microphone' },
    { icon: '🔄', text: 'Reload the page' },
  ],
};

// ─── Volume meter bar ─────────────────────────────────────────────────────────

function VolumeMeter({ stream }: { stream: MediaStream }) {
  const [level, setLevel] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);

    function tick() {
      analyser.getByteFrequencyData(buf);
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length;
      setLevel(Math.min(100, (avg / 128) * 100));
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
      source.disconnect();
      ctx.close();
    };
  }, [stream]);

  const bars = 20;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 36, marginTop: 8 }}>
      {Array.from({ length: bars }, (_, i) => {
        const threshold = (i / bars) * 100;
        const active = level > threshold;
        const color = i < bars * 0.5 ? '#22c55e' : i < bars * 0.8 ? '#eab308' : '#ef4444';
        return (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${20 + i * 2}%`,
              borderRadius: 2,
              background: active ? color : 'rgba(255,255,255,0.1)',
              transition: 'background 0.1s',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface MicPermissionHelperProps {
  onPermissionGranted?: () => void;
  onRetry:             () => void;
}

export function MicPermissionHelper({ onPermissionGranted, onRetry }: MicPermissionHelperProps) {
  const browser = detectBrowser();
  const steps   = STEPS[browser] ?? STEPS.other;

  const [permState,   setPermState]   = useState<PermState>('checking');
  const [testStream,  setTestStream]  = useState<MediaStream | null>(null);
  const [testing,     setTesting]     = useState(false);
  const [testError,   setTestError]   = useState('');
  const [testSuccess, setTestSuccess] = useState(false);

  // Check current permission state
  useEffect(() => {
    if (!navigator?.permissions) {
      setPermState('unsupported');
      return;
    }
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then(result => {
      setPermState(result.state as PermState);
      result.onchange = () => {
        setPermState(result.state as PermState);
        if (result.state === 'granted') {
          setTestSuccess(true);
          onPermissionGranted?.();
        }
      };
    }).catch(() => setPermState('unsupported'));
  }, [onPermissionGranted]);

  // Clean up test stream
  useEffect(() => {
    return () => {
      testStream?.getTracks().forEach(t => t.stop());
    };
  }, [testStream]);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestError('');
    try {
      // Stop any existing test stream
      testStream?.getTracks().forEach(t => t.stop());

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setTestStream(stream);
      setTestSuccess(true);
      setPermState('granted');
    } catch (e: any) {
      const code = e?.name ?? '';
      if (code === 'NotAllowedError' || code === 'PermissionDeniedError') {
        setTestError('Still blocked. Follow the steps above to allow microphone access.');
        setPermState('denied');
      } else if (code === 'NotFoundError' || code === 'DevicesNotFoundError') {
        setTestError('No microphone found. Please connect a microphone and try again.');
      } else {
        setTestError(e?.message ?? 'Unknown error accessing microphone.');
      }
    } finally {
      setTesting(false);
    }
  }, [testStream]);

  const handleStopTest = () => {
    testStream?.getTracks().forEach(t => t.stop());
    setTestStream(null);
    setTestSuccess(false);
  };

  const browserLabel = {
    chrome: 'Google Chrome', edge: 'Microsoft Edge',
    firefox: 'Mozilla Firefox', safari: 'Apple Safari', other: 'your browser',
  }[browser];

  return (
    <div style={{
      padding: '28px 24px',
      background: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
      maxWidth: 480,
      margin: '0 auto',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, flexShrink: 0,
          background: permState === 'granted' ? '#22c55e20' : '#ef444420',
          border: `1px solid ${permState === 'granted' ? '#22c55e40' : '#ef444440'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
        }}>
          {permState === 'granted' ? '🎤' : '🚫'}
        </div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>
            {permState === 'granted' ? 'Microphone Access Granted' : 'Microphone Access Required'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
            {permState === 'checking' && 'Checking permission status…'}
            {permState === 'denied'   && `The microphone is blocked in ${browserLabel}. Follow the steps below to unlock it.`}
            {permState === 'prompt'   && 'Click "Test Microphone" below — your browser will ask for permission.'}
            {permState === 'granted'  && 'Your microphone is working. Click "Start Co-Pilot" to begin.'}
            {permState === 'unsupported' && 'Your browser may not support the Permissions API. Try clicking "Test Microphone".'}
          </div>
        </div>
      </div>

      {/* Permission state badge */}
      {permState !== 'checking' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
          borderRadius: 10,
          background: {
            denied:      '#ef444412',
            prompt:      '#f59e0b12',
            granted:     '#22c55e12',
            unsupported: '#6366f112',
          }[permState] ?? 'transparent',
          border: `1px solid ${{
            denied:      '#ef444430',
            prompt:      '#f59e0b30',
            granted:     '#22c55e30',
            unsupported: '#6366f130',
          }[permState] ?? 'transparent'}`,
          fontSize: 12, fontWeight: 600,
          color: {
            denied: '#fca5a5', prompt: '#fcd34d', granted: '#86efac', unsupported: '#a5b4fc',
          }[permState] ?? 'inherit',
        }}>
          <span>{
            { denied: '🔴', prompt: '🟡', granted: '🟢', unsupported: '🔵' }[permState]
          }</span>
          <span>Status: <strong>{{
            denied: 'Blocked', prompt: 'Not yet requested', granted: 'Allowed', unsupported: 'Unknown',
          }[permState]}</strong></span>

        </div>
      )}

      {/* Step-by-step instructions (only when denied) */}
      {permState === 'denied' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
            How to allow microphone in {browserLabel}
          </div>
          {steps.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              padding: '10px 12px', borderRadius: 10,
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border)',
              marginBottom: 6,
            }}>
              <div style={{
                width: 26, height: 26, borderRadius: 8, flexShrink: 0,
                background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14,
              }}>
                {step.icon}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.5, paddingTop: 3 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: '50%',
                  background: '#6366f120', color: '#6366f1',
                  fontSize: 10, fontWeight: 900, marginRight: 8, flexShrink: 0,
                }}>
                  {i + 1}
                </span>
                {step.text}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Live mic test */}
      <div style={{
        padding: '14px 16px', borderRadius: 12,
        background: 'var(--bg-overlay)', border: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
          🎙️ Microphone Test
        </div>

        {testSuccess && testStream ? (
          <>
            <div style={{ fontSize: 12, color: '#86efac', marginBottom: 8, fontWeight: 600 }}>
              ✅ Microphone detected! Speak to see the level meter.
            </div>
            <VolumeMeter stream={testStream} />
            <button
              onClick={handleStopTest}
              style={{
                marginTop: 12, width: '100%', padding: '8px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--bg-elevated)',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              }}
            >
              Stop Test
            </button>
          </>
        ) : (
          <>
            {testError && (
              <div style={{
                fontSize: 12, color: '#fca5a5', marginBottom: 10,
                padding: '8px 10px', borderRadius: 8,
                background: '#ef444412', border: '1px solid #ef444430',
              }}>
                {testError}
              </div>
            )}
            <button
              onClick={handleTest}
              disabled={testing}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, border: 'none',
                background: testing ? 'rgba(99,102,241,0.3)' : 'linear-gradient(135deg,#6366f1,#818cf8)',
                color: 'white', fontSize: 13, fontWeight: 700,
                cursor: testing ? 'not-allowed' : 'pointer',
                boxShadow: testing ? 'none' : '0 4px 16px rgba(99,102,241,0.3)',
              }}
            >
              {testing ? '⏳ Requesting access…' : '🎤 Test Microphone'}
            </button>
          </>
        )}
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10 }}>
        {permState === 'granted' || testSuccess ? (
          <button
            onClick={onRetry}
            style={{
              flex: 1, padding: '12px', borderRadius: 10, border: 'none',
              background: 'linear-gradient(135deg,#22c55e,#16a34a)',
              color: 'white', fontSize: 14, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(34,197,94,0.3)',
            }}
          >
            🚀 Start Co-Pilot Now
          </button>
        ) : (
          <button
            onClick={onRetry}
            style={{
              flex: 1, padding: '12px', borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              color: 'var(--text-primary)', fontSize: 14, fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            🔄 Try Again
          </button>
        )}
      </div>

      {/* Help link */}
      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', textAlign: 'center', lineHeight: 1.5 }}>
        Still having issues?{' '}
        <a
          href={`https://support.google.com/chrome/answer/2693767`}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: '#6366f1', textDecoration: 'underline' }}
        >
          View browser microphone guide
        </a>
      </div>
    </div>
  );
}
