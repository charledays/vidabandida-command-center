// Cifra el plan privado (private/plan.json) con tu contraseña y escribe plan.enc.json.
// Uso:  node tools/encrypt-plan.mjs
// La contraseña se escribe en la Terminal (no se ve en pantalla) y no se guarda en ningún archivo.
// private/plan.json nunca se sube a GitHub (.gitignore). Para cambiar el plan: edita ese
// archivo, vuelve a correr este script y publica plan.enc.json.

import { readFileSync, writeFileSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import readline from 'node:readline';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'private', 'plan.json');
const OUT = join(ROOT, 'plan.enc.json');
const ITER = 600000;

function ask(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) rl.output.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

const b64 = (buf) => Buffer.from(buf).toString('base64');

async function main() {
  const plan = readFileSync(SRC, 'utf8');
  JSON.parse(plan); // valida que el JSON esté bien

  let pass = process.env.VBCC_PASS;
  if (!pass) {
    pass = await ask('Contraseña nueva: ');
    const again = await ask('Repite la contraseña: ');
    if (pass !== again) { console.error('No coinciden. No se cambió nada.'); process.exit(1); }
  }
  if (pass.length < 10) { console.error('Usa al menos 10 caracteres (mejor 3-4 palabras). No se cambió nada.'); process.exit(1); }

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER },
    base, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plan));

  writeFileSync(OUT, JSON.stringify({ v: 1, kdf: 'PBKDF2-SHA256', iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct) }) + '\n');
  console.log('Listo: plan.enc.json cifrado con tu contraseña.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
