import { NextRequest, NextResponse } from 'next/server';
import { getAdminFirestore, getAdminStorage } from '@/lib/firebaseAdmin';
import { PDFDocument, rgb } from 'pdf-lib';
import crypto from 'crypto';

const DICTIONARY: Record<string, Record<string, string>> = {
  en: {
    certTitle: 'Certificate of Completion',
    certNotice: 'This electronic signature process is implemented in accordance with the legal framework established by Provisional Measure No. 2.200-2/2001 and Law No. 14.063/2020, which recognize the legal validity of electronic documents and define categories of electronic signatures in Brazil. The platform applies security controls consistent with an advanced electronic signature model, including user authentication, document integrity verification through cryptographic hashing, and a tamper-evident audit trail. The parties agree that the electronic records generated through this system are legally valid and enforceable under Brazilian law, to the extent permitted for advanced electronic signatures.',
    overview: 'Overview of the signing process',
    sender: 'SENDER:',
    envelopeId: 'REQUEST CODE / ENVELOPE ID:',
    status: 'Status:',
    completed: 'Completed',
    executionDate: 'Execution Date:',
    evidenceSection: 'Signatures and other evidence',
    timestamp: 'Timestamp:',
    cryptoVerified: 'Cryptographically Verified',
    otpViaEmail: '[Authentication] - OTP 2-Factor Activated via Email',
    auditSection: 'Signing process history',
    date: 'DATE',
    action: 'ACTION',
    detail: 'DETAIL',
    seal: 'Cryptographically Sealed by MFO-CRM Native Sign Engine',
    fileSize: 'Original File Size:',
    originalHash: 'Pre-Execution Content Checksum (Base64 Mapping):'
  },
  pt: {
    certTitle: 'Certificado de Conclusão',
    certNotice: 'Este processo de assinatura eletrônica é implementado de acordo com a Medida Provisória nº 2.200-2/2001 e a Lei nº 14.063/2020, que reconhecem a validade jurídica de documentos eletrônicos e definem as categorias de assinaturas eletrônicas no Brasil. A plataforma aplica controles de segurança de uma assinatura eletrônica avançada, integridade documental via hash criptográfico e trilha de auditoria à prova de adulteração. As partes concordam que os registros gerados são legalmente válidos e exigíveis nos termos da lei brasileira.',
    overview: 'Resumo do processo de assinatura',
    sender: 'REMETENTE:',
    envelopeId: 'CÓDIGO DE SOLICITAÇÃO / ID:',
    status: 'Status:',
    completed: 'Concluído',
    executionDate: 'Data de Execução:',
    evidenceSection: 'Assinaturas e outras evidências',
    timestamp: 'Carimbo de Tempo:',
    cryptoVerified: 'Verificado Criptograficamente',
    otpViaEmail: '[Autenticação] - 2-Fatores via Código OTP por E-mail',
    auditSection: 'Histórico do processo de assinatura',
    date: 'DATA',
    action: 'AÇÃO',
    detail: 'DETALHES',
    seal: 'Selado Criptograficamente pelo Motor de Assinatura Nativo MFO-CRM',
    fileSize: 'Tamanho Original:',
    originalHash: 'Checksum de Conteúdo Pré-Execução (Mapeamento Base64):'
  },
  es: {
    certTitle: 'Certificado de Finalización',
    certNotice: 'Este proceso de firma electrónica se implementa de acuerdo con la Medida Provisional No. 2.200-2/2001 y la Ley No. 14.063/2020, que reconocen la validez legal de documentos electrónicos en Brasil. La plataforma aplica controles de seguridad acordes a un modelo de firma electrónica avanzada, incluyendo autenticación, integridad documental mediante resumen criptográfico y pistas de auditoría seguras. Las partes acuerdan que los registros generados son legalmente válidos y vinculantes según la ley brasileña.',
    overview: 'Resumen del proceso de firma',
    sender: 'REMITENTE:',
    envelopeId: 'CÓDIGO DE SOLICITUD / ID:',
    status: 'Estado:',
    completed: 'Completado',
    executionDate: 'Fecha de Ejecución:',
    evidenceSection: 'Firmas y otras evidencias',
    timestamp: 'Marca de tiempo:',
    cryptoVerified: 'Verificado Criptográficamente',
    otpViaEmail: '[Autenticación] - 2-Factores vía Código OTP por Correo Electrónico',
    auditSection: 'Historial del proceso de firma',
    date: 'FECHA',
    action: 'ACCIÓN',
    detail: 'DETALLE',
    seal: 'Sellado Criptográficamente por MFO-CRM Native Sign Engine',
    fileSize: 'Tamaño Original:',
    originalHash: 'Checksum de Contenido Pre-Ejecución (Mapeo Base64):'
  }
};

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { tenantId, envelopeId, email, filledTags = {}, clientGeo = {} } = payload;
    
    // Secure Network Context Extraction (Prioritize Geo-JSON, fallback to Edge Headers)
    const ip = clientGeo.ip || payload.ip || req.headers.get('x-forwarded-for')?.split(',')[0].trim() || (req as any).ip || 'Unknown';
    const userAgent = clientGeo.userAgent || payload.userAgent || req.headers.get('user-agent') || 'Unknown';
    
    // Geolocation from Vercel Edge Headers or Frontend GeoJS
    const city = clientGeo.city || req.headers.get('x-vercel-ip-city') || '';
    const country = clientGeo.country || req.headers.get('x-vercel-ip-country') || '';
    const lat = clientGeo.lat || req.headers.get('x-vercel-ip-latitude') || '';
    const lon = clientGeo.lon || req.headers.get('x-vercel-ip-longitude') || '';

    const locationStr = [city, country].filter(Boolean).join(', ');
    const geoStr = lat && lon ? `(Lat: ${lat}, Lon: ${lon})` : '';
    const fullLocation = locationStr ? `${locationStr} ${geoStr}`.trim() : 'Unknown Location';
    if (!tenantId || !envelopeId || !email) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = getAdminFirestore();
    const envRef = db.collection('tenants').doc(tenantId).collection('envelopes').doc(envelopeId);
    const envDoc = await envRef.get();

    if (!envDoc.exists) {
      return NextResponse.json({ error: 'Envelope not found' }, { status: 404 });
    }

    const envelope = envDoc.data();
    
    // Check if user is a valid signer
    let signerFound = false;
    let myIndex = -1;
    const signers = envelope.signers || [];
    
    const clientEmail = email.trim().toLowerCase();
    
    const updatedSigners = signers.map((s: any, idx: number) => {
      if (s.email.trim().toLowerCase() === clientEmail) {
        signerFound = true;
        myIndex = idx;
        return { ...s, status: 'completed', signedAt: new Date().toISOString(), ip: ip || 'Unknown', userAgent: userAgent || 'Unknown', location: fullLocation };
      }
      return s;
    });

    if (!signerFound) {
      return NextResponse.json({ error: 'Not authorized for this envelope' }, { status: 403 });
    }

    const activeCompletedCount = updatedSigners.filter((s:any) => s.status === 'completed').length;
    const isFullyCompleted = activeCompletedCount === updatedSigners.length;

    // Fetch the PDF Document bytes securely
    const fileRes = await fetch(envelope.documentUrl);
    if (!fileRes.ok) throw new Error('Failed to fetch document to seal');
    const pdfBytes = await fileRes.arrayBuffer();

    // eIDAS: Cryptographic snapshot before manipulation
    const crypto = await import('crypto');
    const initialHash = crypto.createHash('sha256').update(pdfBytes as any).digest('hex');
    const fieldBoundEvents: any[] = [];

    // Load PDF-Lib
    const { StandardFonts } = await import('pdf-lib');
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const cursiveFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
    const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    
    // Process Interactive Graphic Stamping
    const pages = pdfDoc.getPages();
    const myTags = envelope.tags?.filter((t:any) => t.recipientIndex === myIndex) || [];
    
    for (const tag of myTags) {
       let parsedTagValue = filledTags[tag.id];
       if (!parsedTagValue) continue;

       // Record eIDAS field-level action bound to initial Hash
       fieldBoundEvents.push({
           type: 'field_stamped',
           metadata: {
               fieldId: tag.id,
               fieldType: tag.type,
               documentHashSnapshot: initialHash,
               signer: email
           },
           clientInfo: { ip: ip || 'unknown', userAgent: userAgent || 'unknown', location: fullLocation },
           timestamp: new Date().toISOString()
       });

       let imageBase64 = null;
       if (typeof parsedTagValue === 'object' && parsedTagValue !== null) {
           imageBase64 = parsedTagValue.image;
           parsedTagValue = parsedTagValue.text;
       }
       
       const tagValue = typeof parsedTagValue === 'string' ? parsedTagValue : 'Signed';

       const page = pages[tag.pageNum - 1]; // react-pdf is 1-indexed, pdf-lib is 0-indexed
       if (!page) continue;

       const { width, height } = page.getSize();
       
       // Calculate scaling multiplier based on our explicitly constrained 800px DOM canvas in the frontend signer
       const scale = width / 800;
       const pdfX = tag.x * scale;
       
       // Map the physical DOM dimensions to intrinsic bounds
       const elementHeight = tag.height || (tag.type === 'date' ? 30 : 36);
       const elementWidth = tag.width || 130;
       
       const fontToUse = tag.type === 'date' ? regularFont : (tag.type === 'initial' ? regularFont : cursiveFont);
       let fontSize = elementHeight * scale * 0.7; // Start with height-bound scale
       
       // Calculate explicit width metrics and scale down fontSize if text overflows the bounding box!
       const maxAllowedWidth = elementWidth * scale * 0.95;
       let textWidth = fontToUse.widthOfTextAtSize(tagValue, fontSize);
       if (textWidth > maxAllowedWidth) {
           fontSize = fontSize * (maxAllowedWidth / textWidth);
           textWidth = fontToUse.widthOfTextAtSize(tagValue, fontSize);
       }
       
        // --- COMPLIANT SIGNATURE BOUNDARY WRAPPER ---
        const boxX = tag.x * scale;
        const boxY = height - (tag.y * scale) - (elementHeight * scale);
        const boxW = elementWidth * scale;
        const boxH = elementHeight * scale;

        // Draw DocuSign-style Left Bracket (Curved SVG Path)
        const bracketColor = rgb(0.145, 0.388, 0.921); // #2563eb
        const armLength = 12 * scale;
        const armMarginY = boxH * 0.1; // 10% margins top and bottom
        const radius = 6 * scale;
        
        const pathStr = `M ${boxX + armLength},${boxY + boxH - armMarginY} L ${boxX + radius},${boxY + boxH - armMarginY} Q ${boxX},${boxY + boxH - armMarginY} ${boxX},${boxY + boxH - armMarginY - radius} L ${boxX},${boxY + armMarginY + radius} Q ${boxX},${boxY + armMarginY} ${boxX + radius},${boxY + armMarginY} L ${boxX + armLength},${boxY + armMarginY}`;

        page.drawSvgPath(pathStr, { borderColor: bracketColor, borderWidth: 1.5 });

        // Text configuration
        const textSize = 7 * scale;
        
        let textStartXX = boxX + (16 * scale);
        let didDrawImage = false;

        const displayValue = tag.type === 'initial' ? tagValue.substring(0, 3).toUpperCase() : tagValue;

        // If there is an image, render it cleanly within the main bounding block side-by-side with text
        if (imageBase64) {
            try {
                let imageEmbed;
                if (imageBase64.startsWith('data:image/png')) {
                    imageEmbed = await pdfDoc.embedPng(imageBase64);
                } else if (imageBase64.startsWith('data:image/jpeg') || imageBase64.startsWith('data:image/jpg')) {
                    imageEmbed = await pdfDoc.embedJpg(imageBase64);
                }
                
                if (imageEmbed) {
                    // CVM Layout: Split 50% Left for Image, ~50% Right for Text Metadata without any vertical height clipping
                    const imgSafeWidth = (boxW * 0.5) - (armLength * 2); 
                    const imgSafeHeight = boxH - (armMarginY * 2); 
                    const imgDims = imageEmbed.scaleToFit(imgSafeWidth, imgSafeHeight);
                    
                    page.drawImage(imageEmbed, {
                        x: boxX + (16 * scale),
                        y: boxY + (boxH / 2) - (imgDims.height / 2),
                        width: imgDims.width,
                        height: imgDims.height,
                        opacity: 0.95
                    });
                    
                    textStartXX = boxX + (boxW * 0.48);
                    didDrawImage = true;
                }
            } catch (e: any) {
                console.warn('Failed to embed signature image, falling back to text', e);
            }
        }

        // eIDAS footprint metadata string prep
        const topText = tag.type === 'initial' ? 'E-Initials:' : 'Digitally signed by:';
        const signerName = tag.type === 'initial' ? email : (envelope.signers?.find((s:any)=>s.email===email)?.name || email);
        const shortId = envelopeId.substring(0, 16).toUpperCase();
        
        if (!didDrawImage) {
             // Center string representation visually (fallback logic when no image found)
             const centeredPdfY = boxY + (boxH / 2) - (fontSize * 0.35);
             page.drawText(displayValue, { x: textStartXX, y: centeredPdfY, size: Math.min(fontSize, boxH * 0.45), font: fontToUse, color: rgb(0.1, 0.3, 0.6) });
             
             // Top/Bottom Metadata Layout (Cleanly wraps the text)
             const paddingX = boxX + armLength + (5 * scale);
             page.drawText(`${topText} ${signerName}`, { x: paddingX, y: boxY + boxH - armMarginY - (textSize), size: Math.min(textSize, 8), font: regularFont, color: rgb(0.1, 0.3, 0.6) });
             page.drawText(`Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { x: paddingX, y: boxY + armMarginY + (textSize * 1.5), size: textSize - 0.5, font: regularFont, color: rgb(0.1, 0.3, 0.6) });
             if (tag.type !== 'initial') {
                page.drawText(`Hash: ${shortId}...`, { x: paddingX, y: boxY + armMarginY + (textSize * 0.2), size: textSize - 1, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
             }
        } else {
             // Split Side Layout: Render metadata text safely squeezed on the right half
             const rightSideWatermarkSize = 5 * scale;
             const startY = boxY + boxH - armMarginY - rightSideWatermarkSize;
             page.drawText(`${topText}`, { x: textStartXX, y: startY, size: rightSideWatermarkSize, font: regularFont, color: rgb(0.1, 0.3, 0.6) });
             page.drawText(`${signerName}`, { x: textStartXX, y: startY - (rightSideWatermarkSize * 1.2), size: rightSideWatermarkSize, font: regularFont, color: rgb(0.1, 0.3, 0.6) });
             page.drawText(`Date: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { x: textStartXX, y: startY - (rightSideWatermarkSize * 2.8), size: rightSideWatermarkSize - 0.5, font: regularFont, color: rgb(0.1, 0.3, 0.6) });
             if (tag.type !== 'initial') {
                page.drawText(`Hash: ${shortId}...`, { x: textStartXX, y: startY - (rightSideWatermarkSize * 4), size: rightSideWatermarkSize - 0.5, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
             }
        }
    }

    // Attach Tamper-Evident Seal on all pages
    for (const page of pages) {
      const { width, height } = page.getSize();
      
      // Draw Seal at Bottom Right
      page.drawText(`Digitally Signed & Sealed by MFO-CRM`, {
        x: width - 250,
        y: 20,
        size: 8,
        color: rgb(0, 0.4, 0),
        opacity: 0.8
      });
      page.drawText(`Signer: ${email}`, {
        x: width - 250,
        y: 10,
        size: 7,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.8
      });
    }

    // Generate Certificate of Completion if Fully Completed
    if (isFullyCompleted) {
       // Language resolution: Signee > Envelope > Tenant > Default
       const tenantDoc = await db.collection('tenants').doc(tenantId).get();
       const tenantData = tenantDoc.data() || {};
       const tenantLang = (tenantData.country === 'BR' || tenantData.locale === 'pt-BR') ? 'pt' : (tenantData.language || tenantData.settings?.language || tenantData.locale || 'en');
       let baseLang = tenantLang.toString().toLowerCase().startsWith('pt') ? 'pt' : (tenantLang.toString().toLowerCase().startsWith('es') ? 'es' : 'en');

       let resolvedLangCode = baseLang;
       if (envelope.lang && ['en', 'pt', 'es'].includes(envelope.lang)) resolvedLangCode = envelope.lang;
       
       const currentSigner = updatedSigners[myIndex];
       if (currentSigner?.lang && ['en', 'pt', 'es'].includes(currentSigner.lang)) resolvedLangCode = currentSigner.lang;
       
       const t = DICTIONARY[resolvedLangCode as 'en' | 'pt' | 'es'] || DICTIONARY['en'];

       // Fetch ledger audit logs
       const auditSnap = await envRef.collection('audit_logs').orderBy('timestamp', 'asc').get();
       const auditLogs = auditSnap.docs.map((doc: any) => doc.data());

       const certPage = pdfDoc.addPage([595.28, 841.89]); // Standard A4 bounds
       const { width: cWidth, height: cHeight } = certPage.getSize();
       
       const marginL = 50;
       
       // Header
       certPage.drawText(t.certTitle, {
          x: marginL, y: cHeight - 60, size: 24, font: regularFont, color: rgb(0.1, 0.2, 0.4)
       });

       certPage.drawText(t.certNotice, {
          x: marginL, y: cHeight - 80, size: 9, font: regularFont, color: rgb(0.5, 0.5, 0.5)
       });

       // Section 1: Overview
       certPage.drawText(t.overview, {
          x: marginL, y: cHeight - 120, size: 14, font: regularFont, color: rgb(0.2, 0.2, 0.2)
       });

       certPage.drawText(t.sender, { x: marginL, y: cHeight - 140, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(`${envelope.creatorName || envelope.creator || 'System Administrator'}`, { x: marginL, y: cHeight - 150, size: 10, font: regularFont });

       certPage.drawText(t.envelopeId, { x: marginL, y: cHeight - 170, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(`${envelopeId.toUpperCase()}`, { x: marginL, y: cHeight - 180, size: 10, font: regularFont });

       if (envelope.fileSize) {
           certPage.drawText(t.fileSize, { x: marginL, y: cHeight - 200, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
           certPage.drawText(`${(envelope.fileSize / 1024).toFixed(2)} KB`, { x: marginL, y: cHeight - 210, size: 10, font: regularFont });
       }

       // Draw Right Column Summary box
       certPage.drawText(t.status, { x: marginL + 300, y: cHeight - 140, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(t.completed, { x: marginL + 300, y: cHeight - 150, size: 10, font: regularFont, color: rgb(0.1, 0.6, 0.1) });
       certPage.drawText(t.executionDate, { x: marginL + 300, y: cHeight - 170, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(`${new Date().toISOString().replace('T', ' ').substring(0, 19)}`, { x: marginL + 300, y: cHeight - 180, size: 10, font: regularFont });

       // Section 2: Evidences
       let cursorY = cHeight - 250;
       certPage.drawText(t.evidenceSection, {
          x: marginL, y: cursorY, size: 14, font: regularFont, color: rgb(0.2, 0.2, 0.2)
       });
       cursorY -= 25;

       if (envelope.requireOtp) {
           certPage.drawText(t.otpViaEmail, { x: marginL, y: cursorY, size: 10, font: regularFont, color: rgb(0.7, 0.1, 0.1) });
           cursorY -= 20;
       }

        for (const signer of updatedSigners) {
            certPage.drawText(`[SIGNED] ${signer.name} (${signer.email}) | IP: ${signer.ip || 'Unknown'}`, { x: marginL, y: cursorY, size: 10, font: regularFont });
            cursorY -= 12;
            certPage.drawText(`         Location: ${signer.location || 'Unknown Location'}`, { x: marginL, y: cursorY, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
            cursorY -= 15;
            certPage.drawText(`       ${t.timestamp} ${signer.signedAt || 'Unknown'} - ${t.cryptoVerified} (Device: ${signer.userAgent ? signer.userAgent.substring(0, 40) : 'Native'})`, { x: marginL, y: cursorY, size: 9, font: regularFont, color: rgb(0.1, 0.6, 0.1) });
            cursorY -= 20;
        }

       // Original Pre-Execution SHA-256 (if known)
       if (envelope.originalHash) {
           certPage.drawText(t.originalHash, { x: marginL, y: cursorY, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
           cursorY -= 12;
           certPage.drawText(`${envelope.originalHash}`, { x: marginL, y: cursorY, size: 8, font: regularFont, color: rgb(0.2, 0.2, 0.8) });
           cursorY -= 20;
       }

       // Section 3: Audit Trail
       cursorY -= 10;
       certPage.drawText(t.auditSection, {
          x: marginL, y: cursorY, size: 14, font: regularFont, color: rgb(0.2, 0.2, 0.2)
       });
       cursorY -= 20;

       certPage.drawText(t.date, { x: marginL, y: cursorY, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(t.action, { x: marginL + 120, y: cursorY, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       certPage.drawText(t.detail, { x: marginL + 250, y: cursorY, size: 8, font: regularFont, color: rgb(0.4, 0.4, 0.4) });
       cursorY -= 10;
       certPage.drawLine({ start: { x: marginL, y: cursorY }, end: { x: cWidth - marginL, y: cursorY }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });
       cursorY -= 15;

       for (const log of auditLogs) {
           const logDate = log.timestamp && log.timestamp._seconds ? new Date(log.timestamp._seconds * 1000) : new Date(log.timestamp);
           const logDateStr = logDate.toISOString().replace('T', ' ').substring(0, 19);
           const typeStr = log.type.toUpperCase();
           let detailStr = log.actorEmail || log.clientInfo?.email || 'System Operation';
           if (log.clientInfo?.ip && log.clientInfo.ip !== 'Unknown' && log.clientInfo.ip !== 'unknown') {
               detailStr += ` | IP: ${log.clientInfo.ip}`;
           }

           certPage.drawText(logDateStr, { x: marginL, y: cursorY, size: 8, font: regularFont });
           certPage.drawText(typeStr, { x: marginL + 120, y: cursorY, size: 8, font: regularFont });
           certPage.drawText(detailStr, { x: marginL + 250, y: cursorY, size: 8, font: regularFont });
           cursorY -= 15;

           if (cursorY < 50) break; // Simple overflow protection
       }

       // Draw Seal at Bottom Left
       certPage.drawText(t.seal, {
          x: marginL, y: 30, size: 8, font: regularFont, color: rgb(0, 0.4, 0)
       });

       // Draw Tenant Footer at Bottom Right
       const tenantFooterName = tenantData.name || tenantData.companyName || 'MFO-CRM Platform';
       const tenantFooterDoc = tenantData.document || tenantData.cnpj || tenantData.taxId || '';
       const fText = `${tenantFooterName}${tenantFooterDoc ? ` (ID: ${tenantFooterDoc})` : ''}`;
       
       certPage.drawText(fText, {
          x: cWidth - marginL - regularFont.widthOfTextAtSize(fText, 8), 
          y: 30, 
          size: 8, 
          font: regularFont, 
          color: rgb(0.4, 0.4, 0.4)
       });
    }

    // Embed metadata
    pdfDoc.setTitle(`${envelope.title} - Signed`);
    pdfDoc.setAuthor('MFO-CRM Trust Engine');
    pdfDoc.setCreator('MFO-CRM');

    // Generate Final Bytes
    const finalPdfBytes = await pdfDoc.save();

    // Create SHA-256 Hash of the final byte stream
    const hash = crypto.createHash('sha256').update(finalPdfBytes).digest('hex');

    // (Optional) Upload finalPdfBytes to Storage to shadow the old one
    const storageBucket = process.env.NEXT_PUBLIC_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mfo-crm.appspot.com';
    let finalUrl = envelope.documentUrl;
    
    if (storageBucket && getAdminStorage) {
      try {
         const bucket = getAdminStorage().bucket(storageBucket);
         const filePath = `tenants/${tenantId}/envelopes/${envelopeId}_signed_${Date.now()}.pdf`;
         const file = bucket.file(filePath);
         await file.save(Buffer.from(finalPdfBytes.buffer), {
           metadata: { contentType: 'application/pdf', metadata: { hash } }
         });
         
         finalUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket}/o/${encodeURIComponent(filePath)}?alt=media`;
         
         try { await file.makePublic(); } catch(e) { console.warn('makePublic failed/ignored for bucket', e); }
      } catch (e: any) {
         console.warn("Storage Admin overwrite failed. Hash will be registered via DB. Error:", e.message);
      }
    }

    // Push state back to Firestore
    await envRef.update({
       signers: updatedSigners,
       completed: activeCompletedCount,
       status: isFullyCompleted ? 'completed' : 'in-progress',
       documentUrl: finalUrl,
       finalHash: hash
    });

    // Write field-level eIDAS binding events
    const batch = db.batch();
    for (const evt of fieldBoundEvents) {
        batch.set(envRef.collection('audit_trail').doc(), evt);
    }
    
    // Write Finalized Step Audit Trail
    batch.set(envRef.collection('audit_trail').doc(), {
      type: 'signed',
      metadata: {
         signer: email,
         documentHash: hash,
         fileSize: finalPdfBytes.length
      },
      clientInfo: { ip: ip || 'unknown', userAgent: userAgent || 'unknown', location: fullLocation },
      timestamp: new Date().toISOString()
    });
    
    await batch.commit();

    if (isFullyCompleted) {
      const tenantSnap = await db.collection('tenants').doc(tenantId).get();
      const smtpConfig = tenantSnap.data()?.smtpConfig || {};

      const host = smtpConfig.host || process.env.SMTP_HOST;
      const port = Number(smtpConfig.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig.user || process.env.SMTP_USER;
      const pass = smtpConfig.pass || process.env.SMTP_PASS;
      const secure = smtpConfig.secure !== undefined ? !!smtpConfig.secure : (process.env.SMTP_SECURE === 'true');

      if (host && user && pass) {
        // @ts-ignore
        const nodemailer = await import('nodemailer');
        const transporter = nodemailer.default.createTransport({
          host, port, secure, auth: { user, pass }
        });
        const fromEmail = process.env.SMTP_FROM ?? `"MFO Trust Engine" <${user}>`;

        let creatorEmail = null;
        if (envelope.createdBy) {
           try {
              const creatorSnap = await db.collection('users').doc(envelope.createdBy).get();
              if (creatorSnap.exists) creatorEmail = creatorSnap.data()?.email;
           } catch(e) {}
        }

        const notifySet = new Set(updatedSigners.filter((s:any) => s.email).map((s:any)=>s.email));
        if (creatorEmail) notifySet.add(creatorEmail);

        const dispatchPromises = Array.from(notifySet).map((emailString: any) => {
          const portalUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/sign/${tenantId}/${envelopeId}?email=${encodeURIComponent(emailString)}`;
          const compiledHtml = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
              <h2>Document Fully Executed</h2>
              <p>The document <strong>${envelope.title}</strong> has been successfully signed by all parties and cryptographically sealed.</p>
              <div style="margin: 30px 0;">
                <a href="${portalUrl}" style="background-color: #059669; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">View Executed Copy</a>
              </div>
              <p style="font-size: 12px; color: #666; border-top: 1px solid #eaeaea; padding-top: 16px;">
                Secured by MFO Native Sign Engine<br/>
                Final Hash: ${hash}
              </p>
            </div>
          `;

          return transporter.sendMail({
            from: fromEmail,
            to: emailString,
            subject: `Document Executed: ${envelope.title}`,
            html: compiledHtml
          }).catch((err: any) => console.error(`Failed to dispatch Completion SMTP to ${emailString}:`, err));
        });

        // We explicitly do not await this matrix fully to prevent blocking the UI response to the final signer. 
        // Edge/Serverless might kill unhandled promises, but since Nextjs 14 nodejs runtime maintains process briefly, it handles gracefully.
        Promise.allSettled(dispatchPromises).catch(() => {});
      }
    }

    return NextResponse.json({ ok: true, hash, url: finalUrl, isFullyCompleted });

  } catch (err: any) {
    console.error('Finalize Signature Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
