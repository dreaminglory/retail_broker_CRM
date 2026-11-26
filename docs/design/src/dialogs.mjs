import { INK, icon, btn, iconBtn, field, segmented, tag, pill, avatar, thumb, bare, toggle, label } from './lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCREENS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../screens');
const bgUrl = (f) => 'file:///' + path.join(SCREENS, f).replace(/\\/g, '/');

// ---- dialog frame: dimmed reference screen + floating Bright dialog (radius-lg, shadow-float) ----
const frame = ({ bg, w = 520, title, sub, body, footer, h = 800, kicker, top }) =>
  bare(
    `<div style="position:relative;width:1280px;height:${h}px;overflow:hidden">
  <img src="${bgUrl(bg)}" style="position:absolute;left:0;top:0;width:1280px;display:block" alt="">
  <div style="position:absolute;inset:0;background:rgba(14,26,43,.42)"></div>
  <div role="dialog" aria-modal="true" style="position:absolute;left:50%;top:${top == null ? '50%' : top + 'px'};transform:translate(-50%,${top == null ? '-50%' : '0'});width:${w}px;max-width:calc(100% - 32px);box-sizing:border-box;background:#fff;border:1px solid var(--line);border-radius:8px;box-shadow:0 8px 24px -4px rgba(14,26,43,.18),0 24px 60px -12px rgba(14,26,43,.35)">
    <div style="display:flex;align-items:flex-start;gap:12px;padding:18px 20px 14px">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:5px">
        ${kicker ? label(kicker) : ''}
        <h2 style="margin:0;font-size:17px;line-height:24px;font-weight:700;letter-spacing:-0.01em">${title}</h2>
        ${sub ? `<p style="margin:0;font-size:12px;line-height:17px;color:var(--muted)">${sub}</p>` : ''}
      </div>
      ${iconBtn('x', 'Затвори', 30).replace('border:1px solid var(--line)', 'border:0')}
    </div>
    <div style="padding:4px 20px 20px;display:flex;flex-direction:column;gap:14px">${body}</div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:14px 20px;border-top:1px solid var(--line);background:var(--foot);border-radius:0 0 8px 8px">${footer}</div>
  </div>
</div>`,
    h,
  );

const tint = (on = true) => `border:1px solid ${on ? 'var(--next-line)' : 'var(--line)'};border-radius:8px;background:${on ? 'var(--next-bg)' : '#fff'}`;
const cancel = (t = 'Отказ') => btn(t);
const ok = (t, ic) => btn(t, { kind: 'primary', offset: true, ic });
const row = (...c) => `<div style="display:flex;gap:12px">${c.join('')}</div>`;
const area = (lbl, val, { ph = false, h = 76, hint } = {}) =>
  `<label style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;font-weight:500">${lbl}</span><span style="display:block;box-sizing:border-box;height:${h}px;border:1px solid #7d8897;border-radius:6px;padding:9px 10px;font-size:13px;line-height:18px;color:${ph ? 'var(--muted)' : INK}">${val}</span>${hint ? `<span style="font-size:11px;color:var(--muted)">${hint}</span>` : ''}</label>`;
const sect = (t, inner) => `<div style="display:flex;flex-direction:column;gap:10px"><span style="font-size:13px;font-weight:600">${t}</span>${inner}</div>`;
const wide = (inner) => `<div style="display:flex;flex-direction:column;gap:6px;width:100%">${inner}</div>`;
const seg = (opts, on) => `<div style="display:grid;grid-template-columns:repeat(${opts.length},1fr);gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px">${opts.map((o, i) => `<span style="height:30px;display:flex;align-items:center;justify-content:center;border-radius:6px;font-size:12px;${i === on ? `background:var(--sel);color:${INK};font-weight:600` : 'color:var(--muted)'}">${o}</span>`).join('')}</div>`;

