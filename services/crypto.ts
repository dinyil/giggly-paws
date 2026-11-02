// Generates a random 16-byte hex string
export const generateSalt = (): string => {
  const array = new Uint8Array(16);
  window.crypto.getRandomValues(array);
  return Array.from(array)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

import { User, Role } from '../types';

// Hashes the PIN combined with the Salt using SHA-256
export const hashPin = async (pin: string, salt: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + salt);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
};

// Checks a PIN against a user's stored PIN ("SALT:HASH", separate salt, or legacy plain text)
export const verifyUserPin = async (user: User, pin: string): Promise<boolean> => {
  let storedPin = user.pin;
  let storedSalt = '';
  if (storedPin.includes(':')) [storedSalt, storedPin] = storedPin.split(':');
  else if (user.salt) storedSalt = user.salt;
  if (storedSalt) return (await hashPin(pin, storedSalt)) === storedPin;
  return storedPin === pin;
};

// True if the PIN belongs to any admin user
export const verifyAdminPin = async (users: User[], pin: string): Promise<boolean> => {
  if (!pin) return false;
  const adminUsers = users.filter(u => u.role === Role.ADMIN || u.id === 'super-admin');
  for (const user of adminUsers) {
    if (await verifyUserPin(user, pin)) return true;
  }
  return false;
};
