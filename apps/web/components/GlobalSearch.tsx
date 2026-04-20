'use client';

import * as React from "react"
import {
  Calculator,
  Calendar,
  CreditCard,
  Settings,
  User,
  Search,
  Building2,
  FileSignature
} from "lucide-react"

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command"
import { useRouter } from "next/navigation";

export function GlobalSearch({ open, setOpen }: { open: boolean, setOpen: (open: boolean) => void }) {
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [setOpen])

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          <CommandItem onSelect={() => { router.push('/calendar'); setOpen(false); }}>
            <Calendar className="mr-2 h-4 w-4" />
            <span>Calendar</span>
          </CommandItem>
          <CommandItem onSelect={() => { router.push('/entities'); setOpen(false); }}>
            <Building2 className="mr-2 h-4 w-4" />
            <span>Entities</span>
          </CommandItem>
          <CommandItem onSelect={() => { router.push('/knowledge'); setOpen(false); }}>
            <Calculator className="mr-2 h-4 w-4" />
            <span>Knowledge Base</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Settings">
          <CommandItem onSelect={() => { router.push('/settings'); setOpen(false); }}>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </CommandItem>
          <CommandItem onSelect={() => { router.push('/admin'); setOpen(false); }}>
            <Settings className="mr-2 h-4 w-4" />
            <span>Admin Control Panel</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  )
}
