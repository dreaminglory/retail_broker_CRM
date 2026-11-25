import { INK, icon, art, thumb, btn, iconBtn, pill, tag, role, temp, status, avatar, agent, card, cardHead, label, tabs, search, chip, filterBar, th, tr, two, page, pageTitle, field, segmented, toggle, settingsPage, saveBar, bare } from './lib.mjs';

const fchip = (t) => `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:6px;background:var(--next-bg);border:1px solid var(--line);font-size:11px;font-weight:500;white-space:nowrap">${t}</span>`;

// ---------------------------------------------------------------- lists index
export const lists = () => {
  const L = [
    ['Горещи купувачи без оглед', ['Купувач', 'Горещ', 'без оглед 14 дни'], 12, 'контакта', 5, 'ДА', 'person', 'днес'],
    ['Собственици без контакт', ['Собственик', 'последен контакт > 30 дни'], 18, 'контакта', 0, 'ДА', 'person', '19 ное'],
    ['Сделки без следваща стъпка', ['Активна', 'без следващо действие'], 4, 'сделки', 0, 'МС', 'deal', 'вчера', true],
    ['Купувачи до € 200 000 · Младост', ['Купувач', 'до € 200 000', 'Младост 1–4'], 34, 'контакта', 21, 'ДА', 'person', '17 ное'],
    ['Нови запитвания тази седмица', ['Запитване', 'от понеделник'], 9, 'запитвания', 9, 'ЕГ', 'deal', 'днес'],
    ['Имоти с остаряла обява', ['Активен', 'портал ≠ CRM'], 9, 'имота', 2, 'ДА', 'block', '18 ное'],
  ];
  return page({
    active: 'Списъци',
    crumbs: ['Работа', 'Списъци'],
    minH: 1000,
    body: `
${pageTitle('Списъци', 'Запазени филтри, които обработваш един по един. Броят се обновява сам.', btn('Нов списък', { kind: 'primary', offset: true, ic: 'plus' }))}
<div style="display:flex;align-items:flex-end;gap:12px;border-bottom:1px solid var(--line)"><div style="flex:1">${tabs([['Мои', '4'], ['На агенцията', '6'], ['Архив', '3']], 1, '0', false)}</div><div style="padding-bottom:8px">${search('Търси списък', '0 0 240px')}</div></div>
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px">
${L.map(([n, f, c, u, done, a, k, w, alert]) => card(`
  <div style="padding:18px;display:flex;flex-direction:column;gap:14px;height:100%;box-sizing:border-box">
    <div style="display:flex;gap:12px;align-items:flex-start">${thumb(k, 38, 34)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px"><span style="font-size:14px;font-weight:600;line-height:18px">${n}</span><span style="font-size:11px;color:var(--muted)">обновен ${w}</span></div>${iconBtn('more', 'Още', 28)}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px">${f.map(fchip).join('')}</div>
    <div style="display:flex;align-items:baseline;gap:6px"><span style="font-size:30px;font-weight:700;letter-spacing:-0.02em;color:${alert ? '#c2362b' : INK}">${c}</span><span style="font-size:12px;color:var(--muted)">${u}</span></div>
    <div style="display:flex;flex-direction:column;gap:6px"><span style="height:6px;border-radius:999px;background:#eef3f8;overflow:hidden"><span style="display:block;height:100%;width:${(done / c) * 100}%;background:${done === c ? '#2e9e5b' : 'var(--pri)'}"></span></span><span style="font-size:11px;color:var(--muted)">${done === c ? 'всички обработени днес' : done ? `${done} от ${c} обработени днес` : 'не е започнат днес'}</span></div>
    <div style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:12px;margin-top:auto">${agent(a)}<span style="flex:1;font-size:11px;color:var(--muted)">${{ ДА: 'Димитър А.', МС: 'Мартин С.', ЕГ: 'Елица Г.' }[a]}</span>${btn(done && done < c ? 'Продължи' : 'Започни', { ic: 'play', size: 'sm', kind: 'secondary' })}</div>
  </div>`)).join('')}
</div>
<button style="display:flex;align-items:center;justify-content:center;gap:8px;height:56px;border:1px dashed #7d8897;border-radius:8px;background:var(--surf);font-size:13px;font-weight:500;color:${INK}">${icon('filter', 14)}Запази текущ филтър от Контакти, Сделки или Имоти като списък</button>`,
  });
};

// ---------------------------------------------------------------- list detail (work through)
export const listDetail = () => {
  const Q = [
    ['ЕД', 'Елена Димитрова', '2-стаен, Изток · до € 190 000', 'done', 'Обаждане · отговори'],
    ['ИП', 'Иван Петров', '3-стаен, Лозенец · до € 240 000', 'done', 'Изпратен Имот 1042'],
    ['РП', 'Радослав П.', '3-стаен, Лозенец · до € 230 000', 'done', 'Не отговори · опит утре'],
    ['СР', 'Силвия Р.', 'къща, Бояна · до € 450 000', 'done', 'Насрочен оглед'],
    ['НТ', 'Николай Т.', '3-стаен с гараж · до € 260 000', 'done', 'Пропуснат'],
    ['КВ', 'Калина В.', 'къща, Драгалевци · до € 380 000', 'cur'],
    ['ДМ', 'Десислава М.', '2-стаен, Младост · до € 150 000', 'next'],
    ['АК', 'Ангел К.', '1-стаен, Център · до € 120 000', 'next'],
    ['ПС', 'Петя С.', '3-стаен, Лагера · до € 210 000', 'next'],
    ['ВГ', 'Васил Г.', 'мезонет, Овча купел · до € 280 000', 'next'],
  ];
  return page({
    active: 'Списъци',
    crumbs: ['Работа', 'Списъци', 'Горещи купувачи без оглед'],
    minH: 1100,
    body: `
<div style="display:flex;flex-wrap:wrap;align-items:flex-end;gap:12px">
  <div style="flex:1;display:flex;flex-direction:column;gap:8px">
    <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.02em">Горещи купувачи без оглед</h1>
    <div style="display:flex;gap:4px;align-items:center">${['Купувач', 'Горещ', 'без оглед 14 дни', 'отговорник: аз'].map(fchip).join('')}<a style="font-size:11px;font-weight:600;margin-left:6px">Промени филтъра</a></div>
  </div>
  <div style="flex:0 0 280px;display:flex;flex-direction:column;gap:6px"><span style="display:flex;font-size:12px"><span style="flex:1;color:var(--muted)">Обработени днес</span><strong>5 от 12</strong></span><span style="height:8px;border-radius:999px;background:#eef3f8;overflow:hidden"><span style="display:block;height:100%;width:41.6%;background:var(--pri)"></span></span></div>
</div>
<div style="display:flex;gap:20px;align-items:flex-start">
  ${card(`
    ${cardHead('Опашка', `<span style="font-size:11px;color:var(--muted)">по температура</span>`, '12')}
    ${Q.map(([ini, n, s, st, out], i) => `<div style="display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid var(--line);${st === 'cur' ? 'background:var(--sel);box-shadow:inset 3px 0 0 0 #2b63c6' : ''}">
      ${st === 'done' ? `<span style="width:30px;height:30px;flex-shrink:0;border-radius:999px;background:#e3f1e8;color:#28703f;display:flex;align-items:center;justify-content:center">${icon('check', 14, 3)}</span>` : avatar(ini, i, 30)}
      <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;${st === 'done' ? 'opacity:.6' : ''}"><span style="font-size:12px;font-weight:600">${n}</span><span style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${st === 'done' ? out : s}</span></span>
      ${st === 'cur' ? `<span style="font-size:10px;font-weight:600;color:var(--pri)">СЕГА</span>` : ''}
    </div>`).join('')}
    <div style="padding:10px 18px;font-size:11px;color:var(--muted)">+ още 2</div>
  `, 'flex:0 0 330px')}
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:16px">
    ${card(`
      <div style="padding:22px;display:flex;flex-direction:column;gap:18px">
        <div style="display:flex;align-items:center;gap:16px">${art.personRound(64)}
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><div style="display:flex;gap:6px">${role('Купувач')}${temp('Горещ')}</div><span style="font-size:20px;font-weight:700;letter-spacing:-0.01em">Калина В.</span><span style="font-size:12px;color:var(--muted)">Клиент от 17 ное · Homes.bg · последен контакт преди 8 дни</span></div>
          <span style="font-size:12px;color:var(--muted)">6 от 12</span>
        </div>
        <div style="display:flex;gap:18px;font-size:13px"><span style="display:flex;gap:8px;align-items:center">${icon('phone')}+359 89 117 4402</span><span style="display:flex;gap:8px;align-items:center">${icon('mail')}kalina.v@example.bg</span></div>
        <div style="display:flex;gap:8px">${btn('Обади се', { kind: 'primary', ic: 'phone' })}${btn('Viber', { ic: 'chat' })}${btn('WhatsApp', { ic: 'chat' })}${btn('Имейл', { ic: 'mail' })}${iconBtn('external', 'Отвори контакта', 36)}</div>
      </div>
      <div style="padding:16px 22px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px">${label('Търси')}
        <div style="display:flex;flex-wrap:wrap;gap:6px">${[['Тип', 'къща'], ['Бюджет', 'до € 380 000'], ['Квартали', 'Драгалевци, Бояна'], ['Двор', 'над 300 м²']].map(([k, v]) => `<span style="display:inline-flex;flex-direction:column;gap:1px;padding:6px 10px;border-radius:6px;background:var(--next-bg);border:1px solid var(--line)"><span style="font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.06em">${k}</span><span style="font-size:12px;font-weight:600">${v}</span></span>`).join('')}</div>
      </div>
      <div style="padding:16px 22px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:10px">${label('Последна бележка')}
        <div style="display:flex;gap:10px;font-size:12px;line-height:18px"><span style="width:8px;height:8px;margin-top:5px;flex-shrink:0;border-radius:999px;background:#7fbef0;border:1.5px solid #0e1a2b"></span><span style="flex:1">„Иска двор и тихо място, но бюджетът е под цените в Бояна. Да ѝ пратя Имот 1131 при намаление.“</span><span style="font-size:10px;color:var(--muted)">17 ное</span></div>
      </div>
      <div style="padding:14px 22px;border-top:1px solid var(--line);display:flex;align-items:center;gap:12px">
        ${thumb('house', 34, 30)}<span style="flex:1">${two('Имот 1131 · Бояна', 'къща 210 м² · € 465 000 · над бюджета')}</span><span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:var(--sel)">62% съвпадение</span>
      </div>
    `)}
    <div style="display:flex;align-items:center;gap:10px">${btn('Предишен', { ic: 'chevL', kind: 'ghost' })}<span style="flex:1"></span>${btn('Пропусни', { ic: 'skip' })}${btn('Готово · следващ', { kind: 'primary', offset: true, ic: 'check' })}</div>
  </div>
</div>`,
  });
};

// ---------------------------------------------------------------- settings: team
export const settingsTeam = () => {
  const cols = [['Потребител', 'minmax(0,2fr)'], ['Роля', '150px'], ['Статус', '150px'], ['Последно влизане', '120px'], ['', '32px']];
  const R = [
    ['АИ', 'Анна Илиева', 'anna@alpha.bg', 'Собственик', ['Активен', 'green'], 'днес 08:12', true],
    ['МС', 'Мартин Стоянов', 'martin@alpha.bg', 'Мениджър', ['Активен', 'green'], 'днес 09:40'],
    ['ДА', 'Димитър А. <span style="font-weight:400;color:var(--muted)">(ти)</span>', 'dimitar@alpha.bg', 'Брокер', ['Активен', 'green'], 'сега'],
    ['ЕГ', 'Елица Георгиева', 'elica@alpha.bg', 'Брокер', ['Активен', 'green'], 'вчера'],
    ['НД', 'Невена Динева', 'nevena@alpha.bg', 'Брокер', ['Активен', 'green'], '21 ное'],
    ['ПЖ', 'Петър Жеков', 'petar@alpha.bg', 'Брокер', ['Поканен', 'amber'], '—', false, true],
    ['РТ', 'Ралица Тодорова', 'ralica@alpha.bg', 'Брокер', ['Деактивиран', 'grey'], '2 окт', false, false, true],
  ];
  return settingsPage({
    active: 'Потребители и роли',
    title: 'Потребители и роли',
    sub: '6 от 10 места · собственикът и мениджърите виждат всички сделки, брокерите — своите.',
    actions: btn('Покани колега', { kind: 'primary', offset: true, ic: 'plus' }),
    minH: 1000,
    content: `
${card(`
  ${filterBar(`${search('Име или имейл')}${chip('Роля')}${chip('Статус')}`)}
  ${th(cols)}
  ${R.map(([ini, n, e, r, st, last, owner, invited, off], i) => tr(cols, [
    `<span style="display:flex;align-items:center;gap:12px;${off ? 'opacity:.5' : ''}">${avatar(ini, i, 34)}${two(n, e)}</span>`,
    owner ? `<span style="display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600">${icon('key', 12)}${r}</span>` : `<button style="display:flex;align-items:center;gap:6px;height:30px;padding:0 10px;border:1px solid var(--line);border-radius:6px;background:var(--surf);font-size:12px;${off ? 'opacity:.5' : ''}">${r}${icon('chevD', 12, 2.5)}</button>`,
    `<span style="display:flex;flex-direction:column;gap:3px;align-items:flex-start">${status(st[0], st[1])}${invited ? '<a style="font-size:11px;font-weight:600">Изпрати пак</a>' : ''}</span>`,
    `<span style="font-size:12px;color:var(--muted)">${invited ? 'поканен преди 2 дни' : last}</span>`,
    owner ? '' : iconBtn('more', 'Още', 30),
  ])).join('')}
`)}
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">
${[['Собственик', 'Всичко, включително абонамент и изтриване на агенцията.'], ['Мениджър', 'Всички сделки и контакти, етапи, източници, сливане и отчети.'], ['Брокер', 'Своите сделки и контакти, общата база и Днес.']].map(([r, d]) => `<div style="padding:14px 16px;border-radius:8px;background:var(--next-bg);border:1px solid var(--line);display:flex;flex-direction:column;gap:4px"><span style="font-size:13px;font-weight:600">${r}</span><span style="font-size:11px;line-height:16px;color:var(--muted)">${d}</span></div>`).join('')}
</div>`,
  });
};

// ---------------------------------------------------------------- settings: stages
export const settingsStages = () => {
  const S = [['Запитване', 3, 9, 'Първи контакт и изясняване на нуждата'], ['Огледи', 14, 14, 'Предлагане на имоти и огледи'], ['Оферта', 7, 7, 'Преговори по цена и условия'], ['Капаро', 30, 5, 'Капаро платено, до предварителен договор']];
  return settingsPage({
    active: 'Етапи на сделките',
    title: 'Етапи на сделките',
    sub: 'Пътят на всяка сделка. Плъзни ред, за да смениш поредността.',
    minH: 1060,
    content: `
${card(`
  <div style="display:grid;grid-template-columns:24px 28px minmax(0,1fr) 130px 120px 70px;gap:14px;align-items:center;padding:10px 20px;border-bottom:1px solid var(--line);font-size:10px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:var(--muted)"><span></span><span></span><span>Етап</span><span>Макс. дни</span><span>Активни сделки</span><span></span></div>
  ${S.map(([n, d, c, s], i) => `<div style="display:grid;grid-template-columns:24px 28px minmax(0,1fr) 130px 120px 70px;gap:14px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line);${i === 1 ? 'background:var(--hl)' : ''}">
    <span style="color:#7d8897;cursor:grab">${icon('grip', 16)}</span>
    <span style="width:26px;height:26px;border-radius:999px;border:2px solid var(--pri);box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700">${i + 1}</span>
    <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600">${n}</span><span style="font-size:11px;color:var(--muted)">${s}</span></span>
    <span style="display:flex;align-items:center;gap:6px"><span style="width:58px;height:32px;box-sizing:border-box;border:1px solid #7d8897;border-radius:6px;display:flex;align-items:center;justify-content:flex-end;padding:0 8px;font-size:13px">${d}</span><span style="font-size:11px;color:var(--muted)">дни</span></span>
    <span style="font-size:13px;font-weight:600">${c}</span>
    <span style="display:flex;gap:4px">${iconBtn('edit', 'Редактирай', 28)}${iconBtn('trash', 'Изтрий', 28)}</span>
  </div>`).join('')}
  <div style="display:grid;grid-template-columns:24px 28px minmax(0,1fr) 130px 120px 70px;gap:14px;align-items:center;padding:12px 20px;border-bottom:1px solid var(--line);background:#f8fafc">
    <span style="color:#c4cbd4">${icon('lock', 14)}</span>
    <span style="width:26px;height:26px;border-radius:999px;background:#2e9e5b;color:#fff;display:flex;align-items:center;justify-content:center">${icon('check', 13, 3)}</span>
    <span style="display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600">Сделка</span><span style="font-size:11px;color:var(--muted)">Финален етап · затваря сделката като спечелена</span></span>
    <span style="font-size:11px;color:var(--muted)">—</span><span style="font-size:13px;font-weight:600">3 <span style="font-weight:400;color:var(--muted);font-size:11px">този месец</span></span><span></span>
  </div>
  <div style="padding:14px 20px">${btn('Нов етап', { kind: 'dashed', ic: 'plus', size: 'sm' })}</div>
`)}
${card(`
  ${cardHead('Причини за загуба', btn('Причина', { ic: 'plus', size: 'sm' }))}
  <div style="padding:16px 20px;display:flex;flex-direction:column;gap:12px"><span style="font-size:12px;color:var(--muted)">Брокерът избира една при затваряне на сделка като загубена. Използват се в отчетите.</span>
  <div style="display:flex;flex-wrap:wrap;gap:8px">${[['Цена', 21], ['Избра друг имот', 14], ['Друга агенция', 11], ['Отказа се', 9], ['Без отговор', 6], ['Кредит отказан', 3]].map(([r, c]) => `<span style="display:inline-flex;align-items:center;gap:8px;height:30px;padding:0 6px 0 12px;border:1px solid var(--line);border-radius:999px;font-size:12px">${r}<span style="font-size:10px;color:var(--muted)">${c}</span><span style="color:var(--muted);display:flex">${icon('x', 12)}</span></span>`).join('')}</div></div>
`)}`,
    footer: saveBar(),
  });
};

// ---------------------------------------------------------------- settings: lead sources
export const settingsLeadSources = () => {
  const cols = [['Източник', 'minmax(0,2fr)'], ['Вид', '130px'], ['Запитвания · 30 дни', '200px'], ['Активен', '70px'], ['', '32px']];
  const R = [['Imot.bg', 'Портал', 48], ['Homes.bg', 'Портал', 31], ['Сайт на агенцията', 'Сайт', 17], ['Телефон', 'Директно', 12], ['Препоръка', 'Препоръка', 9], ['Facebook', 'Соц. мрежа', 6], ['Alo.bg', 'Портал', 0, true]];
  return settingsPage({
    active: 'Източници на запитвания',
    title: 'Източници на запитвания',
    sub: 'Откъде идват клиентите. Изключен източник не се предлага в нови запитвания, но остава в историята.',
    actions: btn('Нов източник', { kind: 'primary', offset: true, ic: 'plus' }),
    minH: 900,
    content: card(`
  ${th(cols)}
  ${R.map(([n, k, c, off]) => tr(cols, [
    `<span style="display:flex;align-items:center;gap:12px;${off ? 'opacity:.5' : ''}"><span style="width:32px;height:32px;border-radius:8px;background:var(--next-bg);border:1px solid var(--line);display:flex;align-items:center;justify-content:center;color:var(--pri)">${icon(k === 'Портал' ? 'globe' : k === 'Директно' ? 'phone' : k === 'Препоръка' ? 'users' : 'link', 15)}</span><span style="font-size:13px;font-weight:600">${n}</span></span>`,
    tag(k, '#eef3f8', '#5a6676'),
    `<span style="display:flex;align-items:center;gap:10px"><span style="flex:1;height:6px;border-radius:999px;background:#eef3f8;overflow:hidden"><span style="display:block;height:100%;width:${(c / 48) * 100}%;background:var(--pri)"></span></span><span style="width:24px;text-align:right;font-size:13px;font-weight:600">${c}</span></span>`,
    toggle(!off),
    iconBtn('edit', 'Редактирай', 30),
  ])).join('')}
  <div style="padding:12px 20px;font-size:11px;color:var(--muted)">Общо 123 запитвания за последните 30 дни</div>
`),
  });
};

// ---------------------------------------------------------------- settings: areas
export const settingsAreas = () => {
  const sofia = [['Лозенец', 14], ['Витоша', 9], ['Козяк', 6], ['Изток', 7], ['Младост 1', 11], ['Младост 2', 5], ['Младост 4', 8], ['Студентски град', 4], ['Стрелбище', 6], ['Хладилника', 3], ['Яворов', 4], ['Бояна', 5], ['Драгалевци', 3], ['Център', 12], ['Оборище', 4], ['Манастирски ливади', 7], ['Златен рог', 2], ['Лагера', 3], ['Овча купел', 2], ['Хиподрума', 1], ['Люлин 5', 0]];
  const plovdiv = [['Център', 3], ['Каменица 1', 2], ['Тракия', 4], ['Кършияка', 1], ['Смирненски', 2]];
  const c = ([n, k], edit) => edit
    ? `<span style="display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 6px 0 10px;border:1px solid var(--pri);box-shadow:0 0 0 3px #dceefc;border-radius:6px;font-size:12px;background:#fff">${n}<span style="width:1px;height:16px;background:var(--line)"></span><span style="color:#28703f;display:flex">${icon('check', 14, 2.5)}</span><span style="color:var(--muted);display:flex">${icon('x', 14)}</span></span>`
    : `<span style="display:inline-flex;align-items:center;gap:8px;height:32px;padding:0 10px;border:1px solid var(--line);border-radius:6px;font-size:12px;${k === 0 ? 'color:var(--muted)' : ''}">${n}<span style="font-size:10px;color:var(--muted);font-weight:600">${k}</span></span>`;
  const city = (n, list, count, editIdx = -1) => card(`
    ${cardHead(n, `${search('Търси квартал', '0 0 200px')}${btn('Квартал', { ic: 'plus', size: 'sm' })}`, count)}
    <div style="padding:16px 20px;display:flex;flex-wrap:wrap;gap:8px">${list.map((a, i) => c(a, i === editIdx)).join('')}</div>`);
  return settingsPage({
    active: 'Квартали',
    title: 'Квартали',
    sub: 'Използват се в имотите, изискванията на купувачите и съвпаденията. Числото е броят активни имоти.',
    actions: btn('Нов град', { ic: 'plus' }),
    minH: 960,
    content: `${city('София', sofia, '21', 15)}${city('Пловдив', plovdiv, '5')}
<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:6px;background:var(--next-bg);border:1px solid var(--next-line);font-size:12px">${icon('info', 14)}Квартал с имоти или изисквания не може да се изтрие — само да се преименува или слее с друг.</div>`,
  });
};

// ---------------------------------------------------------------- settings: import history
export const settingsImport = () => {
  const cols = [['Файл', 'minmax(0,1.3fr)'], ['Тип', '84px'], ['Резултат', 'minmax(0,1.7fr)'], ['Кога', '72px'], ['Статус', '84px'], ['', '84px']];
  const R = [
    ['alpha-kontakti-2026.csv', 'Контакти', '1 284 нови · 37 дубликата · 4 грешки', 'днес 09:02', ['Готов', 'green'], 'ДА'],
    ['imoti-oktomvri.csv', 'Имоти', '94 създадени · 2 пропуснати', '18 ное', ['Готов', 'green'], 'ДА'],
    ['zapitvania-imotbg.csv', 'Запитвания', '212 създадени', '12 ное', ['Готов', 'green'], 'МС'],
    ['stari-kontakti.csv', 'Контакти', '318 реда върнати', '9 ное', ['Отменен', 'grey'], 'МС', true],
    ['kontakti-test.csv', 'Контакти', 'Няма колона за телефон или имейл', '9 ное', ['Неуспешен', 'red'], 'ДА', true],
  ];
  const kinds = [['users', 'Контакти', 'Лица и фирми, с телефони и имейли'], ['building', 'Имоти', 'Със собственик и цена'], ['msg', 'Запитвания', 'От портал или стара таблица']];
  return settingsPage({
    active: 'Импорт',
    title: 'Импорт',
    sub: 'CSV от стария CRM, Excel или портал. Всеки импорт може да се отмени до 30 дни.',
    minH: 940,
    content: `
<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${kinds.map(([ic, t, s], i) => `<button style="display:flex;align-items:center;gap:12px;padding:16px;border:1px solid ${i === 0 ? 'var(--pri)' : 'var(--line)'};border-radius:8px;background:${i === 0 ? 'var(--next-bg)' : 'var(--surf)'};text-align:left;cursor:pointer"><span style="width:38px;height:38px;flex-shrink:0;border-radius:8px;border:1.5px solid #0e1a2b;box-sizing:border-box;background:${['#dceefc', '#fff3c4', '#e3f1e8'][i]};display:flex;align-items:center;justify-content:center;color:${INK}">${icon(ic, 18)}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:600;color:${INK}">${t}</span><span style="font-size:11px;color:var(--muted)">${s}</span></span><span style="color:var(--pri)">${icon('arrowR', 16)}</span></button>`).join('')}</div>
${card(`
  ${cardHead('История', '', '5')}
  ${th(cols)}
  ${R.map(([f, t, r, w, st, a, dim]) => tr(cols, [
    `<span style="display:flex;align-items:center;gap:10px"><span style="color:var(--muted)">${icon('file', 16)}</span><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f}</span><span style="font-size:10px;color:var(--muted)">от ${{ ДА: 'Димитър А.', МС: 'Мартин С.' }[a]}</span></span></span>`,
    `<span style="font-size:12px">${t}</span>`,
    `<span style="font-size:12px;color:${st[1] === 'red' ? '#c2362b' : dim ? 'var(--muted)' : INK}">${r}</span>`,
    `<span style="font-size:12px;color:var(--muted)">${w}</span>`,
    status(st[0], st[1]),
    dim ? '' : btn('Отмени', { ic: 'undo', size: 'sm', kind: 'ghost' }),
  ])).join('')}
`)}`,
  });
};

// ---------------------------------------------------------------- settings: import wizard (column mapping)
export const settingsImportNew = () => {
  const steps = [['Файл', 'done'], ['Колони', 'cur'], ['Настройки', 'next'], ['Преглед', 'next']];
  const map = [
    ['Име', 'Мария', 'Име', 'ok'], ['Фамилия', 'Колева', 'Фамилия', 'ok'], ['Тел.', '0884 123 307', 'Телефон', 'ok', '→ +359 88 412 3307'],
    ['E-mail', 'Maria.K@Example.bg', 'Имейл', 'ok', '→ maria.k@example.bg'], ['Източник', 'imot', 'Източник', 'warn', '3 непознати'],
    ['Брокер', 'Димитър', 'Отговорник', 'ok'], ['Бележка', 'търси 2-стаен…', 'Бележка', 'ok'], ['Град', 'София', 'Не импортирай', 'skip'],
  ];
  const cols = [['Колона във файла', 'minmax(0,1fr)'], ['Пример', 'minmax(0,1.2fr)'], ['Поле в CRM', '200px'], ['', 'minmax(0,1.2fr)']];
  return settingsPage({
    active: 'Импорт',
    crumbs: ['Агенция', 'Настройки', 'Импорт', 'Нов импорт'],
    title: 'Нов импорт · Контакти',
    sub: 'Свържи колоните от файла с полетата в CRM. Телефоните се привеждат към +359 автоматично.',
    minH: 1000,
    content: `
${card(`<div style="display:flex;align-items:center;padding:18px 28px">${steps.map(([s, st], i) => `${i ? `<span style="flex:1;height:2px;margin:0 10px;background:${st === 'next' ? 'repeating-linear-gradient(90deg,#c4cbd4 0 6px,transparent 6px 10px)' : 'var(--pri)'}"></span>` : ''}<span style="display:flex;align-items:center;gap:8px"><span style="width:24px;height:24px;border-radius:999px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;${st === 'done' ? 'background:var(--pri);color:#fff' : st === 'cur' ? 'border:2px solid var(--pri);background:#7fbef0;color:#0e1a2b' : 'border:2px solid #c4cbd4;color:var(--muted)'}">${st === 'done' ? icon('check', 12, 3) : i + 1}</span><span style="font-size:12px;${st === 'cur' ? 'font-weight:600' : st === 'next' ? 'color:var(--muted)' : ''}">${s}</span></span>`).join('')}</div>`)}
${card(`
  <div style="display:flex;align-items:center;gap:12px;padding:14px 20px;border-bottom:1px solid var(--line)"><span style="color:var(--pri)">${icon('file', 18)}</span><span style="flex:1">${two('alpha-kontakti-2026.csv', '1 325 реда · 8 колони · UTF-8 · разделител „;“')}</span>${btn('Смени файла', { size: 'sm', kind: 'ghost' })}</div>
  ${th(cols)}
  ${map.map(([c, ex, f, st, note]) => tr(cols, [
    `<span style="font-size:13px;font-weight:600">${c}</span>`,
    `<span style="font-size:12px;color:var(--muted);font-family:ui-monospace,Consolas,monospace">${ex}</span>`,
    `<button style="width:100%;display:flex;align-items:center;justify-content:space-between;height:32px;padding:0 10px;border:1px solid ${st === 'warn' ? '#e2a12b' : '#7d8897'};border-radius:6px;background:${st === 'skip' ? '#f4f6f8' : 'var(--surf)'};font-size:12px;color:${st === 'skip' ? 'var(--muted)' : INK}">${f}${icon('chevD', 12, 2.5)}</button>`,
    st === 'ok' ? `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#28703f">${icon('check', 13, 2.5)}<span style="color:var(--muted)">${note || ''}</span></span>` : st === 'warn' ? `<span style="display:flex;align-items:center;gap:6px;font-size:11px;color:#8a5605">${icon('alert', 13)}${note} · <a style="font-weight:600">свържи</a></span>` : `<span style="font-size:11px;color:var(--muted)">пропуска се</span>`,
  ])).join('')}
`)}
<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:6px;background:#fbf1de;font-size:12px;color:#6b4a10">${icon('alert', 14)}37 реда имат телефон или имейл, който вече е в CRM. Ще ги покажем в „Преглед“, преди да запишем нещо.</div>
<div style="display:flex;align-items:center;gap:10px">${btn('Назад', { ic: 'chevL' })}<span style="flex:1"></span>${btn('Продължи', { kind: 'primary', offset: true, ic: 'arrowR' })}</div>`,
  });
};

