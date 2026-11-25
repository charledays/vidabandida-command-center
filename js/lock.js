// Desbloqueo: deriva la clave desde la contraseña (PBKDF2) y descifra plan.enc.json (AES-GCM).
// Si el teléfono debe recordarla, se guarda la clave derivada (no la contraseña) en localStorage.

const KEY_STORE = 'vbcc:key';

const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const toB64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));

let encCache = null;
async function loadEncrypted() {
  if (encCache) return encCache;
  const res = await fetch('plan.enc.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('No se pudo cargar el plan.');
  encCache = await res.json();
  return encCache;
}

async function decryptWith(key, enc) {
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(enc.iv) }, key, fromB64(enc.ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

// Intenta abrir con la clave recordada. Devuelve el plan o null.
export async function unlockRemembered() {
  let raw;
  try { raw = localStorage.getItem(KEY_STORE); } catch { return null; }
  if (!raw) return null;
  try {
    const enc = await loadEncrypted();
    const key = await crypto.subtle.importKey('raw', fromB64(raw), 'AES-GCM', false, ['decrypt']);
    return await decryptWith(key, enc);
  } catch (e) {
    // Clave vieja (p. ej. cambiaste la contraseña): olvidarla y pedirla de nuevo.
    if (e && e.name === 'OperationError') forget();
    return null;
  }
}

// Abre con contraseña. Lanza 'WRONG' si no coincide.
export async function unlockWithPassword(pass, remember = true) {
  const enc = await loadEncrypted();
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(enc.salt), iterations: enc.iter },
    base, { name: 'AES-GCM', length: 256 }, true, ['decrypt']);
  let plan;
  try { plan = await decryptWith(key, enc); } catch { throw new Error('WRONG'); }
  if (remember) {
    try { localStorage.setItem(KEY_STORE, toB64(await crypto.subtle.exportKey('raw', key))); } catch {}
  }
  return plan;
}

export function forget() {
  try { localStorage.removeItem(KEY_STORE); } catch {}
}
