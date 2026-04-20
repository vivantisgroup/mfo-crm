import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { mergeAttributes, Node } from "@tiptap/core";
import {
  ReactNodeViewRenderer,
  NodeViewWrapper,
  NodeViewProps,
} from "@tiptap/react";
import { DiagramEditor } from "@/components/DiagramEditor";
import { Maximize2, PenTool, X } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";

const ExcalidrawNodeComponent = (props: NodeViewProps) => {
  const { node, updateAttributes } = props;
  const { drawingId } = node.attrs;
  const { tenant } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!tenant?.id) return null;

  return (
    <NodeViewWrapper className="my-4 excalidraw-node rounded-lg border border-slate-200 bg-slate-50 overflow-hidden relative">
      <div className="h-[400px] w-full flex flex-col items-center justify-center cursor-pointer group bg-slate-50 relative pointer-events-auto">
        <DiagramEditor
          tenantId={tenant.id}
          drawingId={drawingId}
          targetType="knowledge_blob"
          targetId={drawingId}
          readOnly={true}
          inlinePreview={true}
        />
        <div className="absolute top-4 right-4 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => setIsEditing(true)}
            className="px-3 py-1.5 bg-indigo-600 text-white font-bold text-xs rounded-md flex items-center gap-2 shadow-sm pointer-events-auto hover:bg-indigo-700 transition"
          >
            <Maximize2 size={12} /> Fullscreen Edit
          </button>
        </div>
      </div>

      {isEditing &&
        mounted &&
        createPortal(
          <div className="fixed inset-0 z-[999999] bg-slate-900/85 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 pointer-events-auto">
            <div className="bg-white w-full h-full max-w-[1600px] rounded-xl shadow-2xl overflow-hidden flex flex-col">
              <div className="h-14 border-b border-slate-200 flex items-center justify-between px-6 bg-slate-50 shrink-0">
                <div className="flex items-center gap-2 font-bold text-slate-700">
                  <PenTool size={18} className="text-indigo-600" />
                  Diagram Editor{" "}
                  <span className="text-xs font-normal text-slate-400 bg-slate-200 px-2 py-0.5 rounded ml-2">
                    Saves on Close
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsEditing(false)}
                    className="px-3 py-1.5 font-medium text-slate-500 hover:bg-slate-200 rounded-md transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.dispatchEvent(
                          new CustomEvent("excalidraw_force_save"),
                        );
                      }
                      setIsEditing(false);
                    }}
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-medium text-sm transition-colors shadow-sm flex items-center gap-2"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
              <div className="flex-1 w-full bg-slate-100 relative">
                <DiagramEditor
                  tenantId={tenant.id}
                  drawingId={drawingId}
                  targetType="knowledge_blob"
                  targetId={drawingId}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </NodeViewWrapper>
  );
};

export const ExcalidrawNode = Node.create({
  name: "excalidraw",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      drawingId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="excalidraw"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-type": "excalidraw" }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ExcalidrawNodeComponent);
  },
});
