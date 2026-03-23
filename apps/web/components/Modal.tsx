import React, { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: number | string;
}

export function Modal({ isOpen, onClose, title, children, footer, width = 500 }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) dialog.showModal();
    } else {
      if (dialog.open) dialog.close();
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };

    dialog.addEventListener('cancel', handleCancel);
    return () => dialog.removeEventListener('cancel', handleCancel);
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      style={{
        padding: 0,
        border: `1px solid var(--border)`,
        borderRadius: `var(--radius-lg)`,
        background: `var(--bg-surface)`,
        color: `var(--text-primary)`,
        width: '100%',
        maxWidth: width,
        boxShadow: `var(--shadow-lg)`,
      }}
      className="modal-dialog"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: `1px solid var(--border)` }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{title}</h2>
        <button onClick={onClose} className="icon-btn" style={{ border: 'none', background: 'transparent', width: 24, height: 24 }}>✕</button>
      </div>
      <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
        {children}
      </div>
      {footer && (
        <div style={{ padding: '16px 20px', borderTop: `1px solid var(--border)`, background: `var(--bg-elevated)`, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
          {footer}
        </div>
      )}
    </dialog>
  );
}

export function useModal() {
  const [isOpen, setIsOpen] = React.useState(false);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);
  return { isOpen, open, close };
}
