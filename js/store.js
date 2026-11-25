// Persistencia local. Todo vive en localStorage bajo una sola clave versionada.
// Al cargar se fusiona con los valores por defecto, así una actualización de la
// app nunca borra progreso existente (solo añade campos nuevos).

const KEY = 'vbcc:data';
const SCHEMA = 2;
// Día 01 del reto: miércoles 25 de noviembre de 2026. Se puede cambiar en Ajustes.
const DEFAULT_START = '2026-11-25';

export const TASK_KEYS = ['product', 'people', 'culture', 'stories', 'mission', 'metrics'];
export const POST_KEYS = ['product', 'people', 'culture'];

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function defaults() {
  return { schema: SCHEMA, startDate: DEFAULT_START || todayISO(), tasks: {}, metrics: {}, assets: [], updatedAt: null };
}

function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  // v1 guardaba el día en que se abrió la app como inicio. Si aún no hay progreso,
  // pasar a la fecha oficial de arranque.
  if ((raw.schema || 1) < 2 && !Object.keys(raw.tasks || {}).length) raw = { ...raw, startDate: DEFAULT_START };
  return {
    ...base,
    ...raw,
    schema: SCHEMA,
    tasks: raw.tasks && typeof raw.tasks === 'object' ? raw.tasks : {},
    metrics: raw.metrics && typeof raw.metrics === 'object' ? raw.metrics : {},
    assets: Array.isArray(raw.assets) ? raw.assets : [],
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.startDate || '') ? raw.startDate : base.startDate,
  };
}

let state = load();
const listeners = new Set();

function load() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY)));
  } catch {
    return defaults();
  }
}

function save() {
  state.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) {
    console.error('No se pudo guardar', e);
  }
  listeners.forEach((fn) => fn(state));
}

export const store = {
  get: () => state,
  subscribe: (fn) => listeners.add(fn),

  // ---------- tareas ----------
  task(day, key) {
    return state.tasks[`${day}:${key}`] || { done: false, doneAt: null, notes: '', url: '' };
  },
  toggleTask(day, key) {
    const t = { ...this.task(day, key) };
    t.done = !t.done;
    t.doneAt = t.done ? new Date().toISOString() : null;
    state.tasks[`${day}:${key}`] = t;
    save();
    return t;
  },
  updateTask(day, key, patch) {
    state.tasks[`${day}:${key}`] = { ...this.task(day, key), ...patch };
    save();
  },
  dayDone(day, keys = TASK_KEYS) {
    return keys.filter((k) => this.task(day, k).done).length;
  },

  // ---------- configuración ----------
  setStartDate(iso) {
    state.startDate = iso;
    save();
  },

  // ---------- métricas ----------
  metric(day) {
    return state.metrics[day] || {};
  },
  setMetric(day, key, value) {
    const m = { ...this.metric(day) };
    if (value === '' || value === null || Number.isNaN(value)) delete m[key];
    else m[key] = value;
    if (Object.keys(m).length) state.metrics[day] = m;
    else delete state.metrics[day];
    save();
  },

  // ---------- content bank ----------
  addAsset(asset) {
    const id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
    state.assets.unshift({ id, createdAt: new Date().toISOString(), status: 'available', ...asset });
    save();
  },
  updateAsset(id, patch) {
    state.assets = state.assets.map((a) => (a.id === id ? { ...a, ...patch } : a));
    save();
  },
  removeAsset(id) {
    state.assets = state.assets.filter((a) => a.id !== id);
    save();
  },

  // ---------- respaldo ----------
  exportJSON() {
    return JSON.stringify({ app: 'vidabandida-command-center', exportedAt: new Date().toISOString(), data: state }, null, 2);
  },
  importJSON(text) {
    const parsed = JSON.parse(text);
    const data = parsed && parsed.data ? parsed.data : parsed;
    if (!data || typeof data !== 'object' || !('tasks' in data || 'assets' in data || 'metrics' in data)) {
      throw new Error('El archivo no parece un respaldo del Command Center.');
    }
    state = normalize(data);
    save();
  },
  reset() {
    state = defaults();
    save();
  },
};

// ---------- fechas ----------
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dateForDay(day) {
  const d = parseISO(state.startDate);
  d.setDate(d.getDate() + day - 1);
  return d;
}

// Día del reto según la fecha de inicio: <1 aún no empieza, >30 ya terminó.
export function challengeDay() {
  const start = parseISO(state.startDate);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((today - start) / 86400000) + 1;
}

export function currentDay() {
  return Math.min(30, Math.max(1, challengeDay()));
}

// Racha: días seguidos con las 3 publicaciones hechas, contando hacia atrás
// desde hoy (si hoy aún no está completo, se cuenta desde ayer).
export function streak() {
  const today = Math.min(30, challengeDay());
  if (today < 1) return 0;
  let d = store.dayDone(today, POST_KEYS) === 3 ? today : today - 1;
  let n = 0;
  while (d >= 1 && store.dayDone(d, POST_KEYS) === 3) {
    n++;
    d--;
  }
  return n;
}
