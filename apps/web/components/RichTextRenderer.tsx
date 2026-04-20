'use client';

import React, { useState, useEffect } from 'react';
import DOMPurify from 'dompurify';

interface RichTextRendererProps {
  content?: string;
  className?: string;
}

export function RichTextRenderer({ content, className = '' }: RichTextRendererProps) {
  const [sanitized, setSanitized] = useState<string>('');

  useEffect(() => {
    if (content) {
      setSanitized(DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'br', 'span', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'style', 'div', 'img'],
        ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'style', 'src', 'alt']
      }));
    } else {
      setSanitized('');
    }
  }, [content]);

  if (!content) return null;

  return (
    <div 
      className={`prose prose-sm prose-slate max-w-none ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized || content }}
    />
  );
}
