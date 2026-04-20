'use client';

import React, { useState, useCallback } from 'react';
import { PDFDocument } from 'pdf-lib';
import { FileDown, FileUp, Files, Info, Loader2, Trash2, GripVertical, AlertTriangle } from 'lucide-react';

export default function PdfDossierAssembler({ targetName }: { targetName?: string }) {
    const [files, setFiles] = useState<File[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [error, setError] = useState('');

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const newFiles = Array.from(e.target.files).filter(f => f.type === 'application/pdf');
            if (newFiles.length !== e.target.files.length) {
                setError('Apenas arquivos PDF são suportados.');
            } else {
                setError('');
            }
            setFiles(prev => [...prev, ...newFiles]);
        }
    };

    const handleRemove = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleMerge = async () => {
        if (files.length < 2) {
            setError('Adicione pelo menos 2 arquivos PDF para fazer a fusão.');
            return;
        }

        setIsMerging(true);
        setError('');

        try {
            const mergedPdf = await PDFDocument.create();

            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const pdf = await PDFDocument.load(arrayBuffer);
                const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                copiedPages.forEach((page) => mergedPdf.addPage(page));
            }

            const pdfBytes = await mergedPdf.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            
            // Create a downloadable link
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Dossier_${targetName ? targetName.replace(/\s+/g, '_') : 'Merged'}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            // Clear on success
            setFiles([]);
        } catch (err: any) {
            console.error(err);
            setError('Erro ao fazer o merge dos arquivos. O PDF pode estar corrompido ou protegido por senha. ' + err.message);
        } finally {
            setIsMerging(false);
        }
    };

    // Very simple move up/down array swap
    const moveUp = (index: number) => {
        if (index === 0) return;
        const newFiles = [...files];
        [newFiles[index - 1], newFiles[index]] = [newFiles[index], newFiles[index - 1]];
        setFiles(newFiles);
    };

    const moveDown = (index: number) => {
        if (index === files.length - 1) return;
        const newFiles = [...files];
        [newFiles[index + 1], newFiles[index]] = [newFiles[index], newFiles[index + 1]];
        setFiles(newFiles);
    };

    return (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 w-full mt-6">
            <div className="flex items-start gap-4 border-b border-slate-100 pb-4 mb-4">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-700 rounded-lg flex items-center justify-center shrink-0">
                    <Files size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800">PDF Dossier Assembler</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        Use esta ferramenta para juntar o PDF da Invoice gerada com extratos bancários de suporte. A ordem dos arquivos abaixo será a ordem exata do PDF final. Todo o processamento é feito no seu próprio navegador para garantir privacidade absoluta.
                    </p>
                </div>
            </div>

            <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-lg p-6 text-center hover:bg-slate-100 transition-colors relative cursor-pointer">
                <input 
                    type="file" 
                    multiple 
                    accept="application/pdf" 
                    onChange={handleFileChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <FileUp size={24} className="text-slate-400 mx-auto mb-2" />
                <div className="text-sm font-bold text-slate-600">Arraste seus PDFs aqui ou clique p/ selecionar</div>
                <div className="text-xs text-slate-400 mt-1">Ex: Invoice_CostaVerde.pdf, Extrato_Itau_Mar26.pdf</div>
            </div>

            {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs flex items-center gap-2">
                    <AlertTriangle size={14} /> {error}
                </div>
            )}

            {files.length > 0 && (
                <div className="mt-4 space-y-2">
                    {files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between p-3 bg-white border border-slate-200 shadow-sm rounded-lg group">
                            <div className="flex items-center gap-3 overflow-hidden">
                                <div className="flex flex-col gap-1 text-slate-300">
                                    <button onClick={() => moveUp(index)} className="hover:text-slate-600" disabled={index===0}>{'▲'}</button>
                                    <button onClick={() => moveDown(index)} className="hover:text-slate-600" disabled={index===files.length-1}>{'▼'}</button>
                                </div>
                                <div className="w-8 h-8 rounded bg-red-50 text-red-600 flex items-center justify-center shrink-0 font-bold text-[10px]">PDF</div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-sm font-bold text-slate-700 truncate">{file.name}</span>
                                    <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                                </div>
                            </div>
                            <button onClick={() => handleRemove(index)} className="p-2 text-red-400 hover:bg-red-50 hover:text-red-600 rounded">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mt-6 flex items-center justify-end">
                <button 
                    onClick={handleMerge}
                    disabled={isMerging || files.length < 2}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all flex items-center gap-2"
                >
                    {isMerging ? <Loader2 size={18} className="animate-spin" /> : <FileDown size={18} />}
                    {isMerging ? 'Fusing Documents...' : 'Merge & Download Dossier'}
                </button>
            </div>
        </div>
    );
}
