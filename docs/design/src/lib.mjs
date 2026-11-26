// Shared building blocks that copy the Bright reference screens (docs/design/screens).
export const INK = '#0e1a2b';

const P = {
  phone: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z',
  mail: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 7l-10 6L2 7',
  chat: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  plus: 'M12 5v14M5 12h14',
  arrowR: 'M5 12h14M12 5l7 7-7 7',
  chevD: 'M6 9l6 6 6-6',
  chevR: 'M9 18l6-6-6-6',
  chevL: 'M15 18l-6-6 6-6',
  check: 'M20 6L9 17l-5-5',
  x: 'M18 6L6 18M6 6l12 12',
  edit: 'M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z',
  more: 'M12 12h.01M19 12h.01M5 12h.01',
  archive: 'M21 8v13H3V8M1 3h22v5H1zM10 12h4',
  merge: 'M18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 21V9a9 9 0 0 0 9 9',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  trash: 'M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2',
  lock: 'M5 11h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2zM7 11V7a5 5 0 0 1 10 0v4',
  upload: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12',
  eye: 'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  undo: 'M3 7v6h6M21 17a9 9 0 0 0-15-6.7L3 13',
  pin: 'M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0zM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  building: 'M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18zM6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2M10 6h4M10 10h4M10 14h4M10 18h4',
  card: 'M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM2 10h20',
  tag: 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  dollar: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  link: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71',
  bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
  shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  alert: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  play: 'M6 4l13 8-13 8z',
  skip: 'M5 4l10 8-10 8zM19 5v14',
  send: 'M22 2L11 13M22 2l-7 20-4-9-9-4z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM21 21l-4.3-4.3',
  external: 'M15 3h6v6M10 14L21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6',
  down: 'M12 5v14M19 12l-7 7-7-7',
  download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  globe: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z',
  calendar: 'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM16 2v4M8 2v4M3 10h18',
  filter: 'M22 3H2l8 9.46V19l4 2v-8.54z',
  info: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 16v-4M12 8h.01',
  key: 'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78zM15.5 7.5l3 3L22 7l-3-3',
};

export const icon = (name, size = 14, sw = 2) => {
  const w = ['more', 'grip'].includes(name) ? 3 : sw;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex-shrink:0"><path d="${P[name]}"></path></svg>`;
};

