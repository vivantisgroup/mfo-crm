"use client";
import { PropsWithChildren, useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Button } from "./ui/button";

export default function Shell({ children, nav }: PropsWithChildren<{ nav: Array<{href:string;label:string;roles?:string[]}> }>) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b backdrop-blur bg-background/70">
        <div className="mx-auto max-w-7xl flex items-center gap-3 p-3">
          <Button variant="ghost" onClick={()=>setOpen(!open)} aria-label="Toggle menu"><Menu size={18}/></Button>
          <span className="font-semibold">MFO-CRM</span>
          <div className="ml-auto" />
        </div>
      </header>
      <div className="mx-auto max-w-7xl grid grid-cols-12 gap-4 p-4">
        <aside className={`col-span-12 md:col-span-3 lg:col-span-2 ${open? "block":"hidden md:block"}`}>
          <nav className="space-y-1">
            {nav?.map(item => (<Link key={item.href} className="block rounded-xl px-3 py-2 hover:bg-accent" href={item.href}>{item.label}</Link>))}
          </nav>
        </aside>
        <main className="col-span-12 md:col-span-9 lg:col-span-10">{children}</main>
      </div>
    </div>
  );
}
