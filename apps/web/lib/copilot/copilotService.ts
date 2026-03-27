/**
 * copilotService.ts
 *
 * All Firestore reads/writes for the AI Co-Pilot.
 * Edge functions write intent + flashcard results; this service
 * provides the client-side queries and onSnapshot hooks.
 */

'use client';

import { firebaseApp } from '@mfo-crm/config';
import {
  getFirestore, collection, doc, setDoc, updateDoc,
  getDoc, getDocs, query, orderBy, limit, onSnapshot,
  serverTimestamp, writeBatch, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import type {
  SessionContext, TranscriptChunk, Flashcard,
  MeddicState, SpinState, ChallengerState,
  MethodologyState, AnalyzeRequest,
} from './copilot.types';
import { defaultMeddicState, defaultSpinState, defaultChallengerState } from './copilot.types';

const db = getFirestore(firebaseApp);

// ─── Collection refs ───────────────────────────────────────────────────────────

const sessionsRef  = () => collection(db, 'copilot_sessions');
const sessionRef   = (id: string) => doc(db, 'copilot_sessions', id);
const chunksRef    = (id: string) => collection(db, 'copilot_sessions', id, 'chunks');
const cardsRef     = (id: string) => collection(db, 'copilot_sessions', id, 'flashcards');
const intentsRef   = (id: string) => collection(db, 'copilot_sessions', id, 'intents');
const stateDocRef  = (id: string, method: string) => doc(db, 'copilot_sessions', id, `${method}_state`, 'current');

// ─── Session lifecycle ─────────────────────────────────────────────────────────

export async function createSession(
  ctx: Omit<SessionContext, 'sessionId' | 'startedAt' | 'status'>,
): Promise<SessionContext> {
  const sessionId = uuidv4();
  const session: SessionContext = {
    ...ctx,
    sessionId,
    startedAt: new Date().toISOString(),
    status: 'idle',
  };
  // Firestore rejects undefined field values — strip them before writing
  const sessionPayload = Object.fromEntries(
    Object.entries(session).filter(([, v]) => v !== undefined),
  ) as SessionContext;
  await setDoc(sessionRef(sessionId), sessionPayload);


  // Initialize the methodology state doc
  const method = ctx.methodology.toLowerCase().replace(' ', '_');
  let initState: MethodologyState;
  if (ctx.methodology === 'MEDDIC') initState = defaultMeddicState(sessionId);
  else if (ctx.methodology === 'SPIN') initState = defaultSpinState(sessionId);
  else initState = defaultChallengerState(sessionId);

  await setDoc(stateDocRef(sessionId, method), initState);
  return session;
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionContext['status'],
): Promise<void> {
  const patch: Partial<SessionContext> = { status };
  if (status === 'ended') patch.endedAt = new Date().toISOString();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await updateDoc(sessionRef(sessionId), patch as any);
}

export async function getSession(sessionId: string): Promise<SessionContext | null> {
  const snap = await getDoc(sessionRef(sessionId));
  return snap.exists() ? (snap.data() as SessionContext) : null;
}

export async function getUserSessions(
  tenantId: string,
  userId: string,
  max = 20,
): Promise<SessionContext[]> {
  const q = query(
    sessionsRef(),
    where('tenantId', '==', tenantId),
    where('userId', '==', userId),
    orderBy('startedAt', 'desc'),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => d.data() as SessionContext);
}

// ─── Transcript chunks ─────────────────────────────────────────────────────────

/**
 * Appends a transcript chunk to Firestore and triggers the edge AI analysis.
 * The edge function writes the intent + flashcard back to Firestore.
 */
export async function appendChunkAndAnalyze(
  chunk: TranscriptChunk,
  context: SessionContext,
  recentChunks: TranscriptChunk[],
  currentState: MethodologyState | null,
): Promise<void> {
  // 1. Write chunk to Firestore
  await setDoc(doc(chunksRef(chunk.sessionId), chunk.chunkId), chunk);

  // 2. Fire edge function (non-blocking — response writes back to Firestore)
  const payload: AnalyzeRequest = { context, chunk, recentChunks, currentState };
  fetch('/api/copilot/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch(err => console.warn('[copilot] analyze edge fn error:', err));
}

// ─── Flashcard actions ─────────────────────────────────────────────────────────

export async function dismissFlashcard(sessionId: string, cardId: string): Promise<void> {
  await updateDoc(doc(cardsRef(sessionId), cardId), { dismissed: true });
}

// ─── onSnapshot listeners (for Seller UI) ─────────────────────────────────────

export function subscribeToFlashcards(
  sessionId: string,
  onCards: (cards: Flashcard[]) => void,
): Unsubscribe {
  const q = query(
    cardsRef(sessionId),
    orderBy('createdAt', 'desc'),
    limit(50),
  );
  return onSnapshot(q, snap => {
    onCards(snap.docs.map(d => d.data() as Flashcard));
  });
}

export function subscribeToChunks(
  sessionId: string,
  onChunks: (chunks: TranscriptChunk[]) => void,
): Unsubscribe {
  const q = query(chunksRef(sessionId), orderBy('startMs', 'asc'));
  return onSnapshot(q, snap => {
    onChunks(snap.docs.map(d => d.data() as TranscriptChunk));
  });
}

export function subscribeToMethodologyState(
  sessionId: string,
  methodology: string,
  onState: (state: MethodologyState) => void,
): Unsubscribe {
  const method = methodology.toLowerCase().replace(' ', '_');
  return onSnapshot(stateDocRef(sessionId, method), snap => {
    if (snap.exists()) onState(snap.data() as MethodologyState);
  });
}

export function subscribeToSession(
  sessionId: string,
  onSession: (session: SessionContext) => void,
): Unsubscribe {
  return onSnapshot(sessionRef(sessionId), snap => {
    if (snap.exists()) onSession(snap.data() as SessionContext);
  });
}