// 1 ---------------------------------------------------------------- new contact
export const dlgNewContact = () =>
  frame({
    bg: 'contacts.png',
    title: 'Нов контакт',
    body: `
${wide(`<span style="font-size:12px;font-weight:500">Тип</span>${seg(['Лице', 'Организация'], 0)}`)}
${row(field('Име', 'Иван', { req: true, focus: true }), field('Фамилия', 'Петров'))}
${field('Компания (по избор)', 'Търсене на компания', { ph: true, select: true })}
<div style="display:flex;flex-direction:column;gap:8px">
  <div style="display:flex;align-items:center"><span style="flex:1;font-size:12px;font-weight:500">Методи за връзка</span>${btn('Добави', { ic: 'plus', size: 'sm' })}</div>
  <div style="display:flex;align-items:center;gap:8px">${field('', 'Телефон', { w: '120px', select: true })}${field('', '+359 888 123 456')}${tag('Основен', 'var(--sel)', INK)}${iconBtn('x', 'Премахни')}</div>
  <div style="display:flex;align-items:center;gap:8px">${field('', 'Имейл', { w: '120px', select: true })}${field('', 'ivan.petrov@example.com')}<span style="width:56px;font-size:11px;color:var(--muted);text-align:center">Основен</span>${iconBtn('x', 'Премахни')}</div>
</div>
${area('Бележки (по избор)', 'Добавете начални бележки...', { ph: true })}`,
    footer: cancel() + ok('Създай контакт'),
  });

// 2 ---------------------------------------------------------------- new inquiry
export const dlgNewInquiry = () =>
  frame({
    bg: 'inquiries.png',
    h: 860,
    title: 'Ново запитване',
    body: `
${row(field('Източник', 'imot.bg', { select: true, req: true }), field('Възложено на', 'Димитър А.', { select: true }))}
${field('Име на обаждащия се', 'Иван Петров', { focus: true })}
${row(field('Телефон', '+359 888 123 456'), field('Имейл', 'name@example.com', { ph: true }))}
${field('Тема', 'Търси 3-стаен в Лозенец')}
${area('Описание (по избор)', 'Бюджет до 180 000 €, иска да види този уикенд.', { h: 64 })}
${field('Външен реф. (по избор)', 'ID в портал или номер', { ph: true })}`,
    footer: cancel() + ok('Въведи запитване'),
  });

// 3 ---------------------------------------------------------------- convert inquiry
export const dlgConvertInquiry = () =>
  frame({
    bg: 'inquiries.png',
    h: 900,
    title: 'Преобразуване в сделка',
    sub: 'Запитване от Иван Петров · imot.bg · преди 12 мин',
    body: `
${sect('Контакт', `${seg(['Нов контакт', 'Свързване'], 0)}
${wide(`<span style="font-size:12px;font-weight:500">Тип контакт</span>${seg(['Лице', 'Организация'], 0)}`)}
${row(field('Име', 'Иван'), field('Фамилия', 'Петров'))}`)}
<div style="height:1px;background:var(--line)"></div>
${sect('Сделка', `${field('Заглавие', 'Иван – Купувач – 3-стаен Лозенец')}
${row(field('Тип', 'Купува', { select: true }), field('Етап', 'Нов лийд', { select: true }))}
${field('Възложено на', 'Димитър А.', { select: true })}`)}`,
    footer: cancel() + ok('Преобразувай'),
  });

// 4 ---------------------------------------------------------------- task complete
export const dlgTaskComplete = () =>
  frame({
    bg: 'today.png',
    h: 900,
    title: 'Приключване на задача',
    sub: 'Запишете какво се случи с „Обаждане на Иван Петров“',
    body: `
${area('Какво се случи?', 'Говорих с клиента, интересуват се от оглед другата седмица. Иска да види и втори имот.', { h: 84 }).replace('Какво се случи?', 'Какво се случи? <span style="color:var(--danger)">*</span>')}
<div style="display:flex;flex-direction:column;gap:12px;padding:14px;${tint()}">
  <div style="display:flex;align-items:center;gap:10px">${toggle(true)}<span style="font-size:13px;font-weight:600">Планирай следващо действие</span></div>
  ${field('Заглавие на задача', 'Оглед на Лозенец, ул. Златовръх')}
  ${row(field('Тип', 'Оглед', { select: true }), field('Краен срок', '28.11.2026, 11:00'))}
  ${row(field('Имот', 'Имот 1042 · Козяк', { select: true }), field('Възложи на', 'Димитър А.', { select: true }))}
</div>
<div style="display:flex;align-items:center;gap:10px">${toggle(false)}<span style="font-size:13px">Смени етап</span></div>`,
    footer: cancel() + ok('Приключи задачата', 'check'),
  });

// 5 ---------------------------------------------------------------- close deal
export const dlgCloseDeal = () =>
  frame({
    bg: 'deal.png',
    w: 440,
    title: 'Затваряне на сделка',
    sub: 'Иван Петров · 3-стаен, Лозенец',
    body: `
${field('Резултат', 'Загубена (Затворена)', { select: true, req: true })}
${field('Причина за загуба', 'Купи през друга агенция', { focus: true })}`,
    footer: cancel() + ok("Затвори сделката"),
  });