// ---- spot art (same drawings as the reference screens) ----
export const art = {
  person: (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><circle cx="27" cy="21" r="8" fill="#f7d154"></circle><circle cx="24" cy="19" r="8" fill="#7fbef0" stroke="#0e1a2b" stroke-width="2.5"></circle><path d="M8 48c2-10 8-16 16-16s14 6 16 16" fill="#0e1a2b"></path></svg>`,
  block: (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><rect x="18" y="13" width="20" height="35" fill="#f7d154"></rect><rect x="14" y="9" width="20" height="39" fill="#ffffff" stroke="#0e1a2b" stroke-width="2.5"></rect><path d="M19 16h3M26 16h3M19 23h3M26 23h3M19 30h3M26 30h3" stroke="#0e1a2b" stroke-width="2.5"></path><path d="M21 48v-8h6v8" fill="#7fbef0" stroke="#0e1a2b" stroke-width="2"></path></svg>`,
  house: (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><circle cx="36" cy="12" r="6" fill="#f7d154"></circle><path d="M6 30L24 15l18 15v18H6z" fill="#0e1a2b"></path><path d="M19 48V36h10v12" fill="#7fbef0"></path><rect x="11" y="31" width="5" height="5" fill="#ffffff"></rect></svg>`,
  deal: (s = 30) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48"><circle cx="26" cy="30" r="13" fill="#f7d154"></circle><path d="M15 46V8" stroke="#0e1a2b" stroke-width="2.5" stroke-linecap="round"></path><path d="M15 9h18l-4 6 4 6H15z" fill="#ffffff" stroke="#0e1a2b" stroke-width="2.5" stroke-linejoin="round"></path></svg>`,
  personRound: (s = 52) => `<svg width="${s}" height="${s}" viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="24" r="22" fill="#dceefc"></circle><circle cx="26" cy="20" r="7" fill="#f7d154"></circle><circle cx="24" cy="18" r="7" fill="#7fbef0" stroke="#0e1a2b" stroke-width="2.5"></circle><path d="M10 41c2-8 7-12 14-12s12 4 14 12" fill="#0e1a2b"></path></svg>`,
};
const TINT = { person: '#dceefc', block: '#eef7fe', house: '#fff3c4', deal: '#e3f1e8' };
export const thumb = (kind, box = 34, s = 30, tint) =>
  `<span style="width:${box}px;height:${box}px;flex-shrink:0;border-radius:8px;border:1.5px solid #0e1a2b;box-sizing:border-box;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;background:${tint || TINT[kind]}">${art[kind](s)}</span>`;

// ---- primitives ----
export const btn = (label, { ic, kind = 'secondary', offset = false, size = 'md', full = false, disabled = false } = {}) => {
  const h = size === 'sm' ? 30 : 36;
  const base = `display:inline-flex;align-items:center;justify-content:center;gap:8px;height:${h}px;padding:0 ${size === 'sm' ? 10 : 14}px;border-radius:6px;font-size:12px;cursor:pointer;white-space:nowrap;box-sizing:border-box;${full ? 'width:100%;' : ''}`;
  const look = {
    primary: `border:0;background:var(--pri);color:#fff;font-weight:600;${offset ? 'box-shadow:3px 3px 0 0 #f7d154;' : ''}`,
    secondary: `border:1px solid #7d8897;background:var(--surf);color:${INK};font-weight:500;`,
    ghost: `border:0;background:transparent;color:var(--muted);font-weight:500;`,
    dashed: `border:1px dashed #7d8897;background:var(--surf);color:${INK};font-weight:500;`,
    destructive: `border:0;background:var(--danger);color:#fff;font-weight:600;`,
    danger: `border:1px solid #e8b4ae;background:#fff;color:#c2362b;font-weight:500;`,
  }[kind];
  return `<button style="${base}${look}${disabled ? 'opacity:.45;' : ''}">${ic ? icon(ic, 14, kind === 'primary' ? 2.5 : 2) : ''}${label}</button>`;
};
export const iconBtn = (ic, label, size = 32) =>
  `<button aria-label="${label}" title="${label}" style="width:${size}px;height:${size}px;flex-shrink:0;border-radius:6px;border:1px solid var(--line);background:var(--surf);color:${INK};display:flex;align-items:center;justify-content:center;cursor:pointer">${icon(ic, 14)}</button>`;

export const pill = (text, bg, fg, { dot, size = 11 } = {}) =>
  `<span style="display:inline-flex;align-items:center;gap:5px;font-size:${size}px;font-weight:500;padding:2px 8px;border-radius:999px;white-space:nowrap;background:${bg};color:${fg}">${dot ? `<span style="width:6px;height:6px;border-radius:999px;background:${dot}"></span>` : ''}${text}</span>`;
export const tag = (text, bg, fg) =>
  `<span style="font-size:10px;font-weight:500;padding:1px 6px;border-radius:4px;white-space:nowrap;background:${bg};color:${fg}">${text}</span>`;

export const ROLE = {
  'Купувач': ['var(--sel)', INK], 'Собственик': ['#fdf3cf', '#6b4a10'], 'Наемател': ['#e3f1e8', '#28703f'],
  'Купува': ['var(--sel)', INK], 'Продава': ['#fdf3cf', '#6b4a10'], 'Наема': ['#e3f1e8', '#28703f'], 'Отдава': ['#f3e8fb', '#6b3a8a'],
  'Продажба': ['var(--sel)', INK], 'Наем': ['#e3f1e8', '#28703f'],
};
export const role = (r) => tag(r, ROLE[r][0], ROLE[r][1]);
export const TEMP = { 'Горещ': ['#fbe9e7', '#c2362b', '#c2362b'], 'Топъл': ['#fbf1de', '#8a5605', '#e2a12b'], 'Студен': ['#eef3f8', '#3d5a80', '#7d8897'] };
export const temp = (t) => pill(t, TEMP[t][0], TEMP[t][1], { dot: TEMP[t][2] });

export const ST = {
  red: ['#fbe9e7', '#c2362b'], amber: ['#fbf1de', '#8a5605'], green: ['#e3f1e8', '#28703f'], blue: ['var(--sel)', INK], grey: ['#eef3f8', '#5a6676'], yellow: ['#fff3c4', '#6b4a10'],
};
export const status = (text, c) => tag(text, ST[c][0], ST[c][1]).replace('font-size:10px', 'font-size:11px').replace('padding:1px 6px', 'padding:2px 7px');

const AV = ['#dceefc', '#fdf3cf', '#e3f1e8', '#f3e8fb', '#ffe6d8'];
export const avatar = (ini, i = 0, size = 36) =>
  `<span style="width:${size}px;height:${size}px;flex-shrink:0;border-radius:999px;border:1.5px solid #0e1a2b;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:${size > 40 ? 15 : 11}px;font-weight:700;color:${INK};background:${AV[i % AV.length]}">${ini}</span>`;
export const agent = (ini) =>
  `<span style="width:26px;height:26px;flex-shrink:0;border-radius:999px;background:var(--sel);color:${INK};font-size:10px;font-weight:600;display:flex;align-items:center;justify-content:center">${ini}</span>`;

export const card = (inner, extra = '') =>
  `<section style="background:var(--surf);border:1px solid var(--line);border-radius:8px;box-shadow:var(--card-shadow);overflow:hidden;${extra}">${inner}</section>`;
export const cardHead = (title, right = '', count = '') =>
  `<div style="display:flex;align-items:center;gap:10px;padding:14px 20px;border-bottom:1px solid var(--line)"><h2 style="margin:0;flex:1;font-size:15px;font-weight:600">${title}${count ? ` <span style="color:var(--muted);font-weight:400;font-size:13px">${count}</span>` : ''}</h2>${right}</div>`;
export const label = (t) => `<span style="font-size:10px;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:var(--muted)">${t}</span>`;

export const tabs = (items, active = 0, pad = '0 20px', bordered = true) =>
  `<div role="tablist" style="display:flex;flex-wrap:wrap;gap:22px;padding:${pad};${bordered ? 'border-bottom:1px solid var(--line);' : ''}">${items
    .map(([l, c], i) => `<button role="tab" style="border:0;background:transparent;padding:12px 0;cursor:pointer;font-size:12px;border-bottom:2px solid ${i === active ? `var(--pri);color:${INK};font-weight:600` : 'transparent;color:var(--muted)'}">${l}${c ? ` <span style="color:var(--muted);font-weight:400">${c}</span>` : ''}</button>`)
    .join('')}</div>`;

export const search = (ph, flex = '1 1 220px') =>
  `<label style="flex:${flex};display:flex;align-items:center;gap:8px;height:34px;box-sizing:border-box;border:1px solid #7d8897;border-radius:6px;padding:0 10px;background:var(--surf);font-size:12px;color:var(--muted)">${icon('search')}<span>${ph}</span></label>`;
export const chip = (l, on = false) =>
  `<button style="display:flex;align-items:center;gap:6px;height:34px;padding:0 12px;border-radius:6px;font-size:12px;cursor:pointer;border:1px solid ${on ? 'var(--pri)' : 'var(--line)'};background:${on ? 'var(--sel)' : 'var(--surf)'};color:${INK};font-weight:${on ? 600 : 400}">${l}${icon('chevD', 12, 2.5)}</button>`;
export const filterBar = (inner) =>
  `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;padding:12px 20px;border-bottom:1px solid var(--line)">${inner}</div>`;

export const field = (lbl, value, { w, ph = false, prefix, suffix, hint, select = false, req = false, disabled = false, focus = false, err } = {}) =>
  `<label style="display:flex;flex-direction:column;gap:6px;${w ? `flex:0 0 ${w}` : 'flex:1 1 0'};min-width:0">
    <span style="font-size:12px;font-weight:500;color:${INK}">${lbl}${req ? '<span style="color:#c2362b"> *</span>' : ''}</span>
    <span style="display:flex;align-items:center;gap:8px;height:36px;box-sizing:border-box;border:1px solid ${err ? '#c2362b' : focus ? 'var(--pri)' : '#7d8897'};${focus ? 'box-shadow:0 0 0 3px #dceefc;' : ''}border-radius:6px;padding:0 10px;background:${disabled ? '#f4f6f8' : 'var(--surf)'};font-size:13px;color:${ph || disabled ? 'var(--muted)' : INK}">
      ${prefix ? `<span style="color:var(--muted)">${prefix}</span>` : ''}<span style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</span>${suffix ? `<span style="color:var(--muted);font-size:12px">${suffix}</span>` : ''}${select ? `<span style="color:var(--muted)">${icon('chevD', 14)}</span>` : ''}
    </span>
    ${err ? `<span style="font-size:11px;color:#c2362b">${err}</span>` : hint ? `<span style="font-size:11px;color:var(--muted)">${hint}</span>` : ''}
  </label>`;

export const segmented = (opts, on = 0) =>
  `<div style="display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--surf)">${opts
    .map((o, i) => `<button style="height:30px;padding:0 14px;border:0;border-radius:6px;font-size:12px;cursor:pointer;${i === on ? `background:var(--sel);color:${INK};font-weight:600` : 'background:transparent;color:var(--muted)'}">${o}</button>`)
    .join('')}</div>`;

export const toggle = (on = true) =>
  `<span style="width:40px;height:24px;flex-shrink:0;border-radius:999px;background:${on ? 'var(--pri)' : '#dce1e7'};position:relative;display:inline-block"><span style="position:absolute;top:3px;${on ? 'right:3px' : 'left:3px'};width:18px;height:18px;border-radius:999px;background:#fff;box-shadow:0 1px 2px rgba(14,26,43,.25)"></span></span>`;

export const th = (cols) =>
  `<div style="display:grid;grid-template-columns:${cols.map((c) => c[1]).join(' ')};gap:14px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--line);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)">${cols.map((c) => `<span style="${c[2] || ''}">${c[0]}</span>`).join('')}</div>`;
export const tr = (cols, cells, extra = '') =>
  `<div style="display:grid;grid-template-columns:${cols.map((c) => c[1]).join(' ')};gap:14px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line);font-size:12px;${extra}">${cells.map((c, i) => `<div style="min-width:0;${cols[i][2] || ''}">${c}</div>`).join('')}</div>`;

export const two = (a, b) =>
  `<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${a}</span><span style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b}</span></span>`;

// ---- shell ----
const NAV = [
  ['Моят ден', [['Днес', 'clockNav', '7', true], ['Запитвания', 'inbox', '3']]],
  ['Работа', [['Сделки', 'briefcase'], ['Списъци', 'list']]],
  ['База', [['Контакти', 'users'], ['Имоти', 'home']]],
  ['Агенция', [['Табло', 'bars'], ['Отчети', 'trophy'], ['Изключения', 'alert', '2', true], ['Настройки', 'sliders']]],
];
const NP = {
  clockNav: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  briefcase: 'M4 7h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2zM16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  users: P.users,
  home: 'M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10',
  bars: 'M18 20V10M12 20V4M6 20v-6',
  trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 6h3a3 3 0 0 1-3 3M7 6H4a3 3 0 0 0 3 3',
  alert: P.alert,
  sliders: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
};
const RECENT = [
  ['deal', 'Иван Петров', 'Сделка · 3-стаен, Лозенец', '2 мин'],
  ['block', 'Имот 1042', 'Козяк · 95 м²', '18 мин'],
  ['person', 'Мария К.', 'Купувач · Витоша', '1 ч'],
  ['house', 'Имот 1131', 'Бояна · къща', 'вчера'],
  ['person', 'Георги Н.', 'Собственик · Яворов', 'вчера'],
];

export const sidebar = (active) => `
<nav aria-label="Основна навигация" style="box-sizing:border-box;background:var(--side);border-right:1px solid var(--line);display:flex;flex-direction:column;flex:0 0 244px;padding:16px 14px">
  <div style="flex:1;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:34px;height:34px;flex-shrink:0;border-radius:6px;background:var(--pri);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">АИ</div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-weight:600;font-size:13px">Алфа Имоти</span><span style="font-size:11px;color:var(--muted)">Смени агенция</span></div>
      <button style="width:32px;height:32px;flex-shrink:0;border-radius:6px;border:1px solid var(--line);background:var(--surf);color:${INK};display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"></rect><path d="M9 4v16M16 10l-2 2 2 2"></path></svg></button>
    </div>
    <label style="display:flex;align-items:center;gap:8px;border:1px solid #7d8897;border-radius:6px;padding:7px 10px;background:var(--surf);font-size:12px;color:var(--muted)">${icon('search')}<span style="flex:1">Търсене</span><span style="border:1px solid var(--line);border-radius:4px;padding:0 4px;font-size:10px">Ctrl K</span></label>
    ${NAV.map(([g, items]) => `<div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);padding:6px 8px 4px">${g}</span>${items
      .map(([l, ic, count, alert]) => {
        const on = l === active;
        return `<a style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:6px;text-decoration:none;font-size:13px;${on ? 'background:var(--sel);color:var(--sel-ink);font-weight:600' : `color:${INK}`}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${NP[ic]}"></path></svg><span style="flex:1">${l}</span>${count ? `<span style="${alert ? 'font-size:11px;font-weight:600;padding:0 6px;border-radius:999px;background:#fbe9e7;color:#c2362b' : 'font-size:11px;color:var(--muted)'}">${count}</span>` : ''}</a>`;
      })
      .join('')}</div>`).join('')}
    <div style="flex:1;min-height:8px"></div>
    <div style="display:flex;flex-direction:column;gap:2px">
      <div style="display:flex;align-items:center;padding:6px 8px 4px"><span style="flex:1;font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)">Последно отворени</span><span style="font-size:10px;color:var(--muted)">5</span></div>
      ${RECENT.map(([k, n, s, w]) => `<a style="display:flex;align-items:center;gap:10px;padding:5px 8px;border-radius:6px;color:${INK};text-decoration:none">${thumb(k)}<span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n}</span><span style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</span></span><span style="font-size:10px;color:var(--muted);white-space:nowrap">${w}</span></a>`).join('')}
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;border-top:1px solid var(--line);padding-top:12px">
      <div style="display:flex;align-items:center;gap:10px">
        <div style="position:relative;width:32px;height:32px;flex-shrink:0;border-radius:999px;background:var(--sel);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600">ДА<span style="position:absolute;right:-2px;bottom:-2px;width:12px;height:12px;border-radius:999px;box-sizing:border-box;border:2px solid var(--side);background:#2e9e5b"></span></div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-size:12px;font-weight:600">Димитър А.</span><span style="font-size:11px;color:var(--muted)">Брокер · Свободен</span></div>
        <span style="width:32px;height:32px;color:var(--muted);display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg></span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px;background:var(--surf)">
        ${[['Свободен', '#2e9e5b', true], ['На оглед', '#2b63c6'], ['Зает', '#c2362b']].map(([l, c, on]) => `<span style="display:flex;align-items:center;justify-content:center;gap:5px;height:30px;padding:0 4px;border-radius:6px;font-size:10px;white-space:nowrap;${on ? `background:var(--sel);color:${INK};font-weight:600` : 'color:var(--muted)'}"><span style="width:7px;height:7px;border-radius:999px;background:${c}"></span>${l}</span>`).join('')}
      </div>
    </div>
  </div>
</nav>`;

