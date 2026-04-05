'use client';

import React from 'react';
import { CommunicationsHub } from '@/components/CommunicationsHub';

export default function CommunicationsPage() {
  return (
    <div className="animate-fade-in" style={{ 
      display: 'flex', 
      height: 'calc(100vh - 120px)', 
      overflow: 'hidden'
    }}>
      <CommunicationsHub />
    </div>
  );
}
