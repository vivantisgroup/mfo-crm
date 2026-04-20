import * as React from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface PromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: { name: string; label: string; placeholder?: string; type?: string; defaultValue?: string }[];
  submitText?: string;
  onSubmit: (values: Record<string, string>) => void;
}

export function PromptModal({ open, onOpenChange, title, description, fields, submitText = "Submit", onSubmit }: PromptModalProps) {
  const [values, setValues] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      const initial: Record<string, string> = {};
      fields.forEach(f => { initial[f.name] = f.defaultValue || ''; });
      setValues(initial);
    }
  }, [open, fields]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(values);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {fields.map((field) => (
              <div key={field.name} className="flex flex-col gap-2">
                <label htmlFor={field.name} className="text-sm font-semibold">{field.label}</label>
                <Input
                  id={field.name}
                  type={field.type || "text"}
                  placeholder={field.placeholder}
                  value={values[field.name] || ''}
                  onChange={(e) => setValues({ ...values, [field.name]: e.target.value })}
                  className="bg-[var(--bg-overlay)]"
                  autoFocus={fields[0].name === field.name}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{submitText}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