// ---------------------------------------------------------------- settings: my profile
export const settingsProfile = () => {
  const sec = (t, s, inner, last) => `<div style="display:flex;gap:28px;padding:22px 24px;${last ? '' : 'border-bottom:1px solid var(--line)'}"><div style="flex:0 0 180px;display:flex;flex-direction:column;gap:4px"><span style="font-size:14px;font-weight:600">${t}</span><span style="font-size:11px;line-height:16px;color:var(--muted)">${s}</span></div><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">${inner}</div></div>`;
  const tg = (t, s, on) => `<div style="display:flex;align-items:center;gap:14px">${toggle(on)}<span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:13px;font-weight:500">${t}</span><span style="font-size:11px;color:var(--muted)">${s}</span></span></div>`;
  return settingsPage({
    active: 'Моят профил',
    pageSub: 'Твоите лични настройки · виждаш ги само ти',
    title: 'Моят профил',
    sub: 'Как те виждат колегите и клиентите, и какво получаваш по имейл.',
    minH: 1000,
    content: card(`
  ${sec('Лични данни', 'Името и телефонът се виждат от колегите.', `
    <div style="display:flex;align-items:center;gap:14px">${avatar('ДА', 0, 56)}<span style="display:flex;flex-direction:column;gap:4px"><span style="font-size:13px;font-weight:600">Димитър А.</span><span style="font-size:11px;color:var(--muted)">Брокер · Алфа Имоти</span></span></div>
    <div style="display:flex;gap:14px">${field('Име', 'Димитър')}${field('Фамилия', 'Арабаджиев')}</div>
    <div style="display:flex;gap:14px">${field('Имейл', 'dimitar@alpha.bg', { disabled: true, hint: 'Използва се за вход. Смени го чрез собственика.' })}${field('Телефон', '+359 88 555 0142')}</div>`)}
  ${sec('Език', 'Езикът на менюта, имейли и дати.', `<div>${segmented(['Български', 'English'])}</div>`)}
  ${sec('Известия по имейл', 'Изпращат се от BrokerCRM, не от агенцията.', `
    ${tg('Дневен бюлетин', 'Всяка сутрин в 08:00 · просрочени и днешни задачи', true)}
    ${tg('Ново запитване към мен', 'Веднага, когато запитване получи мен за отговорник', true)}
    ${tg('Седмичен отчет', 'Понеделник сутрин · моите сделки и огледи', false)}`)}
  ${sec('Парола', 'Последна смяна преди 3 месеца.', `<div style="display:flex;gap:10px">${btn('Смени паролата', { ic: 'key' })}</div>`, true)}
`),
    footer: saveBar('Промените важат веднага след запис.'),
  });
};

