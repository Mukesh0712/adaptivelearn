import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

// Joins class names and resolves Tailwind conflicts (e.g. "p-2 p-4" → "p-4").
// Every shadcn/ui component uses this.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