// 6 ---------------------------------------------------------------- invite
export const dlgInvite = () =>
  frame({
    bg: 'settings-team.png',
    w: 440,
    title: 'Покани член в екипа',
    sub: 'Изпратете имейл покана за присъединяване към агенцията.',
    body: `
${field('Имейл адрес', 'maria.koleva@example.com', { focus: true })}
${field('Роля', 'Брокер', { select: true })}`,
    footer: cancel() + ok('Изпрати покана', 'send'),
  });

// 7 ---------------------------------------------------------------- merge contact
export const dlgMerge = () =>
  frame({
    bg: 'contact-detail.png',
    title: 'Сливане на контакт',
    sub: 'Слейте <b>Мария Колева</b> в друг контакт. Този контакт ще бъде архивиран.',
    body: `
<div style="display:flex;align-items:center;gap:12px;padding:12px;${tint()}">${thumb('person', 40, 36)}<div style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600">Мария Колева (дубликат)</span><span style="font-size:11px;color:var(--muted)">+359 88 412 3307 · Купувач</span></div>${icon('arrowR', 16)}<div style="flex:1;display:flex;flex-direction:column;gap:2px;text-align:right"><span style="font-size:13px;font-weight:600">Мария Колева-Иванова</span><span style="font-size:11px;color:var(--muted)">+359 888 123 456 · Купувач</span></div></div>
<div style="display:flex;flex-direction:column;gap:2px">
  <span style="font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);padding-bottom:6px">Преглед на сливането</span>
  ${[['file', 'Ще бъдат прехвърлени 2 сделки'], ['msg', 'Ще бъдат прехвърлени 3 запитвания'], ['check', 'Ще бъдат прехвърлени 5 задачи'], ['file', 'Ще бъдат прехвърлени 4 бележки'], ['phone', 'Ще бъдат прехвърлени 2 метода за връзка']].map(([i, t]) => `<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--line);font-size:13px">${icon(i, 15)}<span>${t}</span></div>`).join('')}
</div>`,
    footer: btn('Назад', { ic: 'chevL' }) + btn('Слей в Мария Колева-Иванова', { kind: 'primary', offset: true, ic: 'merge' }),
  });

// 8 ---------------------------------------------------------------- viewing
export const dlgViewing = () =>
  frame({
    bg: 'property-detail.png',
    w: 440,
    title: 'Насрочи оглед',
    sub: 'Имот 1042 · Козяк · 95 м²',
    body: `
${field('Сделка', 'Иван Петров · 3-стаен, Лозенец', { select: true, req: true })}
${field('Заглавие', 'Оглед 1042')}
${row(field('Дата и час', '28.11.2026, 11:00', { focus: true }), field('Възложена на', 'Димитър А.', { select: true }))}`,
    footer: cancel() + ok('Насрочи', 'calendar'),
  });

// 9 ---------------------------------------------------------------- save list
export const dlgSaveList = () =>
  frame({
    bg: 'deals.png',
    w: 440,
    title: 'Запази тези филтри като списък',
    body: `
${field('Име', 'Топли купувачи в Лозенец', { focus: true })}
<div style="display:flex;flex-wrap:wrap;gap:6px">${['Купувач', 'Горещ', 'Лозенец'].map((t) => `<span style="display:inline-flex;padding:3px 8px;border-radius:6px;background:var(--next-bg);border:1px solid var(--line);font-size:11px;font-weight:500">${t}</span>`).join('')}</div>
<p style="margin:0;font-size:11px;color:var(--muted)">Само вие виждате този списък. Броят му се обновява в Списъци.</p>`,
    footer: cancel() + ok('Запази'),
  });

// 10 --------------------------------------------------------------- duplicates
export const dlgDuplicates = () =>
  frame({
    bg: 'contacts.png',
    title: 'Възможни дубликати',
    sub: 'Намерихме 2 съществуващи контакта, които може да са същото лице или организация.',
    body: [['Иван Петров', 'Съвпадащ телефон', '+359 888 123 456', 'ДА', 'Купувач'], ['Иван Петров-Георгиев', 'Сходно име', '+359 877 555 019', 'МС', 'Собственик']]
      .map(([n, m, p, , r], i) => `<div style="display:flex;align-items:center;gap:12px;padding:12px;${tint(!i)}">${thumb('person', 40, 36)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:600">${n}</span><span style="font-size:11px;color:var(--muted)">${p} · ${r}</span>${pill(m, i ? 'var(--warn-bg)' : 'var(--ok-bg)', i ? 'var(--warn-ink)' : 'var(--ok-ink)', { size: 10 })}</div><div style="display:flex;flex-direction:column;gap:6px">${btn('Използвай този контакт', { size: 'sm', kind: i ? 'secondary' : 'primary' })}<a style="font-size:11px;color:var(--pri);text-align:center">Преглед на профил</a></div></div>`)
      .join(''),
    footer: cancel() + btn('Нито едно – Създай въпреки това', { kind: 'secondary' }),
  });