// ---------------------------------------------------------------- login
export const login = () => bare(`
<div style="flex:0 0 560px;box-sizing:border-box;background:var(--side);border-right:1px solid var(--line);padding:40px 48px;display:flex;flex-direction:column;gap:28px">
  <div style="display:flex;align-items:center;gap:10px"><div style="width:34px;height:34px;border-radius:6px;background:var(--pri);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">B</div><span style="font-size:15px;font-weight:700;letter-spacing:-0.01em">BrokerCRM</span></div>
  <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:28px">
    <div style="display:flex;align-items:flex-end;gap:18px;height:190px">
      <span style="width:150px;height:170px;border-radius:14px;border:2px solid #0e1a2b;background:#eef7fe;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">${art.block(150)}</span>
      <span style="width:120px;height:130px;border-radius:14px;border:2px solid #0e1a2b;background:#fff3c4;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">${art.house(118)}</span>
      <span style="width:96px;height:104px;border-radius:14px;border:2px solid #0e1a2b;background:#dceefc;display:flex;align-items:flex-end;justify-content:center;overflow:hidden">${art.person(96)}</span>
    </div>
    <h2 style="margin:0;font-size:28px;line-height:36px;font-weight:700;letter-spacing:-0.02em;max-width:420px">Всяка сделка — с отговорник, следваща стъпка и цялата история.</h2>
    <div style="display:flex;flex-direction:column;gap:10px;font-size:13px">${['Днес: кого да наберете и кое е просрочено', 'Запитванията от порталите — с отговорник до минути', 'Купувачи и имоти, които си пасват'].map((t) => `<span style="display:flex;gap:10px;align-items:center"><span style="width:20px;height:20px;border-radius:999px;background:var(--sel);color:var(--pri);display:flex;align-items:center;justify-content:center">${icon('check', 12, 3)}</span>${t}</span>`).join('')}</div>
  </div>
  <span style="font-size:11px;color:var(--muted)">© 2026 BrokerCRM · За агенции за недвижими имоти</span>
</div>
<div style="flex:1;display:flex;flex-direction:column;padding:28px 40px">
  <div style="display:flex;justify-content:flex-end">${segmented(['БГ', 'EN'])}</div>
  <div style="flex:1;display:flex;align-items:center;justify-content:center">
    <div style="width:380px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;flex-direction:column;gap:6px"><h1 style="margin:0;font-size:26px;line-height:34px;font-weight:700;letter-spacing:-0.02em">Вход</h1><span style="font-size:13px;color:var(--muted)">Влез в профила на агенцията.</span></div>
      ${field('Имейл', 'broker@alpha.bg')}
      <div style="display:flex;flex-direction:column;gap:6px">${field('Парола', '••••••••••', { focus: true })}<a style="align-self:flex-end;font-size:12px;font-weight:600">Забравена парола?</a></div>
      ${btn('Вход', { kind: 'primary', offset: true, full: true })}
      <div style="display:flex;align-items:center;gap:10px;font-size:11px;color:var(--muted)"><span style="flex:1;height:1px;background:var(--line)"></span>нямаш профил?<span style="flex:1;height:1px;background:var(--line)"></span></div>
      ${btn('Регистрирай агенция', { full: true })}
      <span style="font-size:11px;line-height:16px;color:var(--muted);text-align:center">Колега те е поканил? Отвори линка от имейла — ще влезеш направо в агенцията.</span>
    </div>
  </div>
</div>`, 820);