export const header = (crumbs) => `
<header style="display:flex;align-items:center;gap:12px;padding:12px 28px;border-bottom:1px solid var(--line);background:var(--top)">
  <nav style="flex:1;display:flex;flex-wrap:wrap;align-items:center;gap:10px;font-size:13px;color:var(--muted)">${crumbs
    .map((c, i) => (i === crumbs.length - 1 ? `<span style="color:${INK};font-weight:600">${c}</span>` : `<span>${c}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"></path></svg>`))
    .join('')}</nav>
  <button style="display:flex;align-items:center;gap:6px;height:36px;padding:0 14px;border-radius:6px;border:0;background:var(--pri);color:#fff;font-size:13px;font-weight:600">${icon('plus', 14, 2.5)}Ново</button>
  ${iconBtn('bell', 'Известия', 36)}
</header>`;

export const pageTitle = (title, sub, actions = '') => `
<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px">
  <div style="flex:1 1 320px;display:flex;flex-direction:column;gap:6px">
    <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.02em">${title}</h1>
    ${sub ? `<p style="margin:0;font-size:12px;color:var(--muted)">${sub}</p>` : ''}
  </div>
  ${actions}
</div>`;

const HEAD = `<!doctype html><html lang="bg"><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Sofia+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap">
<style>
body{margin:0}
a{color:#2b63c6}
.dp{font-family:'Sofia Sans',system-ui,sans-serif;font-variant-numeric:tabular-nums;color:#0e1a2b;-webkit-font-smoothing:antialiased}
.dp button,.dp input,.dp select{font-family:inherit}
.th-bright{--pg:#ffffff;--side:#f6faff;--surf:#ffffff;--muted:#5a6676;--line:#dce1e7;--sel:#dceefc;--sel-ink:#0e1a2b;--pri:#2b63c6;--pri-h:#1b3a6b;--step:#2b63c6;--next-bg:#eef7fe;--next-line:#7fbef0;--danger:#c2362b;--danger-bg:#fbe9e7;--warn-bg:#fbf1de;--warn-ink:#8a5605;--ok-bg:#e3f1e8;--ok-ink:#28703f;--foot:#f6faff;--hl:#fff8dc;--card-shadow:none;--top:#ffffff}
</style></head><body>`;

export const page = ({ active, crumbs, body, minH = 1000 }) => `${HEAD}
<div class="dp th-bright" style="width:1280px;min-height:${minH}px;display:flex;background:var(--pg)">
${sidebar(active)}
<main style="flex:1;min-width:0;display:flex;flex-direction:column">
${header(crumbs)}
<div style="padding:24px 28px 40px;display:flex;flex-direction:column;gap:18px">${body}</div>
</main></div></body></html>`;

export const bare = (body, minH = 820) => `${HEAD}<div class="dp th-bright" style="width:1280px;min-height:${minH}px;display:flex;background:var(--pg)">${body}</div></body></html>`;

// ---- settings shell ----
const SNAV = [
  ['Лично', [['Моят профил', 'user']]],
  ['Агенция', [['Профил на агенцията', 'building'], ['Потребители и роли', 'users', '7'], ['Абонамент и фактури', 'card']]],
  ['Работа', [['Етапи на сделките', 'arrowR'], ['Източници на запитвания', 'tag'], ['Квартали', 'pin'], ['Правила и изключения', 'alert'], ['Комисиони и цели', 'dollar'], ['Шаблони за съобщения', 'msg']]],
  ['Връзки и данни', [['Портали', 'link', '1'], ['Импорт', 'upload'], ['Известия', 'bell'], ['Данни и GDPR', 'shield']]],
];
export const settingsPage = ({ active, crumbs, title, sub, actions = '', content, footer = '', minH = 1000, pageSub }) =>
  page({
    active: 'Настройки',
    crumbs: crumbs || ['Агенция', 'Настройки', active],
    minH,
    body: `
${pageTitle('Настройки', pageSub || 'Алфа Имоти · Видими само за собственика и мениджърите')}
<div style="display:flex;gap:24px;align-items:flex-start">
  <nav style="flex:0 0 220px;display:flex;flex-direction:column;gap:2px">${SNAV.map(([g, items]) => `<span style="font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted);padding:10px 10px 6px">${g}</span>${items
      .map(([l, ic, c]) => { const on = l === active; return `<a style="display:flex;align-items:center;gap:12px;padding:10px 10px;border-radius:6px;font-size:13px;text-decoration:none;${on ? `background:var(--sel);font-weight:600;color:${INK}` : `color:${INK}`}">${icon(ic, 16)}<span style="flex:1">${l}</span>${c ? `<span style="font-size:10px;font-weight:600;padding:0 6px;border-radius:999px;background:${l === 'Портали' ? '#fdf3cf' : 'var(--sel)'};color:${INK}">${c}</span>` : ''}</a>`; })
      .join('')}`).join('')}</nav>
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px">
    <div style="display:flex;align-items:flex-end;gap:12px"><div style="flex:1;display:flex;flex-direction:column;gap:6px;padding-top:6px"><h2 style="margin:0;font-size:18px;font-weight:700;letter-spacing:-0.01em">${title}</h2><p style="margin:0;font-size:12px;color:var(--muted)">${sub}</p></div>${actions}</div>
    ${content}
    ${footer}
  </div>
</div>`,
  });

export const saveBar = (note = 'Последна промяна: Димитър А. · днес 09:14', primary = 'Запази промените') =>
  `<div style="display:flex;align-items:center;gap:10px;padding-top:4px"><span style="flex:1;font-size:11px;color:var(--muted)">${note}</span>${btn('Откажи')}${btn(primary, { kind: 'primary' })}</div>`;
