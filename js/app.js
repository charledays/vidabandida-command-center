import { SLOTS, WEEKS, STORIES, DAYS, RULES, CATEGORIES, CATEGORY_HINTS, ASSET_STATUS, METRICS, setPlan } from './plan.js';
import { unlockRemembered, unlockWithPassword, forget } from './lock.js';
import { store, TASK_KEYS, POST_KEYS, challengeDay, currentDay, dateForDay, streak } from './store.js';

const $view = document.getElementById('view');
const $sheet = document.getElementById('sheet');
const $toast = document.getElementById('toast');

// Estado de UI que no se guarda (qué tareas están abiertas, filtros, etc.)
const ui = {
  open: new Set(),
  bank: { q: '', cat: '', status: '' },
  statsDay: null,
  chartMetric: 'reach',
};

// ---------------- utilidades ----------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const weekOf = (day) => Math.min(4, Math.ceil(day / 7));
const dayRange = (w) => (w < 4 ? [w * 7 - 6, w * 7] : [22, 30]);
const fmtDate = (d) => d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
const fmtTime = (iso) => new Date(iso).toLocaleString('es-PE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtNum = (n) => (n == null ? '—' : Number(n).toLocaleString('es-PE', { maximumFractionDigits: 2 }));
const safeUrl = (u) => (/^https?:\/\//i.test(u || '') ? u : '');

const CHECK_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3L13 4.5" fill="none" stroke-width="2.2"/></svg>';

let toastTimer;
function toast(msg) {
  $toast.textContent = msg;
  $toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $toast.classList.remove('show'), 1800);
}

function totals() {
  let posts = 0, tasks = 0;
  for (let d = 1; d <= 30; d++) {
    posts += store.dayDone(d, POST_KEYS);
    tasks += store.dayDone(d);
  }
  return { posts, tasks, pct: Math.round((tasks / 180) * 100) };
}

// ---------------- definición de las 6 tareas de un día ----------------
function tasksFor(day) {
  const p = DAYS[day - 1];
  return [
    ...SLOTS.map((s) => ({ key: s.key, cls: `c-${s.key}`, label: s.label, time: s.time, fn: s.fn, text: p[s.key] })),
    { key: 'stories', label: 'STORIES', time: 'Todo el día', text: 'Stories del día: acompañar cada publicación.', list: STORIES },
    { key: 'mission', label: 'MISIÓN', time: 'Contenido', text: p.mission },
    { key: 'metrics', label: 'RESULTADOS', time: 'Noche', text: 'Registrar resultados y aprendizajes del día.', metrics: true },
  ];
}

function taskHTML(day, t) {
  const st = store.task(day, t.key);
  const id = `${day}:${t.key}`;
  const open = ui.open.has(id);
  const url = safeUrl(st.url);
  return `
  <li class="task ${t.cls || ''} ${st.done ? 'done' : ''} ${open ? 'open' : ''}" data-day="${day}" data-key="${t.key}">
    <div class="task-row">
      <button class="check" data-act="toggle" aria-pressed="${st.done}" aria-label="Marcar ${esc(t.label)} como hecha">${CHECK_SVG}</button>
      <button class="task-main" data-act="expand" aria-expanded="${open}">
        <div class="tag"><span>${esc(t.label)}</span><span class="time">${esc(t.time)}</span></div>
        <div class="task-text">${esc(t.text)}</div>
        ${st.done && st.doneAt ? `<div class="task-sub">Hecho · ${fmtTime(st.doneAt)}</div>` : st.notes || st.url ? `<div class="task-sub">${st.notes ? 'Con notas' : ''}${st.notes && st.url ? ' · ' : ''}${st.url ? 'Con link' : ''}</div>` : ''}
      </button>
      <span class="chev" aria-hidden="true">›</span>
    </div>
    <div class="task-detail">
      ${t.fn ? `<p class="eyebrow" style="margin:0 0 14px;color:var(--c)">Función: ${esc(t.fn)}</p>` : ''}
      ${t.list ? `<ul>${t.list.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      ${t.metrics ? metricsForm(day) + '<div style="height:12px"></div>' : ''}
      <label class="field"><span class="eyebrow">Notas</span>
        <textarea class="input" data-field="notes" placeholder="Caption, prenda, a quién etiquetar, aprendizaje…">${esc(st.notes)}</textarea>
      </label>
      ${t.metrics || t.key === 'mission' ? '' : `
      <label class="field"><span class="eyebrow">Link de la publicación</span>
        <div class="url-row">
          <input class="input" data-field="url" type="url" inputmode="url" placeholder="https://instagram.com/p/…" value="${esc(st.url)}">
          ${url ? `<a class="btn ghost" href="${esc(url)}" target="_blank" rel="noopener">Abrir ↗</a>` : ''}
        </div>
      </label>`}
      ${st.done && st.doneAt ? `<div class="stamp">Completado el ${fmtTime(st.doneAt)}</div>` : ''}
    </div>
  </li>`;
}

function metricsForm(day) {
  const m = store.metric(day);
  return `<div class="mgrid" data-metrics-day="${day}">
    ${METRICS.map((x) => `<label class="field"><span>${esc(x.label)}</span>
      <input class="input" type="number" inputmode="decimal" min="0" step="any" data-metric="${x.key}" value="${m[x.key] ?? ''}" placeholder="—"></label>`).join('')}
  </div>`;
}

// ---------------- vistas ----------------
function topbar(right = '<a class="textbtn" href="#/settings">Ajustes</a>') {
  return `<header class="top">
    <a class="brand" href="#/home"><img src="assets/logo.png" alt="VIDABANDIDA"><span>COMMAND CENTER</span></a>
    ${right}
  </header>`;
}

function viewHome() {
  const cd = challengeDay();
  const day = currentDay();
  const p = DAYS[day - 1];
  const t = totals();
  const done = store.dayDone(day);
  let status;
  if (cd < 1) status = `Empieza en ${1 - cd} ${1 - cd === 1 ? 'día' : 'días'} · ${fmtDate(dateForDay(1))}`;
  else if (cd > 30) status = 'Reto terminado. Revisa resultados y define el siguiente ciclo.';
  else status = `${fmtDate(dateForDay(day))} · Semana ${weekOf(day)} — ${WEEKS[weekOf(day) - 1].title}`;

  const strip = Array.from({ length: 30 }, (_, i) => {
    const d = i + 1;
    const pct = (store.dayDone(d) / 6) * 100;
    const cls = [d === cd ? 'today' : '', d > cd ? 'future' : ''].join(' ');
    return `<a href="#/day/${d}" class="${cls}" aria-label="Día ${d}"><i style="height:${pct}%"></i></a>`;
  }).join('');

  return `${topbar()}
  <section class="hero">
    <div class="eyebrow">${cd < 1 ? 'Próximamente' : cd > 30 ? 'Completado' : 'Hoy'}</div>
    <div class="hero-day">${pad(day)}<small>/30</small></div>
    <div class="hero-title">${esc(p.title)}</div>
    <div class="hero-meta">${esc(status)}</div>
  </section>

  <div class="stats">
    <div class="stat"><b>${t.posts}<small>/90</small></b><span>Posts</span></div>
    <div class="stat"><b>${t.tasks}<small>/180</small></b><span>Tareas</span></div>
    <div class="stat"><b>${t.pct}%</b><span>Reto</span></div>
    <div class="stat"><b>${streak()}</b><span>Racha</span></div>
  </div>
  <div class="strip" aria-label="Progreso de los 30 días">${strip}</div>

  <div class="sec-head"><h2>${cd >= 1 && cd <= 30 ? 'Ejecución de hoy' : `Día ${day}`}</h2><span class="eyebrow">${done}/6</span></div>
  <ul class="tasks">${tasksFor(day).map((x) => taskHTML(day, x)).join('')}</ul>
  <div style="margin-top:18px"><a class="btn ghost block" href="#/day/${day}">Abrir día ${day} →</a></div>
  <div class="tagline">STAY ON THE RADAR</div>`;
}

function viewDay(day) {
  day = Math.min(30, Math.max(1, day | 0));
  const p = DAYS[day - 1];
  const w = WEEKS[weekOf(day) - 1];
  const done = store.dayDone(day);
  const cd = challengeDay();
  return `${topbar('<a class="textbtn" href="#/plan">30 días</a>')}
  <nav class="daynav">
    <a href="#/day/${day - 1}" aria-disabled="${day === 1}">← Día ${day - 1 || ''}</a>
    <span class="eyebrow">${fmtDate(dateForDay(day))}${day === cd ? ' · hoy' : ''}</span>
    <a href="#/day/${day + 1}" aria-disabled="${day === 30}">Día ${day === 30 ? '' : day + 1} →</a>
  </nav>
  <div class="eyebrow">Semana ${w.n} — ${esc(w.title)}</div>
  <div class="hero-day" style="font-size:clamp(64px,22vw,104px)">${pad(day)}<small>/30</small></div>
  <h1 class="hero-title">${esc(p.title)}</h1>
  <p class="weekgoal">${esc(w.goal)}</p>
  <div class="progress" aria-label="${done} de 6 tareas"><i style="width:${(done / 6) * 100}%"></i></div>
  <div class="sec-head"><h2>Checklist</h2><span class="eyebrow">${done}/6 completadas</span></div>
  <ul class="tasks">${tasksFor(day).map((x) => taskHTML(day, x)).join('')}</ul>
  <div class="btn-row" style="margin-top:22px">
    ${day > 1 ? `<a class="btn ghost" href="#/day/${day - 1}">← Anterior</a>` : ''}
    ${day < 30 ? `<a class="btn" href="#/day/${day + 1}">Siguiente día →</a>` : ''}
  </div>`;
}

function viewPlan() {
  const cd = challengeDay();
  const t = totals();
  return `${topbar()}
  <div class="eyebrow">30 Days of Presence</div>
  <h1 style="font-size:34px;line-height:1;margin:10px 0 8px;text-transform:uppercase">90 publicaciones.<br>30 días.</h1>
  <p class="muted" style="margin:0 0 30px;font-size:14px">${t.posts}/90 publicadas · Un universo en movimiento.</p>
  ${WEEKS.map((w) => {
    const [a, b] = dayRange(w.n);
    const rows = [];
    for (let d = a; d <= b; d++) {
      const p = DAYS[d - 1];
      const n = store.dayDone(d);
      const dots = POST_KEYS.map((k) => `<span class="dot c-${k} ${store.task(d, k).done ? 'on' : ''}"></span>`).join('');
      rows.push(`<li><a href="#/day/${d}" class="${d === cd ? 'today' : ''} ${n === 6 ? 'complete' : ''}">
        <span class="n">${pad(d)}</span>
        <span><div class="t">${esc(p.title)}</div><div class="d">${fmtDate(dateForDay(d))}</div></span>
        <span class="dots">${dots}<span class="cnt">${n}/6</span></span>
      </a></li>`);
    }
    return `<section class="week">
      <div class="eyebrow">Semana ${w.n}</div>
      <h2>${esc(w.title)}</h2>
      <p>${esc(w.goal)}</p>
      <ul class="days">${rows.join('')}</ul>
    </section>`;
  }).join('')}
  <div class="tagline">STAY ON THE RADAR</div>`;
}

function viewBank() {
  const { q, cat, status } = ui.bank;
  const all = store.get().assets;
  const needle = q.trim().toLowerCase();
  const list = all.filter((a) =>
    (!cat || a.category === cat) &&
    (!status || a.status === status) &&
    (!needle || `${a.title} ${a.description} ${a.url}`.toLowerCase().includes(needle)));
  const count = (s) => all.filter((a) => a.status === s).length;

  const items = list.map((a) => {
    const st = ASSET_STATUS.find((s) => s.key === a.status) || ASSET_STATUS[0];
    const url = safeUrl(a.url);
    return `<li class="asset" data-id="${esc(a.id)}">
      <div class="asset-top">
        <span class="eyebrow">${esc(a.category)}</span>
        <button class="status ${st.key}" data-act="cycle" aria-label="Cambiar estado (actual: ${st.label})">${st.label}</button>
      </div>
      <h3>${esc(a.title)}</h3>
      ${a.description ? `<p>${esc(a.description)}</p>` : ''}
      ${url ? `<a class="link" href="${esc(url)}" target="_blank" rel="noopener">${esc(url.replace(/^https?:\/\//, '').slice(0, 60))} ↗</a>` : ''}
      <div class="asset-actions"><button class="textbtn" style="padding-left:0" data-act="edit">Editar</button></div>
    </li>`;
  }).join('');

  return `${topbar()}
  <div class="sec-head"><h1 style="font-size:30px;text-transform:uppercase">Content Bank</h1></div>
  <p class="muted" style="margin:4px 0 0;font-size:14px">${all.length} assets · ${count('available')} disponibles · ${count('needed')} por producir</p>
  <div class="filters">
    <input class="input search" type="search" placeholder="Buscar…" value="${esc(q)}" data-filter="q">
    <select class="input" data-filter="cat"><option value="">Todas las carpetas</option>${CATEGORIES.map((c) => `<option ${c === cat ? 'selected' : ''}>${c}</option>`).join('')}</select>
    <select class="input" data-filter="status"><option value="">Todo estado</option>${ASSET_STATUS.map((s) => `<option value="${s.key}" ${s.key === status ? 'selected' : ''}>${s.label}</option>`).join('')}</select>
  </div>
  <button class="btn block" data-act="add">+ Añadir asset</button>
  <div style="height:18px"></div>
  ${list.length ? `<ul class="assets">${items}</ul>` : all.length
    ? `<div class="empty"><b>Nada con esos filtros</b>Prueba otra carpeta o limpia la búsqueda.</div>`
    : `<div class="empty"><b>El banco está vacío</b>Añade fotos y videos con su link (Drive, Fotos de iCloud, Dropbox…) para no despertarte preguntándote qué publicar.</div>
       <ul class="cat-legend">${CATEGORIES.map((c, i) => `<li><b>${pad(i + 1)} — ${c}</b>${esc(CATEGORY_HINTS[c])}</li>`).join('')}</ul>`}
  <div class="tagline">STAY ON THE RADAR</div>`;
}

function viewStats() {
  const day = ui.statsDay || currentDay();
  const metrics = store.get().metrics;
  const sumWeek = (w, k) => {
    const [a, b] = dayRange(w);
    let s = 0, any = false;
    for (let d = a; d <= b; d++) if (metrics[d] && metrics[d][k] != null) { s += Number(metrics[d][k]); any = true; }
    return any ? s : null;
  };
  const total = (k) => Object.values(metrics).reduce((s, m) => s + (m[k] != null ? Number(m[k]) : 0), 0);
  const logged = Object.keys(metrics).length;

  const rows = METRICS.map((m) => {
    const cells = [1, 2, 3, 4].map((w) => {
      const v = sumWeek(w, m.key);
      const prev = w > 1 ? sumWeek(w - 1, m.key) : null;
      let delta = '';
      if (v != null && prev) {
        const pc = Math.round(((v - prev) / prev) * 100);
        delta = `<span class="delta ${pc > 0 ? 'up' : ''}">${pc > 0 ? '+' : ''}${pc}%</span>`;
      }
      return `<td>${fmtNum(v)}${delta}</td>`;
    }).join('');
    return `<tr><td>${esc(m.label)}</td>${cells}</tr>`;
  }).join('');

  return `${topbar()}
  <h1 style="font-size:30px;text-transform:uppercase">Métricas</h1>
  <p class="muted" style="margin:4px 0 22px;font-size:14px">Registro manual desde Instagram. ${logged} de 30 días registrados.</p>

  <div class="totals">
    ${['reach', 'followers', 'sales', 'revenue'].map((k) => `<div><b>${k === 'revenue' ? 'S/ ' : ''}${fmtNum(total(k))}</b><span>${esc(METRICS.find((m) => m.key === k).label.replace(' (S/)', ''))} · total</span></div>`).join('')}
  </div>

  <div class="hr"></div>
  <div class="sec-head"><h2>Registrar día</h2></div>
  <label class="field" style="margin-top:12px">
    <select class="input" data-stats-day>${DAYS.map((d) => `<option value="${d.day}" ${d.day === day ? 'selected' : ''}>Día ${pad(d.day)} — ${esc(d.title)}${metrics[d.day] ? ' ✓' : ''}</option>`).join('')}</select>
  </label>
  ${metricsForm(day)}

  <div class="hr"></div>
  <div class="sec-head"><h2>Por día</h2></div>
  <label class="field" style="margin-top:12px">
    <select class="input" data-chart-metric>${METRICS.map((m) => `<option value="${m.key}" ${m.key === ui.chartMetric ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}</select>
  </label>
  ${chartSVG(ui.chartMetric)}

  <div class="hr"></div>
  <div class="sec-head"><h2>Comparación semanal</h2></div>
  <table class="wtable" style="margin-top:8px">
    <thead><tr><th></th><th>S1</th><th>S2</th><th>S3</th><th>S4</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="note">S4 incluye los días 22 al 30. El % compara con la semana anterior.</p>
  <div class="tagline">STAY ON THE RADAR</div>`;
}

function chartSVG(key) {
  const metrics = store.get().metrics;
  const vals = Array.from({ length: 30 }, (_, i) => (metrics[i + 1] && metrics[i + 1][key] != null ? Number(metrics[i + 1][key]) : null));
  const max = Math.max(...vals.filter((v) => v != null), 0);
  if (!max) return '<div class="empty"><b>Sin datos todavía</b>Registra el primer día y aparecerá aquí.</div>';
  const W = 330, H = 140, top = 16, base = 118, bw = W / 30;
  const bars = vals.map((v, i) => {
    if (v == null) return `<rect x="${i * bw + 1}" y="${base - 1}" width="${bw - 2}" height="1" fill="#2a2a2c"/>`;
    const h = Math.max(1, ((base - top) * v) / max);
    return `<rect x="${i * bw + 1}" y="${base - h}" width="${bw - 2}" height="${h}" fill="#f2f0ea"><title>Día ${i + 1}: ${fmtNum(v)}</title></rect>`;
  }).join('');
  const seps = [7, 14, 21].map((d) => `<line x1="${d * bw}" x2="${d * bw}" y1="${top - 6}" y2="${base}" stroke="#2a2a2c" stroke-dasharray="2 3"/>`).join('');
  const labels = [1, 8, 15, 22, 30].map((d) => `<text x="${(d - 1) * bw + bw / 2}" y="${base + 14}" text-anchor="middle">${d}</text>`).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico por día">
    <text x="0" y="9">máx ${fmtNum(max)}</text>${seps}${bars}${labels}
  </svg>`;
}

function viewSettings() {
  const s = store.get();
  return `${topbar('<a class="textbtn" href="#/home">Cerrar</a>')}
  <h1 style="font-size:30px;text-transform:uppercase">Ajustes</h1>

  <div class="hr"></div>
  <label class="field"><span class="eyebrow">Fecha de inicio del reto (Día 01)</span>
    <input class="input" type="date" data-start value="${s.startDate}">
  </label>
  <p class="note">Día 30: ${fmtDate(dateForDay(30))}. Cambiar la fecha no borra el progreso.</p>

  <div class="hr"></div>
  <div class="sec-head"><h2>Respaldo</h2></div>
  <p class="note" style="margin-bottom:14px">Todo se guarda en este teléfono. Exporta un respaldo cada domingo y guárdalo en Archivos o Drive.${s.updatedAt ? ` Último cambio: ${fmtTime(s.updatedAt)}.` : ''}</p>
  <div class="btn-row">
    <button class="btn" data-act="export">Exportar JSON</button>
    <label class="btn ghost" style="cursor:pointer">Importar<input type="file" accept="application/json,.json" data-import hidden></label>
  </div>

  <div class="hr"></div>
  <div class="sec-head"><h2>Reglas de ejecución</h2></div>
  <ol class="rules" style="margin-top:12px">${RULES.map((r) => `<li>${esc(r)}</li>`).join('')}</ol>

  <div class="hr"></div>
  <div class="sec-head"><h2>Instalar en el iPhone</h2></div>
  <p class="note">Abre esta página en Safari → botón Compartir → “Añadir a pantalla de inicio”. Se abre a pantalla completa y funciona sin conexión.</p>

  <div class="hr"></div>
  <div class="sec-head"><h2>Contraseña</h2></div>
  <p class="note" style="margin-bottom:14px">Este teléfono recuerda la contraseña. Bloquéalo si alguien más va a usarlo; tu progreso no se borra.</p>
  <button class="btn ghost block" data-act="lock">Bloquear este teléfono</button>

  <div class="hr"></div>
  <button class="btn danger block" data-act="reset">Borrar todo el progreso</button>
  <div class="tagline">STAY ON THE RADAR</div>`;
}

// ---------------- sheet: añadir / editar asset ----------------
function openAssetSheet(asset) {
  const a = asset || { title: '', description: '', url: '', category: ui.bank.cat || 'PRODUCT', status: 'available' };
  $sheet.innerHTML = `<form method="dialog" data-asset-form>
    <div class="sheet-head"><h2>${asset ? 'Editar asset' : 'Nuevo asset'}</h2><button class="textbtn" value="cancel" formnovalidate>Cancelar</button></div>
    <label class="field"><span class="eyebrow">Título</span><input class="input" name="title" required value="${esc(a.title)}" placeholder="Ej. Polo negro — detalle bordado"></label>
    <label class="field"><span class="eyebrow">Descripción</span><textarea class="input" name="description" placeholder="Dónde, quién, para qué post…">${esc(a.description)}</textarea></label>
    <label class="field"><span class="eyebrow">Link a la foto / video</span><input class="input" name="url" type="url" inputmode="url" value="${esc(a.url)}" placeholder="https://drive.google.com/…"></label>
    <div class="mgrid" style="margin-bottom:18px">
      <label class="field"><span>Carpeta</span><select class="input" name="category">${CATEGORIES.map((c) => `<option ${c === a.category ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="field"><span>Estado</span><select class="input" name="status">${ASSET_STATUS.map((s) => `<option value="${s.key}" ${s.key === a.status ? 'selected' : ''}>${s.label}</option>`).join('')}</select></label>
    </div>
    <button class="btn block" value="save">${asset ? 'Guardar cambios' : 'Añadir al banco'}</button>
    ${asset ? '<button class="btn danger block" style="margin-top:10px" value="delete" formnovalidate>Eliminar asset</button>' : ''}
  </form>`;
  const form = $sheet.querySelector('form');
  form.addEventListener('submit', (e) => {
    const action = e.submitter && e.submitter.value;
    if (action === 'cancel') return;
    if (action === 'delete') {
      if (confirm('¿Eliminar este asset del banco?')) { store.removeAsset(asset.id); toast('Asset eliminado'); render(); }
      else e.preventDefault();
      return;
    }
    const fd = new FormData(form);
    const data = {
      title: fd.get('title').trim(),
      description: fd.get('description').trim(),
      url: fd.get('url').trim(),
      category: fd.get('category'),
      status: fd.get('status'),
    };
    if (!data.title) { e.preventDefault(); return; }
    if (asset) store.updateAsset(asset.id, data); else store.addAsset(data);
    toast(asset ? 'Guardado' : 'Añadido al banco');
    render();
  });
  $sheet.showModal();
}

// ---------------- router ----------------
function route() {
  const h = location.hash.replace(/^#\/?/, '') || 'home';
  const [name, arg] = h.split('/');
  return { name, arg };
}

let unlocked = false;

function viewLock(error = '') {
  return `<section class="lock">
    <img class="lock-mark" src="icons/icon-192.png" alt="">
    <img class="lock-logo" src="assets/logo.png" alt="VIDABANDIDA">
    <div class="lock-sub">COMMAND CENTER</div>
    <form class="lock-form" data-lock-form>
      <label class="field"><span class="eyebrow">Contraseña</span>
        <input class="input" type="password" name="pass" autocomplete="current-password" required autofocus>
      </label>
      <p class="lock-error" role="alert">${esc(error)}</p>
      <button class="btn block" type="submit">Entrar</button>
    </form>
    <div class="tagline">STAY ON THE RADAR</div>
  </section>`;
}

function render({ keepScroll = false } = {}) {
  document.body.classList.toggle('locked', !unlocked);
  if (!unlocked) { $view.innerHTML = viewLock(); return; }
  const y = window.scrollY;
  const { name, arg } = route();
  const tab = { home: 'home', day: 'plan', plan: 'plan', bank: 'bank', stats: 'stats' }[name] || '';
  let html;
  switch (name) {
    case 'day': html = viewDay(Number(arg) || currentDay()); break;
    case 'plan': html = viewPlan(); break;
    case 'bank': html = viewBank(); break;
    case 'stats': html = viewStats(); break;
    case 'settings': html = viewSettings(); break;
    default: html = viewHome();
  }
  $view.innerHTML = html;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('active', a.dataset.tab === tab));
  if (keepScroll) window.scrollTo(0, y);
}

window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

// ---------------- eventos (delegados) ----------------
$view.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-act]');
  if (!btn) return;
  const act = btn.dataset.act;
  const task = btn.closest('.task');

  if (act === 'toggle' && task) {
    const t = store.toggleTask(Number(task.dataset.day), task.dataset.key);
    if (navigator.vibrate) navigator.vibrate(10);
    const d = Number(task.dataset.day);
    if (t.done && store.dayDone(d) === 6) toast(`Día ${d} completo`);
    else if (t.done && POST_KEYS.includes(task.dataset.key) && store.dayDone(d, POST_KEYS) === 3) toast('3/3 publicaciones');
    render({ keepScroll: true });
  } else if (act === 'expand' && task) {
    const id = `${task.dataset.day}:${task.dataset.key}`;
    ui.open.has(id) ? ui.open.delete(id) : ui.open.add(id);
    task.classList.toggle('open');
    btn.setAttribute('aria-expanded', task.classList.contains('open'));
  } else if (act === 'add') {
    openAssetSheet();
  } else if (act === 'edit' || act === 'cycle') {
    const id = btn.closest('.asset').dataset.id;
    const a = store.get().assets.find((x) => x.id === id);
    if (!a) return;
    if (act === 'edit') return openAssetSheet(a);
    const i = ASSET_STATUS.findIndex((s) => s.key === a.status);
    const next = ASSET_STATUS[(i + 1) % ASSET_STATUS.length];
    store.updateAsset(id, { status: next.key });
    toast(next.label);
    render({ keepScroll: true });
  } else if (act === 'export') {
    exportBackup();
  } else if (act === 'lock') {
    if (confirm('¿Bloquear? Vas a necesitar la contraseña para volver a entrar. Tu progreso se queda guardado.')) {
      forget();
      unlocked = false;
      location.hash = '#/home';
      render();
    }
  } else if (act === 'reset') {
    if (confirm('Esto borra todas las tareas, notas, métricas y el banco de contenido de este teléfono. ¿Continuar?') &&
        confirm('¿Seguro? No se puede deshacer. Exporta un respaldo antes si lo necesitas.')) {
      store.reset();
      ui.open.clear();
      toast('Progreso borrado');
      render();
    }
  }
});

$view.addEventListener('input', (e) => {
  const el = e.target;
  const task = el.closest('.task');
  if (el.dataset.field && task) {
    store.updateTask(Number(task.dataset.day), task.dataset.key, { [el.dataset.field]: el.value.trim() ? el.value : '' });
    return;
  }
  if (el.dataset.metric) {
    const day = Number(el.closest('[data-metrics-day]').dataset.metricsDay);
    store.setMetric(day, el.dataset.metric, el.value === '' ? '' : Number(el.value));
    return;
  }
  if (el.dataset.filter === 'q') {
    ui.bank.q = el.value;
    clearTimeout(el._t);
    el._t = setTimeout(() => {
      const pos = el.selectionStart;
      render({ keepScroll: true });
      const s = $view.querySelector('[data-filter="q"]');
      s.focus();
      s.setSelectionRange(pos, pos);
    }, 180);
  }
});

$view.addEventListener('change', (e) => {
  const el = e.target;
  if (el.dataset.filter === 'cat' || el.dataset.filter === 'status') {
    ui.bank[el.dataset.filter] = el.value;
    render({ keepScroll: true });
  } else if (el.hasAttribute('data-stats-day')) {
    ui.statsDay = Number(el.value);
    render({ keepScroll: true });
  } else if (el.hasAttribute('data-chart-metric')) {
    ui.chartMetric = el.value;
    render({ keepScroll: true });
  } else if (el.hasAttribute('data-start')) {
    if (el.value) { store.setStartDate(el.value); toast('Fecha guardada'); render({ keepScroll: true }); }
  } else if (el.hasAttribute('data-import')) {
    importBackup(el.files[0]);
    el.value = '';
  } else if (el.dataset.metric || el.dataset.field === 'url') {
    // al terminar de editar métricas o un link, refrescar resúmenes/links
    if (route().name === 'stats' || el.dataset.field === 'url') render({ keepScroll: true });
    else toast('Guardado');
  }
});

async function exportBackup() {
  const name = `vidabandida-command-center-${new Date().toISOString().slice(0, 10)}.json`;
  const blob = new Blob([store.exportJSON()], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return;
    }
  } catch (err) {
    if (err && err.name === 'AbortError') return;
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Respaldo exportado');
}

async function importBackup(file) {
  if (!file) return;
  try {
    const text = await file.text();
    if (!confirm('Importar reemplaza todo lo que hay ahora en este teléfono por el respaldo. ¿Continuar?')) return;
    store.importJSON(text);
    toast('Respaldo restaurado');
    render();
  } catch (err) {
    alert(`No se pudo importar: ${err.message}`);
  }
}

// Al volver a la app (p. ej. al día siguiente) refrescar el día actual.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !$view.contains(document.activeElement)) render({ keepScroll: true });
});

$view.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-lock-form]');
  if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('button');
  const input = form.pass;
  btn.disabled = true;
  btn.textContent = 'Abriendo…';
  try {
    setPlan(await unlockWithPassword(input.value, true));
    unlocked = true;
    render();
    window.scrollTo(0, 0);
  } catch (err) {
    form.querySelector('.lock-error').textContent = err.message === 'WRONG'
      ? 'Contraseña incorrecta.'
      : 'No se pudo abrir. Revisa tu conexión e inténtalo de nuevo.';
    input.value = '';
    input.focus();
    btn.disabled = false;
    btn.textContent = 'Entrar';
  }
});

// ---------------- arranque ----------------
(async () => {
  const plan = await unlockRemembered();
  if (plan) { setPlan(plan); unlocked = true; }
  render();
})();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
