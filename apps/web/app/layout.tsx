import type { Metadata } from 'next';
import '../styles/globals.css';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Providers } from "./providers";
import { RootProvider } from 'fumadocs-ui/provider/next';

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: 'MFO Nexus — Multi-Family Office Platform',
  description: 'Enterprise wealth management platform for ultra-high-net-worth families.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)} suppressHydrationWarning>
      <body suppressHydrationWarning>
        <RootProvider>
          <Providers>
            {children}
          </Providers>
        </RootProvider>
      </body>
    </html>
  );
}
