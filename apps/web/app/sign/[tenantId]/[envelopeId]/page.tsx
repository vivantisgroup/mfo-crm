'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@mfo-crm/config';
import { Check, ShieldCheck, Mail, Send, Fingerprint, Lock, ArrowRight, Eye, Download, DownloadCloud, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const DynamicPdfViewer = dynamic(() => import('./ClientPdfViewer').then(mod => mod.ClientPdfViewer), { ssr: false });

const DICT = {
  en: {
     disclosureTitle: "Electronic Record & Signature Disclosure",
     disclosureDesc: "Please read the electronic record and signature disclosure. By checking the boxes below, you consent to do business electronically with the issuing party and to electronically sign this document using MFO Trust Engine cryptographical stamping.",
     consentBox1: "I consent to doing business electronically and agree to receive electronic disclosures and records.",
     consentBox2: "I explicitly agree to sign this requested document electronically via cryptographic stamping.",
     continueBtn: "Continue to Document",
     verifiedBadge: "Electronic Consent Verified",
     verifiedDesc: "You have legally agreed to utilize cryptographic stamping for this document.",
     executeSec: "Execute Signature",
     btnSign: "Click to Sign / Finalize Signature",
     btnSigning: "Sealing Cryptographically...",
     auditDesc: "By clicking Finalize Signature, your IP address and device fingerprint will be permanently recorded in the immutable audit trail against this document hash."
  },
  pt: {
     disclosureTitle: "Divulgação de Assinatura e Registro Eletrônico",
     disclosureDesc: "Por favor, leia a divulgação de registro e assinatura eletrônica. Ao marcar as caixas abaixo, você concorda em realizar negócios eletronicamente com a parte emissora e em assinar este documento eletronicamente usando a estampagem criptográfica do MFO Trust Engine.",
     consentBox1: "Eu concordo em realizar negócios eletronicamente e concordo em receber divulgações e registros eletrônicos.",
     consentBox2: "Eu concordo explicitamente em assinar este documento solicitado eletronicamente via estampagem criptográfica.",
     continueBtn: "Continuar para o Documento",
     verifiedBadge: "Consentimento Eletrônico Verificado",
     verifiedDesc: "Você concordou legalmente em utilizar a estampagem criptográfica para este documento.",
     executeSec: "Executar Assinatura",
     btnSign: "Clique para Assinar / Finalizar Assinatura",
     btnSigning: "Selando Criptograficamente...",
     auditDesc: "Ao clicar em Finalizar Assinatura, seu endereço IP e identificação do dispositivo serão permanentemente gravados na trilha de auditoria imutável contra o hash deste documento."
  }
};

function DrawingCanvas({ onDrawEnd }: { onDrawEnd: (base64: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
         ctx.lineWidth = 4;
         ctx.lineCap = 'round';
         ctx.lineJoin = 'round';
         ctx.strokeStyle = '#1e3a8a'; // dark blue ink
      }
    }
  }, []);

  const getPos = (e: any) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
       x: (clientX - rect.left) * (canvas.width / rect.width),
       y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  };

  const startDrawing = (e: any) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: any) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    
    if (e.cancelable) e.preventDefault(); // prevent scrolling
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (isDrawing) {
       setIsDrawing(false);
       const canvas = canvasRef.current;
       if (canvas) onDrawEnd(canvas.toDataURL('image/png'));
    }
  };

  return (
    <div className="border border-slate-300 rounded-xl bg-slate-50 relative overflow-hidden select-none">
       <canvas 
          ref={canvasRef}
          width={800} 
          height={320} 
          className="w-full h-[160px] touch-none cursor-crosshair"
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
       />
       <button 
         type="button" 
         onClick={() => {
           const canvas = canvasRef.current;
           const ctx = canvas?.getContext('2d');
           if (canvas && ctx) {
             ctx.clearRect(0, 0, canvas.width, canvas.height);
             onDrawEnd('');
           }
         }}
         className="absolute bottom-2 right-2 text-xs bg-white text-slate-500 font-bold border border-slate-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-slate-100 transition-colors"
       >
         Clear Ink
       </button>
    </div>
  );
}

