"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { db } from "@/lib/firebase";
import {
  doc,
  getDoc,
  setDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  getDocs,
} from "firebase/firestore";
import { Loader2, History } from "lucide-react";

// Require excalidraw CSS explicitly, as dynamic import may strip it
import "@excalidraw/excalidraw/index.css";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  {
    ssr: false,
    loading: () => (
      <div className="flex w-full h-full justify-center items-center bg-slate-50 text-slate-400">
        <Loader2 className="animate-spin" />
      </div>
    ),
  },
);

export interface DiagramEditorProps {
  tenantId: string;
  drawingId: string;
  targetType: string;
  targetId: string;
  readOnly?: boolean;
  inlinePreview?: boolean;
}

declare global {
  interface Window {
    __mfo_excalidraw_mega_lib?: any[];
  }
}

export function DiagramEditor({
  tenantId,
  drawingId,
  targetType,
  targetId,
  readOnly = false,
  inlinePreview = false,
}: DiagramEditorProps) {
  const [initialData, setInitialData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  const [libraryItems, setLibraryItems] = useState<any[]>([]);

  // History State
  const [historyItems, setHistoryItems] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Load drawing from Firestore
  // Ref to hold the unsubscriber
  const unsubRef = useRef<any>(null);

  useEffect(() => {
    let combinedLibs: any[] = [];

    const loadDrawing = async () => {
      const docRef = doc(db, "tenants", tenantId, "drawings", drawingId);

      const processSnapshot = (snapshot: any) => {
        setLoading(false);
        if (snapshot.exists()) {
          const data = snapshot.data();
          let parsedAppState = data.appState
            ? JSON.parse(data.appState)
            : { viewBackgroundColor: "#ffffff" };
          parsedAppState = {
            ...parsedAppState,
            isLibraryOpen: false, // Do not force library open when brought into view
            defaultSidebarDockedPreference: false,
          };

          const newElements = data.elements ? JSON.parse(data.elements) : [];

          setInitialData({
            elements: newElements,
            appState: parsedAppState,
            files: data.files ? JSON.parse(data.files) : null,
            libraryItems: combinedLibs,
          });

          // Preemptively force API update if it already exists
          if (excalidrawAPI) {
            excalidrawAPI.updateScene({
              elements: newElements,
              appState: parsedAppState,
            });
            setTimeout(() => {
              try {
                excalidrawAPI.scrollToContent(newElements, {
                  fitToContent: true,
                });
              } catch (e) {}
            }, 100);
          }
        } else {
          setInitialData({
            elements: [],
            appState: {
              viewBackgroundColor: "#ffffff",
              isLibraryOpen: true,
              defaultSidebarDockedPreference: false,
            },
            libraryItems: combinedLibs,
          });
        }
      };

      if (inlinePreview) {
        // Real-time listener strictly for read-only viewing so it doesn't overwrite active drawings
        unsubRef.current = onSnapshot(docRef, processSnapshot, (e) => {
          console.error("Failed to load drawing", e);
          setLoading(false);
        });
      } else {
        // One-time fetch for editing mode! Prevents "timestamp" saves from interrupting the active drawing session
        try {
          const snap = await getDoc(docRef);
          processSnapshot(snap);
        } catch (e) {
          console.error("Failed to load drawing", e);
          setLoading(false);
        }
      }
    };

    const loadLibraries = async () => {
      // User explicitly requested to load ALL Excalidraw libraries.
      // We do this by fetching the library index, then fetching individual libraries.
      // To avoid browser hang and rate limiting, we do not await this inside initAll.
      // Instead, we fetch them in the background and update excalidraw when done.
      if (window.__mfo_excalidraw_mega_lib) {
        setLibraryItems(window.__mfo_excalidraw_mega_lib);
        return;
      }

      try {
        console.log("Fetching local mega library...");
        const indexRes = await fetch("/excalidraw-mega-lib.json");
        if (!indexRes.ok) return;
        
        const allLibs = await indexRes.json();
        setLibraryItems(allLibs);
        window.__mfo_excalidraw_mega_lib = allLibs;
        console.log(`Loaded ${allLibs.length} total library items locally!`);
      } catch (err) {
        console.error("Failed to preinstall mega library", err);
      }
    };

    const initAll = async () => {
      await loadLibraries();
      loadDrawing(); // Starts the snapshot listener
    };

    initAll();

    return () => {
      if (unsubRef.current) unsubRef.current();
    };
  }, [tenantId, drawingId]);

  const latestDataRef = useRef<{
    elements: any;
    appState: any;
    files: any;
  } | null>(null);

  const onChange = useCallback(
    (elements: any, appState: any, files: any) => {
      if (readOnly) return;
      latestDataRef.current = { elements, appState, files };
    },
    [readOnly],
  );

  // No longer saving custom libraries to Firestore to prevent 1MB document limit crashes
  // since we are fetching the massive 50MB Excalidraw central repository.

  const fetchHistory = async () => {
    try {
      const docRef = doc(db, "tenants", tenantId, "drawings", drawingId);
      const historyCol = collection(docRef, "history");
      const q = query(historyCol, orderBy("updatedAt", "desc"), limit(15));
      const snap = await getDocs(q);
      setHistoryItems(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    }
  };

  const handleRestore = (item: any) => {
    try {
      const parsedElements = JSON.parse(item.elements);
      const parsedAppState = JSON.parse(item.appState);
      if (excalidrawAPI) {
        excalidrawAPI.updateScene({
          elements: parsedElements,
          appState: parsedAppState,
        });
        setTimeout(() => {
          try {
            excalidrawAPI.scrollToContent(parsedElements, {
              fitToContent: true,
            });
          } catch (e) {}
        }, 100);
      }
      setShowHistory(false);
    } catch (e) {
      console.error("Restore failed", e);
    }
  };

  const performSave = async () => {
    const data = latestDataRef.current;
    if (!data || !data.elements || readOnly) return;

    try {
      const docRef = doc(db, "tenants", tenantId, "drawings", drawingId);
      const historyCol = collection(docRef, "history");

      const cleanAppState = {
        viewBackgroundColor: data.appState.viewBackgroundColor,
        currentItemFontFamily: data.appState.currentItemFontFamily,
      };

      const payload = {
        targetType,
        targetId,
        updatedAt: new Date().toISOString(),
        elements: JSON.stringify(data.elements),
        appState: JSON.stringify(cleanAppState),
        files: JSON.stringify(data.files),
      };

      console.log(`Saving drawing ${drawingId} and capturing history snapshot`);
      // Update the main document
      await setDoc(docRef, payload, { merge: true });
      // Add a snapshot point-in-time recovery
      await addDoc(historyCol, payload);

      // clear so we don't double-save if unchanged
      latestDataRef.current = null;
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  // Auto-zoom to content when loaded, ensuring the drawing is perfectly visible
  useEffect(() => {
    if (
      excalidrawAPI &&
      initialData?.elements &&
      initialData.elements.length > 0
    ) {
      setTimeout(() => {
        try {
          // Force layout refresh and zoom
          excalidrawAPI.scrollToContent(excalidrawAPI.getSceneElements(), {
            fitToContent: true,
          });
        } catch (e) {}
      }, 500);
    }
  }, [excalidrawAPI, initialData]);

  // Expose an explicit force save method if parent wants it
  useEffect(() => {
    const handleForceSave = () => {
      performSave();
    };
    window.addEventListener("excalidraw_force_save", handleForceSave);

    // Save on unmount / navigation internally
    return () => {
      window.removeEventListener("excalidraw_force_save", handleForceSave);
      performSave(); // Flushes any unsaved changes before leaving
    };
  }, [tenantId, drawingId, targetId, targetType, readOnly]);

  if (loading) {
    if (inlinePreview)
      return (
        <div className="h-full w-full flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-md animate-pulse">
          <Loader2 size={24} className="text-slate-300 animate-spin" />
          <span className="text-xs text-slate-400 mt-2 font-medium">
            Loading diagram visualization...
          </span>
        </div>
      );
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-8 bg-slate-50">
        <Loader2 className="animate-spin text-indigo-500 mb-4" size={32} />
        <span className="text-sm font-medium text-slate-600">
          Loading your board...
        </span>
      </div>
    );
  }

  return (
    <div
      className="w-full h-full relative excalidraw-wrapper"
      style={{
        height: "100%",
        minHeight: inlinePreview ? "100%" : "600px",
        width: "100%",
      }}
    >
      <style
        dangerouslySetInnerHTML={{
          __html: `
        .excalidraw-wrapper {
          --excalidraw-canvas-bg: #f8fafc;
        }
        .excalidraw-wrapper svg {
           max-width: initial;
           height: initial;
        }
        .excalidraw-wrapper .excalidraw svg {
           max-width: initial !important;
           height: initial !important;
        }
      `,
        }}
      />
      {!inlinePreview && (
        <div className="absolute top-4 left-4 z-50">
          <button
            onClick={() => {
              if (!showHistory) fetchHistory();
              setShowHistory(!showHistory);
            }}
            className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 shadow-sm rounded-md text-sm font-semibold flex items-center gap-2 hover:bg-slate-50 transition"
          >
            <History size={14} /> Recovery History
          </button>

          {showHistory && (
            <div className="absolute top-full left-0 mt-2 w-72 bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden">
              <div className="p-3 border-b border-slate-100 bg-slate-50 font-semibold text-sm flex justify-between items-center">
                Version History
                <button
                  className="text-slate-400 hover:text-slate-600"
                  onClick={() => setShowHistory(false)}
                >
                  ✕
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {historyItems.length === 0 ? (
                  <div className="p-4 text-center text-slate-400 text-xs">
                    No history snapshots found.
                  </div>
                ) : (
                  historyItems.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 border-b border-slate-100 hover:bg-slate-50 cursor-pointer flex flex-col gap-1"
                      onClick={() => handleRestore(item)}
                    >
                      <span className="text-xs font-semibold text-slate-700">
                        {new Date(item.updatedAt).toLocaleString()}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        Click to restore this snapshot
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <Excalidraw
        excalidrawAPI={(api: any) => setExcalidrawAPI(api)}
        initialData={initialData}
        onChange={onChange}
        viewModeEnabled={readOnly}
        theme="light"
        UIOptions={
          inlinePreview
            ? {
                canvasActions: {
                  loadScene: false,
                  saveToActiveFile: false,
                  export: false,
                  clearCanvas: false,
                  changeViewBackgroundColor: false,
                },
                tools: { image: false },
              }
            : {
                canvasActions: {
                  loadScene: false, // Turn off excalidraw default load -> force ours
                  saveToActiveFile: false,
                  export: {
                    saveFileToDisk: true, // Allow SVG export locally
                  },
                },
              }
        }
      />
    </div>
  );
}
