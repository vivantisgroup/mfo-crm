"use client";
import * as React from "react";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "ghost" | "default" };

export function Button({ variant="default", className="", ...props }: Props) {
  const base = "inline-flex items-center justify-center rounded-2xl px-3 py-2 border";
  const style = variant === "ghost" ? "bg-transparent border-transparent" : "bg-white/5";
  return <button className={`${base} ${style} ${className}`} {...props} />;
}
