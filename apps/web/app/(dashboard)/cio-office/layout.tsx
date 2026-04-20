import React from 'react';

export default function CIOOfficeLayout({ children }: { children: React.ReactNode }) {
  // Pass-through wrapper, can be expanded to include CIO-specific headers, tabs or sub-menus
  return (
    <div className="flex flex-col w-full min-h-screen">
      {children}
    </div>
  );
}
