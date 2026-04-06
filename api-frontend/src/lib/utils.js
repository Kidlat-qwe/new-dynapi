import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Display name for header: DB fname/lname, then Firebase displayName, then email local-part.
 * @param {{ fname?: string; lname?: string; displayName?: string; email?: string } | null | undefined} user
 */
export function getUserFullName(user) {
  if (!user) return '';
  const fromDb = [user.fname, user.lname].filter((s) => s && String(s).trim()).join(' ').trim();
  if (fromDb) return fromDb;
  if (user.displayName?.trim()) return user.displayName.trim();
  const email = user.email || '';
  if (email.includes('@')) return email.split('@')[0];
  return email || 'User';
}
