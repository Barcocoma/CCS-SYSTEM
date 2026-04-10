import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const UserRole = {
  DEAN: 'Dean',
  CHAIR: 'Department Chair',
  FACULTY: 'Faculty',
  SECRETARY: 'Secretary',
};

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
