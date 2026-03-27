'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { TranscriptChunk, IntentLabel } from '@/lib/copilot/copilot.types';
import { INTENT_COLORS, INTENT_LABELS } from '@/lib/copilot/copilot.types';

interface TranscriptFeedProps {
  chunks: TranscriptChunk[];
  intents?: Record<string, IntentLabel>; // chunkId → label
  isRecording: boolean;
}

function formatMs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60).toString().padStart(2, '0');
  const s = (total % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function TranscriptFeed({ chunks, intents = {}, isRecording }: TranscriptFeedProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new chunk
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chunks.length]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 0 10px', flexShrink: 0 }}>
        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          Transcript
        </span>
        {isRecording && (
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#ef4444', fontWeight: 700 }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#ef4444', display: 'inline-block' }} />
            LIVE
          </motion.div>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--text-tertiary)' }}>
          {chunks.length} utterances
        </span>
      </div>

      {/* Feed */}
      <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <AnimatePresence initial={false}>
          {chunks.map(chunk => {
            const isSeller = chunk.speaker === 'seller';
            const intent   = intents[chunk.chunkId];
            const intentColor = intent ? INTENT_COLORS[intent] : undefined;

            return (
              <motion.div
                key={chunk.chunkId}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  display: 'flex',
                  flexDirection: isSeller ? 'row' : 'row-reverse',
                  gap: 8,
                  alignItems: 'flex-start',
                }}
              >
                {/* Speaker avatar */}
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 9, fontWeight: 900,
                  background: isSeller ? '#6366f122' : '#f5a62322',
                  color: isSeller ? '#6366f1' : '#f5a623',
                  border: `1px solid ${isSeller ? '#6366f133' : '#f5a62333'}`,
                  marginTop: 2,
                }}>
                  {isSeller ? 'ME' : 'B'}
                </div>

                <div style={{ maxWidth: '78%' }}>
                  {/* Bubble */}
                  <div style={{
                    padding: '8px 12px', borderRadius: isSeller ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                    background: isSeller ? 'var(--bg-elevated)' : 'var(--bg-overlay)',
                    border: '1px solid var(--border)',
                    borderLeft: intentColor ? `2px solid ${intentColor}` : undefined,
                    fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.6,
                  }}>
                    {chunk.text}
                  </div>

                  {/* Metadata row */}
                  <div style={{ display: 'flex', gap: 6, marginTop: 3, alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>
                      {formatMs(chunk.startMs)}
                    </span>
                    {intent && intent !== 'neutral' && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 3,
                        background: `${intentColor}22`, color: intentColor,
                      }}>
                        {INTENT_LABELS[intent]}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {chunks.length === 0 && (
          <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-tertiary)', fontSize: 12 }}>
            {isRecording ? 'Listening…' : 'No transcript yet. Start recording.'}
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