// 11 --------------------------------------------------------------- delete list (confirm)
const confirmBody = (ic, bg, fg, t) => `<div style="display:flex;gap:14px;align-items:flex-start"><span style="width:40px;height:40px;flex-shrink:0;border-radius:999px;background:${bg};color:${fg};display:flex;align-items:center;justify-content:center">${icon(ic, 20)}</span><p style="margin:0;padding-top:2px;font-size:13px;line-height:19px;color:var(--muted)">${t}</p></div>`;
export const dlgDeleteList = () =>
  frame({
    bg: 'lists.png',
    w: 420,
    title: 'Да се изтрие ли „Горещи купувачи без оглед“?',
    body: confirmBody('trash', 'var(--danger-bg)', 'var(--danger)', 'Изтрива се само списъкът; сделките и запитванията в него остават.'),
    footer: cancel() + btn('Изтрий', { kind: 'destructive' }),
  });

// 12 --------------------------------------------------------------- close listing (confirm)
export const dlgCloseListing = () =>
  frame({
    bg: 'property-detail.png',
    w: 420,
    title: 'Приключване на обявата?',
    body: confirmBody('alert', 'var(--warn-bg)', 'var(--warn-ink)', 'Приключена обява не може да се променя. За нова цена или отново в продажба пуснете нова обява.'),
    footer: cancel() + ok('Приключи'),
  });

// 13 --------------------------------------------------------------- requirements
const chipSel = (items, on) => `<div style="display:flex;flex-wrap:wrap;gap:6px">${items.map((t, i) => `<span style="height:30px;padding:0 12px;display:inline-flex;align-items:center;border-radius:6px;font-size:12px;border:1px solid ${on.includes(i) ? 'var(--pri)' : 'var(--line)'};background:${on.includes(i) ? 'var(--sel)' : '#fff'};font-weight:${on.includes(i) ? 600 : 400}">${t}</span>`).join('')}</div>`;
export const dlgRequirements = () =>
  frame({
    bg: 'deal.png',
    w: 640,
    h: 1000,
    title: 'Изисквания на клиента',
    sub: 'Какво търси клиентът. Задължителните критерии ще филтрират имотите при търсене.',
    body: `
${sect('Бюджет', row(field('Цена от, €', '120 000'), field('Цена до, €', '180 000', { focus: true })))}
${sect('Къде', field('Квартали', 'Лозенец, Хладилника, Кръстова вада', { select: true }))}
${sect('Какво', `<span style="font-size:12px;font-weight:500">Вид имот</span>${chipSel(['Апартамент', 'Къща', 'Парцел', 'Офис'], [0])}
<span style="font-size:12px;font-weight:500">Стаи</span>${chipSel(['1', '2', '3', '4+'], [1, 2])}
${row(field('Площ от, м²', '70'), field('Площ до, м²', '110'), field('Етаж', 'Не последен', { select: true }))}`)}
${sect('Допълнително', `${field('Финансиране', 'Ипотечен кредит', { select: true })}
<div style="display:flex;align-items:center;gap:10px">${toggle(true)}<span style="font-size:13px">Етаж: задължително</span></div>
${field('Други желания', 'паркомясто, акт 16, изложение юг', { ph: false })}`)}`,
    footer: cancel() + ok('Запази'),
    top: 24,
  });

// 14 --------------------------------------------------------------- add party
export const dlgAddParty = () =>
  frame({
    bg: 'property-detail.png',
    w: 440,
    title: 'Добави страна',
    body: `
${field('Роля', 'Собственик', { select: true, req: true })}
${seg(['Съществуващ контакт', 'Нов контакт'], 0)}
${field('Контакт', 'Георги Николов · +359 877 …', { select: true })}`,
    footer: cancel() + ok('Добави'),
  });
