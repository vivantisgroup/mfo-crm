'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { useSearchParams } from 'next/navigation';
import { Card, Title, Text, Button, Badge, TextInput } from '@tremor/react';
import { MessageSquare, Slack, CheckCircle2 } from 'lucide-react';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { firebaseApp, auth } from '@mfo-crm/config';

type MessagingProvider = 'teams' | 'slack' | 'google_chat' | null;

export function MessagingIntegrationSection() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [activeProvider, setActiveProvider] = useState<MessagingProvider>(null);
  const [loading, setLoading] = useState(true);
  const [showTeamsGuide, setShowTeamsGuide] = useState(false);
  const [showSlackGuide, setShowSlackGuide] = useState(false);
  
  const [teamsUpn, setTeamsUpn] = useState('');
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isMicrosoftConnected, setIsMicrosoftConnected] = useState(false);

  // Read OAuth redirect-back params
  const oauthSuccess    = searchParams?.get('oauth_success');
  const oauthError      = searchParams?.get('oauth_error');
  const msTokenPayload  = searchParams?.get('ms_token_payload'); // last-resort: Admin SDK failed on server

  useEffect(() => {
    if (!user) return;
    const fetchSettings = async () => {
      try {
        const db = getFirestore(firebaseApp);

        // ── Handle last-resort token write (Admin SDK unavailable on server) ──────
        // If the OAuth callback couldn't write tokens via Admin SDK, it encodes them
        // in the URL as a base64url payload. We write them here using the client SDK.
        if (msTokenPayload && oauthSuccess === 'microsoft') {
          try {
            const decoded = JSON.parse(atob(msTokenPayload.replace(/-/g, '+').replace(/_/g, '/')));
            const msRef = doc(db, 'users', user.uid, 'integrations', 'microsoft');
            await setDoc(msRef, {
              provider:      'microsoft',
              status:        'connected',
              connectedEmail: decoded.connectedEmail ?? '',
              connectedAt:   new Date().toISOString(),
              _accessToken:  decoded._accessToken,
              _refreshToken: decoded._refreshToken,
              _expiresAt:    decoded._expiresAt,
            }, { merge: true });
            console.log('[MessagingSection] Tokens saved via client SDK fallback for', decoded.connectedEmail);
            // Clean up the URL so the payload isn't bookmarked
            const clean = new URL(window.location.href);
            clean.searchParams.delete('ms_token_payload');
            window.history.replaceState({}, '', clean.toString());
          } catch (payloadErr) {
            console.error('[MessagingSection] Failed to decode/write ms_token_payload:', payloadErr);
          }
        }
        
        // Check base messaging settings
        const ref = doc(db, 'users', user.uid, 'integrations', 'messaging');
        const snap = await getDoc(ref);
        
        // Check if Microsoft is connected system-wide
        const msRef = doc(db, 'users', user.uid, 'integrations', 'microsoft');
        const msSnap = await getDoc(msRef);
        
        if (msSnap.exists() && msSnap.data().status === 'connected') {
          setIsMicrosoftConnected(true);
          setTeamsUpn(msSnap.data().connectedEmail || '');
        }

        if (snap.exists()) {
          const data = snap.data();
          setActiveProvider(data.provider as MessagingProvider);
          if (data.microsoftUpn) setTeamsUpn(data.microsoftUpn);
        }
      } catch (err) {
        console.error("Failed to fetch messaging config:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
    // Re-check if we just returned from Microsoft OAuth
    // (the callback writes to Firestore, so we need a fresh read)
    if (oauthSuccess === 'microsoft') fetchSettings();
  }, [user, oauthSuccess, msTokenPayload]);

  const handleMicrosoftAuth = async () => {
    setIsAuthenticating(true);
    if (isMicrosoftConnected) {
      // Already authenticated with Microsoft, just enable the Teams router
      await handleConnect('teams', teamsUpn);
      setIsAuthenticating(false);
    } else {
      // Fetch current user's Firebase ID token and embed it in the OAuth URL
      // so the callback can identify which Firestore user to write tokens to.
      try {
        const idToken = await auth.currentUser?.getIdToken();
        const returnTo = encodeURIComponent('/settings?tab=messaging');
        const idTokenParam = idToken ? `&idToken=${encodeURIComponent(idToken)}` : '';
        window.location.href = `/api/oauth/microsoft/start?returnTo=${returnTo}${idTokenParam}`;
      } catch (e) {
        console.error('[MessagingIntegrationSection] Could not fetch idToken', e);
        setIsAuthenticating(false);
      }
    }
  };

  const handleConnect = async (provider: MessagingProvider, upn?: string) => {
    if (!user) return;
    try {
      if (provider !== 'teams' && provider !== 'slack') return; 
      
      const db = getFirestore(firebaseApp);
      await setDoc(doc(db, 'users', user.uid, 'integrations', 'messaging'), {
        provider,
        ...(upn ? { microsoftUpn: upn } : {}),
        connectedAt: new Date().toISOString(),
      }, { merge: true });
      
      setActiveProvider(provider);
    } catch (err) {
      alert("Failed to connect provider");
    }
  };

  const handleDisconnect = async () => {
    if (!user) return;
    try {
      const db = getFirestore(firebaseApp);
      await setDoc(doc(db, 'users', user.uid, 'integrations', 'messaging'), {
        provider: null,
      }, { merge: true });
      setActiveProvider(null);
      setTeamsUpn('');
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return null;

  return (
    <div className="mt-8">
      <div className="mb-4">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">Enterprise Messaging</h2>
        <p className="text-sm text-slate-500 mt-1">
          Route internal CRM communication via standard messaging backends. Uses Webhooks and API hooks instead of polling local databases.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Microsoft Teams */}
        <Card className="flex flex-col relative overflow-hidden border-slate-200">
          {activeProvider === 'teams' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-indigo-600" />
          )}
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-md bg-[#EEF2FC] flex items-center justify-center text-[#5B5FC7]">
               <MessageSquare size={24} />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900">Microsoft Teams</h3>
               <span className="text-[11px] font-medium text-slate-500">M365 Graph Router</span>
             </div>
          </div>
          <Text className="text-sm text-slate-600 mb-4 flex-1">
            Treats your internal CRM teams implementation as a frontend mirroring Teams Graph endpoints directly. Free within standard M365 API allocations.
          </Text>
          <div className="mb-6">
            <button onClick={() => setShowTeamsGuide(!showTeamsGuide)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors flex items-center">
              {showTeamsGuide ? 'Hide' : 'Show'} Microsoft Entra ID Admin Guide
            </button>
            {showTeamsGuide && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
                <p><strong>1. Microsoft Entra ID App Registration</strong></p>
                <p>Ensure your underlying M365 App Registration includes the following highly-privileged delegated scopes:</p>
                <ul className="list-disc pl-4 space-y-1 mb-2 font-mono text-[10px] text-indigo-800">
                  <li>Chat.Read</li>
                  <li>ChatMessage.Send</li>
                  <li>Calendars.ReadWrite</li>
                </ul>
                <p><strong>2. Consent Flow</strong></p>
                <p>When users connect, they must be part of your MFO tenant, and a global administrator may need to grant admin consent for these directory-level read scopes in the Entra portal.</p>
              </div>
            )}
          </div>
          {activeProvider === 'teams' ? (
             <div className="flex justify-between items-center bg-indigo-50/50 p-2 rounded-lg border border-indigo-100">
               <div className="flex flex-col text-xs">
                 <span className="flex items-center gap-1.5 font-semibold text-indigo-700">
                   <CheckCircle2 size={14} /> Active Router
                 </span>
                 <span className="text-indigo-900 mt-1 opacity-70 truncate max-w-[150px]" title={teamsUpn}>UPN: {teamsUpn || 'Not defined'}</span>
               </div>
               <button onClick={handleDisconnect} className="text-xs font-medium text-slate-500 hover:text-red-600 px-2 py-1">Disconnect</button>
             </div>
          ) : (
             <div className="flex flex-col gap-3">
               <div>
                 <span className="text-xs font-semibold text-slate-700 mb-1 block">Account Identity Binding</span>
                 <TextInput placeholder="Enter M365 Email (UPN) e.g., user@domain.onmicrosoft.com" value={teamsUpn} onValueChange={setTeamsUpn} className="text-xs" disabled={isAuthenticating} />
                 <p className="text-[10px] text-slate-500 mt-1">Your exact Universal Principal Name is required to map your Teams Graph integration telemetry securely.</p>
               </div>
               
               <button 
                 onClick={handleMicrosoftAuth}
                 disabled={isAuthenticating || activeProvider !== null || (!isMicrosoftConnected && !teamsUpn.trim())}
                 className={`flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-[#8c8c8c] bg-white text-[#5e5e5e] hover:bg-[#f3f2f1] font-semibold text-[13px] rounded transition-colors ${((!isMicrosoftConnected && !teamsUpn.trim()) || isAuthenticating) ? 'opacity-50 cursor-not-allowed' : ''}`}
               >
                 {isAuthenticating ? (
                   <>
                     <div className="w-3.5 h-3.5 rounded-full border-2 border-[#5B5FC7] border-t-transparent animate-spin shrink-0" />
                     {isMicrosoftConnected ? 'Enabling...' : 'Authenticating...'}
                   </>
                 ) : isMicrosoftConnected ? (
                   <>
                     <MessageSquare size={16} /> Enable Teams Router
                   </>
                 ) : (
                   <>
                     <div className="flex shrink-0 -mt-px">
                       <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 23 23">
                         <path fill="#f35325" d="M1 1h10v10H1z"/>
                         <path fill="#81bc06" d="M12 1h10v10H12z"/>
                         <path fill="#05a6f0" d="M1 12h10v10H1z"/>
                         <path fill="#ffba08" d="M12 12h10v10H12z"/>
                       </svg>
                     </div>
                     Sign in with Microsoft
                   </>
                 )}
               </button>
             </div>
          )}
        </Card>

        {/* Slack */}
        <Card className={`flex flex-col relative overflow-hidden border-slate-200 ${activeProvider !== 'slack' ? 'opacity-80' : ''}`}>
          {activeProvider === 'slack' && (
            <div className="absolute top-0 left-0 w-full h-1 bg-[#E01E5A]" />
          )}
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-md bg-stone-100 flex items-center justify-center text-[#E01E5A]">
               <Slack size={24} />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900">Slack</h3>
               <span className="text-[11px] font-medium text-slate-500">Events API</span>
             </div>
          </div>
          <Text className="text-sm text-slate-600 mb-4 flex-1">
            Real-time chat integration routing communications via Slack.
          </Text>
          <div className="mb-6">
            <button onClick={() => setShowSlackGuide(!showSlackGuide)} className="text-xs font-semibold text-rose-600 hover:text-rose-800 transition-colors flex items-center">
              {showSlackGuide ? 'Hide' : 'Show'} Slack App Manifest Guide
            </button>
            {showSlackGuide && (
              <div className="mt-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 space-y-2">
                <p><strong>1. Create a Slack app</strong></p>
                <p>Go to api.slack.com/apps and create a new App from scratch assigned to your enterprise workspace.</p>
                <p><strong>2. Add Oauth Scopes</strong></p>
                <ul className="list-disc pl-4 space-y-1 mb-2 font-mono text-[10px] text-rose-800">
                  <li>channels:read</li>
                  <li>channels:history</li>
                  <li>chat:write</li>
                </ul>
                <p><strong>3. Enable Event Subscriptions</strong></p>
                <p>Toggle "Enable Events" and provide the webhook URL: <code>https://your-crm-domain.com/api/webhooks/slack</code></p>
              </div>
            )}
          </div>
          {activeProvider === 'slack' ? (
             <div className="flex justify-between items-center bg-rose-50 p-2 rounded-lg border border-rose-100">
               <span className="flex items-center gap-1.5 text-xs font-semibold text-rose-700">
                 <CheckCircle2 size={14} /> Active Router
               </span>
               <button onClick={handleDisconnect} className="text-xs font-medium text-slate-500 hover:text-red-600 px-2 py-1">Disconnect</button>
             </div>
          ) : (
             <Button variant="secondary" className="w-full font-medium" onClick={() => handleConnect('slack')} disabled={activeProvider !== null}>
               Connect Platform
             </Button>
          )}
        </Card>

        {/* Google Chat */}
        <Card className="flex flex-col border-slate-200 opacity-60 grayscale relative">
           <div className="absolute inset-0 z-10 bg-slate-50/10 cursor-not-allowed" title="Coming Soon"></div>
          <div className="flex items-center gap-3 mb-4">
             <div className="w-10 h-10 rounded-md bg-emerald-50 flex items-center justify-center text-emerald-600">
               <MessageSquare size={24} />
             </div>
             <div>
               <h3 className="font-semibold text-slate-900">Google Chat</h3>
               <span className="text-[11px] font-medium text-slate-500">Workspace API</span>
             </div>
          </div>
          <Text className="text-sm text-slate-600 mb-6 flex-1">
            Route messages natively through Google Chat spaces.
          </Text>
          <Button variant="light" className="w-full text-slate-400" disabled>Coming Soon</Button>
        </Card>
      </div>
    </div>
  );
}
