'use client';

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Zap, Brain, Target, ArrowRight, Shield, Lightbulb } from 'lucide-react';
import type { Flashcard, FlashcardType } from '@/lib/copilot/copilot.types';
import { FLASHCARD_TYPE_LABELS, FLASHCARD_TYPE_COLORS } from '@/lib/copilot/copilot.types';

interface FlashcardStreamProps {
  cards: Flashcard[];
  onDismiss: (cardId: string) => void;
}

const TYPE_ICONS: Record<FlashcardType, React.ElementType> = {
  objection_handler:  Shield,
  value_statement:    Zap,
  discovery_prompt:   Brain,
  competitor_counter: Target,
  closing_move:       ArrowRight,
  insight:            Lightbulb,
};

function FlashcardItem({ card, onDismiss }: { card: Flashcard; onDismiss: () => void }) {
  const color = FLASHCARD_TYPE_COLORS[card.type];
  const Icon  = TYPE_ICONS[card.type];
  const label = FLASHCARD_TYPE_LABELS[card.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 48, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 380, damping: 30 }}
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${color}33`,
        borderLeft: `3px solid ${color}`,
        borderRadius: 12,
        padding: '14px 16px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* High-priority pulse */}
      {card.priority === 'high' && (
        <motion.div
          style={{
            position: 'absolute', inset: 0, borderRadius: 12,
            background: `${color}08`, pointerEvents: 'none',
          }}
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 6, flexShrink: 0,
          background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={13} style={{ color }} />
        </div>
        <span style={{ fontSize: 10, fontWeight: 800, color, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>
          {label}
          {card.priority === 'high' && (
            <span style={{ marginLeft: 6, background: `${color}22`, color, borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>
              ● LIVE
            </span>
          )}
        </span>
        <button
          onClick={onDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2, lineHeight: 0 }}
        >
          <X size={13} />
        </button>
      </div>

      {/* Trigger quote */}
      <div style={{
        fontSize: 10, color: 'var(--text-tertiary)', fontStyle: 'italic',
        marginBottom: 8, padding: '4px 8px', background: 'var(--bg-overlay)',
        borderRadius: 4, borderLeft: `2px solid ${color}44`,
      }}>
        "{card.trigger.slice(0, 80)}{card.trigger.length > 80 ? '…' : ''}"
      </div>

      {/* Headline */}
      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 5 }}>
        {card.headline}
      </div>

      {/* Body */}
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
        {card.body}
      </div>

      {/* Source */}
      {card.source && (
        <div style={{ marginTop: 8, fontSize: 10, color: 'var(--text-tertiary)' }}>
          📚 Source: {card.source}
        </div>
      )}
    </motion.div>
  );
}

export function FlashcardStream({ cards, onDismiss }: FlashcardStreamProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to top when high-priority card arrives
  useEffect(() => {
    const hasHigh = cards.some(c => !c.dismissed && c.priority === 'high');
    if (hasHigh && scrollRef.current) {
      scrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [cards]);

  const active = cards
    .filter(c => !c.dismissed)
    .sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1;
      if (b.priority === 'high' && a.priority !== 'high') return 1;
      return b.createdAt.localeCompare(a.createdAt);
    });

  return (
    <div
      ref={scrollRef}
      style={{
        display: 'flex', flexDirection: 'column', gap: 10,
        overflowY: 'auto', flex: 1,
        scrollbarWidth: 'thin',
      }}
    >
      <AnimatePresence mode="popLayout">
        {active.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              textAlign: 'center', padding: '40px 20px',
              color: 'var(--text-tertiary)', fontSize: 12,
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🎯</div>
            Flashcards will appear here as the conversation unfolds.
          </motion.div>
        )}
        {active.map(card => (
          <FlashcardItem
            key={card.cardId}
            card={card}
            onDismiss={() => onDismiss(card.cardId)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
