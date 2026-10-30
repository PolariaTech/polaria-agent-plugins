// Utilidades de texto, hash y fecha del conversor schema a JSON.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Raíz del repo del dev: el conversor se corre desde ahí.
export const REPO_ROOT = process.cwd();
const VERSION_FILE = join(REPO_ROOT, 'VERSION');

export const EM_DASH = '—';
export const WARN_SEP = ' · ';
export const STEP_SEP = ' → ';

// ---------------------------------------------------------------------------
// Utilidades de texto
// ---------------------------------------------------------------------------

export function stripDiacritics(texto) {
  return texto.normalize('NFKD').replace(/\p{M}/gu, '');
}

export function fold(texto) {
  return stripDiacritics(String(texto ?? '')).toLowerCase();
}

export function trimCell(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/\\\|/g, '|')
    .replace(/^\s+|\s+$/g, '');
}

export function isEmptyOrDash(texto) {
  const limpio = trimCell(texto);
  return limpio === '' || limpio === EM_DASH || limpio === '-';
}

export function cellOriginal(texto) {
  const limpio = trimCell(texto);
  if (limpio === '' || limpio === '-') return EM_DASH;
  return limpio;
}

export function hasWholeWord(haystack, needle) {
  const pajarPlegado = fold(haystack);
  const agujaPlegada = fold(needle);
  const patron = new RegExp(`(?:^|[^a-z0-9_])${agujaPlegada.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:$|[^a-z0-9_])`);
  return patron.test(pajarPlegado);
}

export function readPortalVersion() {
  try {
    return trimCell(readFileSync(VERSION_FILE, 'utf8')) || null;
  } catch {
    return null;
  }
}

export function sha256Hex(content) {
  return createHash('sha256').update(content, 'utf8').digest('hex');
}

export function isoNow() {
  const ahora = new Date();
  const pad = (numero) => String(numero).padStart(2, '0');
  const offset = -ahora.getTimezoneOffset();
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const desfaseHoras = pad(Math.floor(abs / 60));
  const desfaseMinutos = pad(abs % 60);
  return `${ahora.getFullYear()}-${pad(ahora.getMonth() + 1)}-${pad(ahora.getDate())}T${pad(ahora.getHours())}:${pad(ahora.getMinutes())}:${pad(ahora.getSeconds())}${sign}${desfaseHoras}:${desfaseMinutos}`;
}
