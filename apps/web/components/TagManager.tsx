'use client';

import React, { useState } from 'react';

interface TagManagerProps {
  tags: string[];
  onChange?: (tags: string[]) => void;
  readOnly?: boolean;
}

export function TagManager({ tags, onChange, readOnly }: TagManagerProps) {
  const [input, setInput] = useState('');

  const addTag = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange?.([...tags, input.trim()]);
      }
      setInput('');
    }
  };

  const removeTag = (tag: string) => {
    onChange?.(tags.filter(t => t !== tag));
  };

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {tags.map(tag => (
        <span 
          key={tag} 
          className="badge" 
          style={{ 
            background: 'var(--bg-elevated)', 
            border: '1px solid var(--border)', 
            color: 'var(--text-primary)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 11,
            fontWeight: 500
          }}
        >
          {tag}
          {!readOnly && (
            <button 
              onClick={() => removeTag(tag)}
              style={{ border: 'none', background: 'transparent', color: 'var(--text-tertiary)', padding: 0, cursor: 'pointer', display: 'flex' }}
            >
              ×
            </button>
          )}
        </span>
      ))}
      {!readOnly && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={addTag}
          placeholder="Add tag..."
          style={{ 
            background: 'transparent', 
            border: 'none', 
            fontSize: 11, 
            color: 'var(--text-primary)',
            outline: 'none',
            padding: '4px 8px',
            width: input ? `${input.length + 1}ch` : 80
          }}
        />
      )}
    </div>
  );
}