export default function SignDocumentPage() {
  const { tenantId, envelopeId } = useParams() as { tenantId: string; envelopeId: string };
  const searchParams = useSearchParams();
  const email = searchParams.get('email');

  const [envelope, setEnvelope] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filledTags, setFilledTags] = useState<Record<string, any>>({});
  const [activeTagForSignature, setActiveTagForSignature] = useState<any>(null);
  const [activeTagForText, setActiveTagForText] = useState<any>(null);
  const [signatureInput, setSignatureInput] = useState('');
  const [textFormInput, setTextFormInput] = useState('');
  const [signatureImageBase64, setSignatureImageBase64] = useState<string | null>(null);
  const [signatureTab, setSignatureTab] = useState<'type'|'upload'|'draw'>('type');
  const [lang, setLang] = useState<'en'|'pt'>('en');

  // Legal Gates
  const [consentPassed, setConsentPassed] = useState(false);
  const [consentGiven, setConsentGiven] = useState(false);
  const [agreedToRecords, setAgreedToRecords] = useState(false);
  const [tenantLogo, setTenantLogo] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string>('');
  const [senderName, setSenderName] = useState<string>('');
  const [senderEmail, setSenderEmail] = useState<string>('');
  
  // OTP Verification
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpStatus, setOtpStatus] = useState<'idle'|'sending'|'sent'|'verifying'>('idle');
  
  // PDF Viewer State
  const [numPages, setNumPages] = useState<number>(1);
  
  // Signature Finalization
  const [isSigning, setIsSigning] = useState(false);
  const [hasSigned, setHasSigned] = useState(false);
  const [finalHash, setFinalHash] = useState('');
  const [signedDocUrl, setSignedDocUrl] = useState('');
  
  // Custom Popups to replace native toast.error()
  const [popupMessage, setPopupMessage] = useState<{title: string, message: string} | null>(null);

  useEffect(() => {
    if (typeof navigator !== 'undefined') {
       const blang = navigator.language.toLowerCase();
       setLang(blang.startsWith('pt') ? 'pt' : 'en');
    }
    
    async function load() {
      if (!tenantId || !envelopeId || !email) {
        setError('Missing validation parameters from strict magic link.');
        setLoading(false);
        return;
      }

      const db = getFirestore(firebaseApp);
      const docRef = doc(db, 'tenants', tenantId, 'envelopes', envelopeId);
      const snap = await getDoc(docRef);

      if (!snap.exists()) {
        setError('Document not found or has been revoked.');
        setLoading(false);
        return;
      }

      try {
        const metaRes = await fetch(`/api/signatures/public-meta?tenantId=${tenantId}&envelopeId=${envelopeId}`);
        if (metaRes.ok) {
           const meta = await metaRes.json();
           if (meta.logo) setTenantLogo(meta.logo);
           if (meta.tenantName) setTenantName(meta.tenantName);
           if (meta.senderName) setSenderName(meta.senderName);
           if (meta.senderEmail) setSenderEmail(meta.senderEmail);
        }
      } catch (err) {
        console.warn('Failed to fetch public metadata:', err);
      }

      const data = snap.data();
      const me = data.signers?.find((s:any) => s.email === email);
      
      if (!me) {
        setError('You are not authorized to sign this document.');
        setLoading(false);
        return;
      }

      setEnvelope(data);
      if (me.status === 'completed') {
         setHasSigned(true);
         setFinalHash(data.finalHash || 'Unknown Hash - Verified via Backend');
      }

      if (data.requireOtp && !me.otpVerified && me.status !== 'completed') {
         setRequiresOtp(true);
      } else {
         setOtpVerified(true);
      }

      setLoading(false);

      // Log Telemetry: Opened Event
      if (me.status !== 'completed') {
        fetch('/api/signatures/telemetry', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({
             tenantId, envelopeId, type: 'opened',
             clientInfo: { email, timeAtOpen: new Date().toISOString() }
           })
        });
      }
    }
    load();
  }, [tenantId, envelopeId, email]);

  const myIndex = envelope?.signers?.findIndex((s:any) => s.email === email) ?? -1;
  const myTags = envelope?.tags?.filter((t:any) => t.recipientIndex === myIndex) || [];
  const pendingTags = myTags.filter((t:any) => !filledTags[t.id]);
  const hasPendingTags = pendingTags.length > 0;

  const scrollToNextTag = () => {
     if (hasPendingTags) {
        const nextTag = pendingTags[0];
        const el = document.getElementById(`tag-${nextTag.id}`);
        if (el) {
           el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
     }
  };

  const handleFinalSign = async () => {
    if (!consentGiven || !agreedToRecords) return;
    
    if (envelope?.signers && envelope?.tags) {
       const myIndex = envelope.signers.findIndex((s:any) => s.email === email);
       const myTags = envelope.tags.filter((t:any) => t.recipientIndex === myIndex);
       if (myTags.length > 0 && Object.keys(filledTags).length < myTags.length) {
           setPopupMessage({ title: 'Missing Signatures', message: 'Please click all signature, initials, and date blocks assigned to you on the document before finalizing.' });
           return;
       }
    }

    setIsSigning(true);
    try {
       let frontendGeoInfo: any = {};
       try {
          const geoRes = await fetch('https://get.geojs.io/v1/ip/geo.json');
          if (geoRes.ok) frontendGeoInfo = await geoRes.json();
       } catch(e) { console.warn('Could not fetch client geolocation', e); }

       const res = await fetch('/api/signatures/finalize', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            tenantId, 
            envelopeId, 
            email, 
            filledTags,
            clientGeo: {
               ip: frontendGeoInfo.ip,
               city: frontendGeoInfo.city,
               country: frontendGeoInfo.country,
               lat: frontendGeoInfo.latitude,
               lon: frontendGeoInfo.longitude,
               userAgent: navigator.userAgent
            }
         })
       });

       const json = await res.json();
       if (!res.ok) throw new Error(json.error || 'Failed to sign');
       
       setFinalHash(json.hash);
       setSignedDocUrl(json.url || envelope?.documentUrl);
       setHasSigned(true);
       setPopupMessage({ title: 'Success', message: 'Signature successful. You may close this window.' });
    } catch (e: any) {
       console.error(e);
       setPopupMessage({ title: 'Signature Error', message: e.message });
    } finally {
       setIsSigning(false);
    }
  };

  const handleRequestOtp = async () => {
     setOtpStatus('sending');
     try {
       const res = await fetch('/api/signatures/otp/request', {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ tenantId, envelopeId, email })
       });
       if (!res.ok) throw new Error('Failed to dispatch OTP');
       setOtpStatus('sent');
     } catch (e: any) {
       setPopupMessage({ title: 'OTP Error', message: e.message });
       setOtpStatus('idle');
     }
  };

  const handleVerifyOtp = async () => {
     setOtpStatus('verifying');
     try {
       const res = await fetch('/api/signatures/otp/verify', {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ tenantId, envelopeId, email, code: otpCode })
       });
       const json = await res.json();
       if (!res.ok) throw new Error(json.error || 'Failed to verify');
       
       setOtpVerified(true);
       setRequiresOtp(false);
       
       // Fire Opened Event now that they are physically in
       fetch('/api/signatures/telemetry', {
         method: 'POST', headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ tenantId, envelopeId, type: 'opened', clientInfo: { email } })
       });

     } catch (e: any) {
       setPopupMessage({ title: 'Verification Error', message: e.message });
       setOtpStatus('sent');
     }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center font-bold text-gray-500 animate-pulse">Establishing Secure Hash Verifications...</div>;
  if (error) return <div className="min-h-screen flex flex-col items-center justify-center p-8"><div className="bg-red-50 text-red-700 p-6 rounded-xl border border-red-200 shadow max-w-md w-full text-center font-bold">{error}</div></div>;

  return (
    <div className="h-[100dvh] bg-[var(--bg-background)] flex flex-col overflow-hidden w-full">
      {/* Top Banner */}
      <div className="bg-white border-b border-[var(--border)] h-[60px] flex items-center justify-between px-6 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.05)] shrink-0 z-50 relative">
         <div className="flex items-center gap-4">
            {tenantLogo ? (
               <img src={tenantLogo} alt={tenantName || "Company Logo"} className="h-[36px] w-auto max-w-[180px] object-contain drop-shadow-sm" />
            ) : (
               <div className="w-10 h-10 rounded-lg bg-[var(--brand-faint)] text-[var(--brand-primary)] flex items-center justify-center ring-1 ring-blue-100"><ShieldCheck size={20} /></div>
            )}
            
            <div className="h-8 w-px bg-slate-200 hidden sm:block"></div>
            
            <div>
               <div className="flex items-center gap-2">
                  <div className="font-extrabold text-[1rem] tracking-tight text-slate-800 leading-tight">
                     {tenantName || "Secure Document Portal"}
                  </div>
                  <div className="hidden sm:flex px-2 py-0.5 bg-blue-50 text-[var(--brand-primary)] text-[0.65rem] font-bold rounded shadow-sm border border-blue-100 uppercase tracking-widest items-center">
                     E-Signature
                  </div>
               </div>
               <div className="text-[0.7rem] bg-clip-text text-transparent bg-gradient-to-r from-slate-500 to-slate-400 font-bold uppercase tracking-wider flex items-center gap-1 mt-0.5">
                  <Lock size={10} className="text-slate-400"/> AES-256 ENCRYPTED SESSION
               </div>
            </div>
         </div>
         
         {/* Optional right side info */}
         <div className="hidden md:block text-right">
            <div className="text-[0.8rem] font-semibold text-slate-700">{hasSigned ? "Document Executed" : "Pending Signature"}</div>
            <div className="text-[0.65rem] text-slate-400 uppercase tracking-wide">ID: {envelopeId.substring(0,8)}</div>
         </div>
      </div>

      {requiresOtp && !otpVerified ? (
         <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 animate-fade-in flex flex-col">
            <div className="m-auto max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center my-8">
               <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-blue-50/50">
                  <Lock size={32}/>
               </div>
               <h2 className="text-[1.5rem] font-bold tracking-tight text-slate-800 mb-2">Security Verification</h2>
               <p className="text-[0.875rem] text-slate-500 mb-8">This document requires an MFO-OTP authentication pin before you can view its contents.</p>
               
               {otpStatus === 'idle' && (
                  <Button onClick={handleRequestOtp} className="w-full h-12 text-lg">Send Passcode to Email</Button>
               )}
               {otpStatus === 'sending' && (
                  <Button disabled className="w-full h-12 text-lg bg-blue-100 text-blue-400">Dispatching to Email...</Button>
               )}
               {(otpStatus === 'sent' || otpStatus === 'verifying') && (
                  <div className="flex flex-col gap-4">
                     <p className="text-[0.75rem] font-bold text-blue-600 mb-2">Passcode sent! Check your inbox for {email}</p>
                     <Input 
                        type="text" 
                        maxLength={6} 
                        placeholder="000000" 
                        className="text-center text-3xl tracking-widest font-mono h-16 bg-slate-50 border-slate-300"
                        value={otpCode}
                        onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))}
                     />
                     <Button 
                        onClick={handleVerifyOtp} 
                        disabled={otpCode.length !== 6 || otpStatus === 'verifying'} 
                        className="w-full h-12 text-lg disabled:opacity-50"
                     >
                        {otpStatus === 'verifying' ? 'Verifying Node Signature...' : 'Unlock Document'}
                     </Button>
                  </div>
               )}
            </div>
         </div>
      ) : (!consentPassed && !hasSigned) ? (
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 md:p-8 animate-fade-in flex flex-col relative">
             <div className="absolute top-0 inset-x-0 h-[25vh] bg-[#0f172a] pointer-events-none"></div>
             <div className="m-auto max-w-lg w-full bg-white rounded-3xl shadow-2xl border border-slate-200 p-8 md:p-10 z-10 relative my-8">
                {tenantLogo && (
                   <div className="mb-6 flex justify-center">
                      <img src={tenantLogo} alt="Tenant Logo" className="h-[48px] object-contain max-w-[200px]" />
                   </div>
                )}

                <div className="mb-8 flex flex-col gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[0.875rem] gap-1">
                      <div className="text-slate-500 font-medium whitespace-nowrap text-xs uppercase tracking-wider">Sender</div>
                      <div className="font-semibold text-slate-800 sm:text-right">
                          <div className="leading-tight">{senderName || tenantName}</div>
                          {senderEmail && <div className="text-[0.65rem] text-slate-500 font-normal">{senderEmail}</div>}
                      </div>
                   </div>
                   <div className="w-full h-px bg-slate-200 my-0.5"></div>
                   <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-[0.875rem] gap-1">
                      <div className="text-slate-500 font-medium whitespace-nowrap text-xs uppercase tracking-wider">Signer</div>
                      <div className="font-semibold text-slate-800 sm:text-right">
                          <div className="leading-tight">{envelope?.signers?.find((s:any) => s.email === email)?.name || 'You'}</div>
                          <div className="text-[0.65rem] text-slate-500 font-normal">{email}</div>
                      </div>
                   </div>
                </div>

                <h2 className="text-[1.75rem] font-black tracking-tight text-slate-800 mb-2">{DICT[lang].disclosureTitle}</h2>
                <p className="text-[0.875rem] text-slate-500 mb-8 border-b border-slate-100 pb-6 leading-relaxed">
                   {DICT[lang].disclosureDesc}
                </p>

                <div className="space-y-4 mb-8">
                   <label className="flex items-start gap-4 p-5 rounded-xl border border-[var(--border)] bg-gray-50/50 cursor-pointer hover:border-[var(--brand-primary)] hover:bg-blue-50/30 transition-colors shadow-sm">
                      <input type="checkbox" checked={agreedToRecords} onChange={e => setAgreedToRecords(e.target.checked)} className="mt-1 w-5 h-5 text-[var(--brand-primary)] bg-white border-gray-300 rounded focus:ring-[var(--brand-primary)]" />
                      <span className="text-[0.875rem] text-[var(--text-secondary)] font-medium leading-relaxed">{DICT[lang].consentBox1}</span>
                   </label>
                   
                   <label className="flex items-start gap-4 p-5 rounded-xl border border-[var(--border)] bg-gray-50/50 cursor-pointer hover:border-[var(--brand-primary)] hover:bg-blue-50/30 transition-colors shadow-sm">
                      <input type="checkbox" checked={consentGiven} onChange={e => setConsentGiven(e.target.checked)} className="mt-1 w-5 h-5 text-[var(--brand-primary)] bg-white border-gray-300 rounded focus:ring-[var(--brand-primary)]" />
                      <span className="text-[0.875rem] text-[var(--text-secondary)] font-medium leading-relaxed">{DICT[lang].consentBox2}</span>
                   </label>
                </div>

                <Button 
                   disabled={!agreedToRecords || !consentGiven} 
                   className="w-full py-6 text-lg tracking-tight font-bold shadow-xl shadow-blue-500/20"
                   onClick={() => setConsentPassed(true)}
                >
                   {DICT[lang].continueBtn}
                </Button>
             </div>
          </div>
      ) : (
      <div className="flex-1 flex flex-col lg:flex-row max-w-[1200px] w-full mx-auto relative overflow-hidden min-h-0 bg-slate-100">
         
         {/* Sidebar Actions */}
         <div className="w-full lg:w-[340px] border-b lg:border-l lg:border-b-0 border-[var(--border)] bg-[var(--bg-surface)] flex flex-col shrink-0 lg:order-2 overflow-hidden shadow-md z-20">
             <div className="flex-1 p-6 overflow-y-auto">
             <div className="mb-6">
                <h3 className="font-bold text-[1.125rem] text-[var(--text-primary)] mb-1">MFO Trust Engine</h3>
                <p className="text-[0.75rem] text-[var(--text-secondary)]">You are cryptographically identifying as:</p>
                <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3">
                   <div className="bg-white p-2 rounded-full shadow-sm text-blue-600"><Mail size={16}/></div>
                   <div className="font-semibold text-[0.875rem] text-blue-900 break-all">{email}</div>
                </div>
             </div>

             {/* Document Downloads */}
             <div className="mb-8 flex flex-col gap-2">
                 <Button variant="outline" className="w-full text-[0.75rem] flex justify-between px-4 border-slate-300 shadow-sm" onClick={() => window.open(`/api/signatures/document?url=${encodeURIComponent(envelope.originalDocumentUrl || envelope.documentUrl)}`, '_blank')}>
                    <span className="font-semibold text-slate-700">Download Original PDF</span>
                    <DownloadCloud size={14} className="text-slate-400" />
                 </Button>
                 
                 {envelope.status === 'completed' && (
                     <Button variant="outline" className="w-full text-[0.75rem] flex justify-between px-4 border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm hover:bg-emerald-100" onClick={() => window.open(`/api/signatures/document?url=${encodeURIComponent(envelope.documentUrl)}`, '_blank')}>
                        <span className="font-semibold">Download Executed PDF</span>
                        <Check size={14} className="text-emerald-600" />
                     </Button>
                 )}
                 
                 {(hasSigned && envelope.status !== 'completed') && (
                     <Button variant="outline" className="w-full text-[0.75rem] flex justify-between px-4 border-blue-200 bg-blue-50 text-blue-800 shadow-sm hover:bg-blue-100" onClick={() => window.open(`/api/signatures/document?url=${encodeURIComponent(signedDocUrl || envelope.documentUrl)}`, '_blank')}>
                        <span className="font-semibold">Download Signed PDF (In Progress)</span>
                        <Download size={14} className="text-blue-600" />
                     </Button>
                 )}
             </div>

             {hasSigned ? (
                <div className="p-6 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex flex-col items-center text-center animate-fade-in shadow-sm">
                   <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600 ring-8 ring-emerald-50/50">
                      <Check size={32}/>
                   </div>
                   <h4 className="font-extrabold text-[1.25rem] mb-2 tracking-tight">Signature Sealed</h4>
                   <p className="text-[0.875rem] mb-6">This document has been tamper-proofed with an embedded SHA-256 seal.</p>
                   
                   <div className="w-full text-left bg-white p-3 rounded-lg border border-emerald-100 mb-6">
                      <div className="text-[0.65rem] font-bold text-emerald-600 uppercase mb-1 flex items-center gap-1"><Fingerprint size={12}/> Cryptographic Hash Checksum</div>
                      <code className="text-[0.65rem] break-all leading-tight text-emerald-900">{finalHash}</code>
                   </div>

                   <Button className="w-full" onClick={() => window.open(`/api/signatures/document?url=${encodeURIComponent(signedDocUrl || envelope.documentUrl)}`, '_blank')}>Download Authenticated Copy</Button>
                </div>
             ) : (
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-start gap-3 mb-2">
                       <div className="mt-0.5 text-blue-600 bg-white p-1 rounded-full shadow-sm"><Check size={14}/></div>
                       <div>
                           <div className="text-[0.75rem] font-bold text-blue-900 mb-0.5">{DICT[lang].verifiedBadge}</div>
                           <div className="text-[0.65rem] text-blue-700 leading-tight">{DICT[lang].verifiedDesc}</div>
                       </div>
                   </div>
              )}
             </div>

             {!hasSigned && (
                <div className="p-6 bg-white border-t border-[var(--border)] relative z-10 shrink-0 shadow-[0_-15px_20px_-10px_rgba(0,0,0,0.05)]">
                   <div className="flex items-center gap-2 text-[var(--brand-primary)] font-bold text-[0.875rem] mb-4">
                      <div className="bg-[var(--brand-primary)] text-white w-5 h-5 rounded-full flex items-center justify-center text-[10px]"><Lock size={12}/></div> 
                      {DICT[lang].executeSec}
                   </div>
                   <Button 
                      onClick={handleFinalSign} 
                      disabled={!agreedToRecords || !consentGiven || isSigning}
                      className={`w-full py-6 text-lg tracking-tight font-black ${agreedToRecords && consentGiven ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xl shadow-emerald-600/20' : 'bg-slate-200 text-slate-400'}`}
                   >
                      {isSigning ? DICT[lang].btnSigning : DICT[lang].btnSign}
                   </Button>
                   <p className="text-[0.65rem] text-center text-[var(--text-tertiary)] mt-3 leading-tight">{DICT[lang].auditDesc}</p>
                </div>
             )}
         </div>

         {/* Document Workspace */}
         <div className="flex-1 bg-slate-100 p-8 flex flex-col items-center overflow-y-auto order-1 relative border-r border-[var(--border)]">
             {/* Auto-Nav Sign Helper */}
             {hasPendingTags && !hasSigned && (
                <div className="fixed left-[370px] top-32 z-50 animate-bounce">
                   <button onClick={scrollToNextTag} className="bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-extrabold px-6 py-3 rounded-full shadow-xl flex items-center gap-2 transform transition-transform hover:scale-105 border-4 border-white ring-4 ring-yellow-400/30">
                      {pendingTags.length === myTags.length ? 'START' : 'NEXT'} <ArrowRight size={20} />
                   </button>
                </div>
             )}
             <div className="w-full flex justify-center pb-20">
                <DynamicPdfViewer 
                   fileUrl={`/api/signatures/document?url=${encodeURIComponent((hasSigned && signedDocUrl) ? signedDocUrl : envelope.documentUrl)}`}
                   setNumPages={setNumPages}
                   tags={hasSigned ? [] : envelope.tags}
                   signers={envelope.signers}
                   myEmail={email}
                   filledTags={filledTags}
                   onTagClick={(tag) => {
                      if (!agreedToRecords || !consentGiven) {
                        setPopupMessage({ title: 'Legal Consent Required', message: 'Please check the legal consent boxes on the side panel before adopting signatures.' });
                        return;
                      }
                      
                      if (tag.type === 'date') {
                          const me = envelope?.signers?.find((s:any) => s.email === email);
                          let dateStr = new Date().toLocaleDateString();
                          const fmt = me?.dateFormat;
                          const d = new Date();
                          if (fmt === 'DD/MM/YYYY') {
                              dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
                          } else if (fmt === 'MM/DD/YYYY') {
                              dateStr = `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
                          } else if (fmt === 'YYYY-MM-DD') {
                              dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
                          } else if (me?.language === 'pt') {
                              dateStr = d.toLocaleDateString('pt-BR');
                          } else if (me?.language === 'en') {
                              dateStr = d.toLocaleDateString('en-US');
                          }
                          setFilledTags(prev => ({ ...prev, [tag.id]: dateStr }));
                      } else if (tag.type === 'text') {
                          setTextFormInput(filledTags[tag.id] || '');
                          setActiveTagForText(tag);
                      } else {
                          const myName = envelope.signers?.find((s:any) => s.email === email)?.name || email;
                          if (tag.type === 'initials') {
                              const parts = myName.trim().split(' ').filter(Boolean);
                              const inits = parts.length > 1 ? (parts[0][0] + parts[parts.length-1][0]).toUpperCase() : myName.substring(0, 2).toUpperCase();
                              setSignatureInput(inits);
                          } else {
                              setSignatureInput(myName);
                          }
                          setActiveTagForSignature(tag);
                      }
                   }}
                />
             </div>
         </div>

      </div>
      )}

      {activeTagForText && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                 <div>
                    <h2 className="text-xl font-bold">Input Text</h2>
                    <p className="text-sm text-slate-500 mt-1">Please enter the required information.</p>
                 </div>
                 {tenantLogo && (
                    <img src={tenantLogo} alt="Tenant Logo" className="h-10 object-contain max-w-[120px]" />
                 )}
              </div>
              <div className="mt-2">
                 <Input 
                   autoFocus
                   placeholder="Type your response here..."
                   value={textFormInput}
                   onChange={e => setTextFormInput(e.target.value)}
                 />
              </div>
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-slate-100">
                 <Button variant="outline" onClick={() => { setActiveTagForText(null); setTextFormInput(''); }}>Cancel</Button>
                 <Button disabled={!textFormInput.trim()} onClick={() => {
                     setFilledTags(p => ({ ...p, [activeTagForText.id]: textFormInput }));
                     setActiveTagForText(null);
                     setTextFormInput('');
                 }} className="bg-blue-600 hover:bg-blue-700 text-white">Save Text</Button>
              </div>
           </div>
        </div>
      )}

      {activeTagForSignature && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
           <div className="bg-white max-w-md w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-4">
              <div className="flex items-start justify-between">
                 <div>
                    <h2 className="text-xl font-bold">Adopt Your {activeTagForSignature.type === 'initials' ? 'Initials' : 'Signature'}</h2>
                    <p className="text-sm text-slate-500 mt-1">Please confirm or adjust your cryptographic graphical representation.</p>
                 </div>
                 {tenantLogo && (
                    <img src={tenantLogo} alt="Tenant Logo" className="h-10 object-contain max-w-[120px]" />
                 )}
              </div>

              <div className="flex bg-slate-100 p-1 rounded-lg">
                 <button className={`flex-1 py-1.5 text-sm font-bold rounded-md ${signatureTab === 'type' ? 'bg-white shadow' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setSignatureTab('type')}>Type</button>
                 <button className={`flex-1 py-1.5 text-sm font-bold rounded-md ${signatureTab === 'draw' ? 'bg-white shadow' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setSignatureTab('draw')}>Draw</button>
                 <button className={`flex-1 py-1.5 text-sm font-bold rounded-md ${signatureTab === 'upload' ? 'bg-white shadow' : 'text-slate-500 hover:text-slate-800'}`} onClick={() => setSignatureTab('upload')}>Upload</button>
              </div>

              {signatureTab === 'type' ? (
                <>
                  <div>
                     <Input value={signatureInput} onChange={e => setSignatureInput(e.target.value)} className="font-bold text-lg" />
                  </div>
                  <div className="p-8 bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-xl flex items-center justify-center min-h-[120px] overflow-hidden">
                     <span className="font-serif italic text-blue-900 drop-shadow-sm truncate max-w-full origin-left" style={{ fontSize: '42px', lineHeight: 1 }}>
                        {signatureInput || 'Type below...'}
                     </span>
                  </div>
                </>
              ) : signatureTab === 'draw' ? (
                 <DrawingCanvas onDrawEnd={(b64) => setSignatureImageBase64(b64)} />
              ) : (
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-6 flex flex-col items-center justify-center min-h-[160px] relative hover:border-blue-500 transition-colors bg-slate-50">
                   {signatureImageBase64 ? (
                      <img src={signatureImageBase64} alt="Signature Upload" className="max-h-[100px] object-contain" />
                   ) : (
                      <>
                        <UploadCloud size={32} className="text-slate-400 mb-2"/>
                        <p className="text-sm font-bold text-slate-600">Click to upload image</p>
                        <p className="text-xs text-slate-400 text-center px-4 mt-1">JPG or PNG. Transparent background recommended.</p>
                      </>
                   )}
                   <input type="file" accept="image/png, image/jpeg, image/jpg" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                       const f = e.target.files?.[0];
                       if (f) {
                          const reader = new FileReader();
                          reader.onload = (ev) => {
                              if (ev.target?.result) {
                                  const img = new Image();
                                  img.onload = () => {
                                      const canvas = document.createElement('canvas');
                                      let w = img.width;
                                      let h = img.height;
                                      const MAX_W = 600;
                                      const MAX_H = 300;
                                      if (w > MAX_W) { h *= MAX_W / w; w = MAX_W; }
                                      if (h > MAX_H) { w *= MAX_H / h; h = MAX_H; }
                                      canvas.width = w; canvas.height = h;
                                      const ctx = canvas.getContext('2d');
                                      ctx?.drawImage(img, 0, 0, w, h);
                                      setSignatureImageBase64(canvas.toDataURL('image/png'));
                                  };
                                  img.src = ev.target.result.toString();
                              }
                          };
                          reader.readAsDataURL(f);
                       }
                   }} />
                </div>
              )}

              <div className="flex justify-end gap-3 mt-4">
                 <Button variant="outline" onClick={() => {
                    setActiveTagForSignature(null);
                    setSignatureImageBase64(null);
                 }}>Cancel</Button>
                 <Button disabled={signatureTab === 'type' ? !signatureInput.trim() : !signatureImageBase64} onClick={() => {
                    setFilledTags(prev => ({ 
                        ...prev, 
                        [activeTagForSignature.id]: (signatureTab === 'upload' || signatureTab === 'draw') && signatureImageBase64 
                             ? { text: signatureInput.trim() || 'Signed', image: signatureImageBase64 } 
                             : signatureInput.trim() 
                    }));
                    setActiveTagForSignature(null);
                    setSignatureImageBase64(null);
                 }}>Adopt & Sign</Button>
              </div>
           </div>
        </div>
      )}

      {/* Custom Alert/Popup Modal */}
      {popupMessage && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in p-4">
           <div className="bg-white max-w-sm w-full rounded-2xl shadow-2xl p-6 flex flex-col gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto ring-8 ring-blue-50/50 mb-2">
                 <ShieldCheck size={24} />
              </div>
              <h2 className="text-xl font-bold text-slate-800 tracking-tight">{popupMessage.title}</h2>
              <p className="text-[0.875rem] text-slate-500 font-medium px-2">{popupMessage.message}</p>
              <Button onClick={() => setPopupMessage(null)} className="mt-4 w-full h-12 text-lg">Acknowledge</Button>
           </div>
        </div>
      )}
    </div>
  );
}
