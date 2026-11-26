import { INK, icon, art, thumb, btn, iconBtn, pill, tag, role, temp, status, avatar, agent, card, cardHead, label, tabs, search, chip, filterBar, th, tr, two, page, pageTitle, field, segmented } from './lib.mjs';

const timelineItem = (ic, title, sub, when, tint = '#ffffff') =>
  `<div style="display:flex;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line)">
    <span style="width:30px;height:30px;flex-shrink:0;border-radius:999px;border:1.5px solid #0e1a2b;box-sizing:border-box;background:${tint};display:flex;align-items:center;justify-content:center">${icon(ic, 14)}</span>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:13px;font-weight:500">${title}</span>${sub ? `<span style="font-size:11px;color:var(--muted)">${sub}</span>` : ''}</div>
    <span style="font-size:11px;color:var(--muted);white-space:nowrap">${when}</span>
  </div>`;

const stageDots = (n, of = 5) =>
  `<span style="display:inline-flex;gap:3px;align-items:center">${Array.from({ length: of }, (_, i) => `<span style="width:${i === n - 1 ? 14 : 6}px;height:6px;border-radius:999px;background:${i < n ? 'var(--pri)' : '#dce1e7'}"></span>`).join('')}</span>`;

const nextStep = (title, when, cta = 'Готово') =>
  `<div style="display:flex;align-items:center;gap:16px;padding:16px 20px;border-radius:8px;background:var(--next-bg);border:1px solid var(--next-line)">
    <span style="width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center">${art.deal(40)}</span>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">${label('Следваща стъпка')}<span style="font-size:14px;font-weight:600">${title}</span><span style="font-size:11px;color:var(--muted)">${when}</span></div>
    ${btn(cta, { kind: 'primary', offset: true, ic: 'check' })}
  </div>`;

const kv = (rows, cols = 1) =>
  `<div style="display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:0 18px">${rows
    .map(([k, v]) => `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line);font-size:12px"><span style="flex:0 0 ${cols > 1 ? 110 : 96}px;color:var(--muted)">${k}</span><span style="flex:1;min-width:0;font-weight:500">${v}</span></div>`)
    .join('')}</div>`;

// ---------------------------------------------------------------- contact detail
export const contactDetail = () => page({
  active: 'Контакти',
  crumbs: ['База', 'Контакти', 'Мария Колева'],
  minH: 1180,
  body: `
<div style="display:flex;gap:20px;align-items:flex-start">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:18px">
    ${card(`
      <div style="padding:20px 22px 0;display:flex;gap:18px;align-items:flex-start">
        ${art.personRound(68)}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:6px;align-items:center">${role('Купувач')}${temp('Горещ')}</div>
          <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.02em">Мария Колева</h1>
          <span style="font-size:12px;color:var(--muted)">Клиент от 14 окт · Imot.bg · последен контакт днес 10:00</span>
        </div>
        <div style="display:flex;gap:8px">${btn('Обади се', { kind: 'primary', ic: 'phone' })}${btn('Viber', { ic: 'chat' })}${iconBtn('more', 'Още', 36)}</div>
      </div>
      <div style="padding:0 22px;margin-top:14px">${tabs([['Преглед'], ['Сделки', '2'], ['Имоти', '1'], ['История', '14']], 0, '0', false)}</div>
    `)}
    ${nextStep('Изпрати оглед за Имот 1077 в събота', 'Утре до 12:00 · по сделка „2-стаен във Витоша“')}
    ${card(`
      ${cardHead('Сделки', btn('Нова сделка', { ic: 'plus', size: 'sm' }), '2')}
      <div style="display:flex;align-items:center;gap:14px;padding:14px 20px;border-bottom:1px solid var(--line);background:var(--surf)">
        ${thumb('deal', 38, 34)}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <span style="display:flex;gap:6px;align-items:center"><span style="font-size:13px;font-weight:600">Купува 2-стаен във Витоша</span>${role('Купува')}</span>
          <span style="font-size:11px;color:var(--muted)">до € 180 000 · 2-стаен · Витоша, Златен рог · 65–85 м² · паркомясто</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${status('Огледи', 'blue')}${stageDots(2)}</div>
        <div style="width:130px;display:flex;flex-direction:column;gap:2px;align-items:flex-end"><span style="font-size:11px;color:var(--muted)">Следващо</span><span style="font-size:12px;font-weight:600;color:#8a5605">утре 12:00</span></div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;padding:14px 20px">
        <span style="opacity:.55">${thumb('deal', 38, 34, '#eef3f8')}</span>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:4px">
          <span style="display:flex;gap:6px;align-items:center"><span style="font-size:13px;font-weight:600;color:var(--muted)">Купи гарсониера в Младост 1</span>${role('Купува')}</span>
          <span style="font-size:11px;color:var(--muted)">Имот 0712 · € 96 000 · затворена 12 май 2025</span>
        </div>
        ${status('Спечелена', 'green')}
        <div style="width:130px"></div>
      </div>`)}
    ${card(`
      ${cardHead('История', btn('Бележка', { ic: 'plus', size: 'sm' }))}
      ${timelineItem('eye', 'Оглед на Имот 0987, Златен рог', '„Харесва светлината, но иска по-нов блок.“', 'днес 10:00')}
      ${timelineItem('phone', 'Разговор · отговори', '4 мин · Димитър А. · следващо: изпрати оглед за Имот 1077', 'днес 09:20', '#e3f1e8')}
      ${timelineItem('send', 'Изпратени 2 имота по Viber', 'Имот 0987 · Имот 1077', '19 ное')}
      ${timelineItem('arrowR', 'Етап: Запитване → Огледи', 'Сделка „Купува 2-стаен във Витоша“', '17 ное', '#fff3c4')}
      ${timelineItem('mail', 'Запитване от Imot.bg', '„Търся 2-стаен във Витоша до € 180 000, с паркомясто.“', '14 окт')}
      <div style="padding:12px 20px;font-size:11px;color:var(--muted);display:flex"><span style="flex:1">5 от 14</span><a style="font-weight:600">Покажи всички</a></div>`)}
  </div>

  <aside style="flex:0 0 320px;display:flex;flex-direction:column;gap:16px">
    ${card(`
      ${cardHead('Контактни данни', iconBtn('edit', 'Редактирай', 28))}
      ${[
        ['phone', '+359 88 412 3307', 'мобилен · основен', true],
        ['phone', '+359 2 981 4410', 'служебен'],
        ['mail', 'maria.k@example.bg', 'основен', false, true],
      ].map(([ic, v, s, links, mail]) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--line)">
          <span style="color:var(--muted)">${icon(ic, 15)}</span>
          <span style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:13px;font-weight:500">${v}</span><span style="font-size:10px;color:var(--muted)">${s}</span></span>
          ${links ? `<span style="display:flex;gap:4px">${iconBtn('phone', 'Обади се', 28)}${iconBtn('chat', 'Viber', 28)}</span>` : mail ? iconBtn('send', 'Имейл', 28) : iconBtn('phone', 'Обади се', 28)}
        </div>`).join('')}
      <div style="padding:10px 20px"><a style="font-size:12px;font-weight:600;display:inline-flex;gap:6px;align-items:center">${icon('plus', 12, 2.5)}Добави телефон или имейл</a></div>`)}
    ${card(`
      ${cardHead('Детайли')}
      <div style="padding:2px 20px 10px">${kv([
        ['Тип', 'Лице'],
        ['Роля', 'Купувач'],
        ['Източник', 'Imot.bg'],
        ['Отговорник', `<span style="display:inline-flex;gap:8px;align-items:center">${agent('ДА')}Димитър А.</span>`],
        ['Създаден', '14 окт 2026'],
        ['Последен контакт', 'днес 10:00'],
      ])}</div>`)}
    ${card(`
      ${cardHead('Имоти като страна', '', '1')}
      <div style="display:flex;align-items:center;gap:12px;padding:12px 20px">
        ${thumb('block', 32, 28, '#fff3c4')}
        <span style="flex:1;min-width:0">${two('Имот 0712 · Младост 1', 'гарсониера · 38 м² · € 96 000')}</span>
        ${status('Собственик', 'yellow')}
      </div>`)}
    <div style="display:flex;align-items:center;gap:8px;padding:10px 12px;border-radius:6px;background:#e3f1e8;font-size:11px;color:#28703f">${icon('shield', 14, 2.5)}Съгласие за обработка на данни · 14 окт 2026</div>
    <div style="display:flex;gap:8px">${btn('Слей с друг', { ic: 'merge', kind: 'ghost', size: 'sm' })}${btn('Архивирай', { ic: 'archive', kind: 'ghost', size: 'sm' })}</div>
  </aside>
</div>`,
});

// ---------------------------------------------------------------- deals list
export const deals = () => {
  const cols = [['Сделка', 'minmax(0,2.4fr)'], ['Етап', '110px'], ['Следващо действие', 'minmax(0,1.6fr)'], ['Бюджет / цена', '120px', 'text-align:right'], ['', '26px']];
  const due = (t, c) => `<span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t[0]}</span><span style="font-size:11px;font-weight:600;color:${{ red: '#c2362b', amber: '#8a5605', ok: 'var(--muted)' }[c]}">${c === 'red' ? '● ' : ''}${t[1]}</span></span>`;
  const rows = [
    ['Иван Петров купува 3-стаен в Лозенец', 'Купува', 'Иван Петров · Imot.bg', 'Оферта', 3, ['Обади се на собственика за насрещна оферта', 'днес 17:00'], 'amber', 'до € 240 000', 'ДА'],
    ['Елена Димитрова · 2-стаен, Изток', 'Купува', 'Елена Димитрова · сайт', 'Капаро', 4, ['Предварителен договор при нотариус', 'просрочено 2 дни'], 'red', '€ 182 000', 'ДА'],
    ['Мария Колева · 2-стаен във Витоша', 'Купува', 'Мария Колева · Imot.bg', 'Огледи', 2, ['Оглед на Имот 1077', 'утре 12:00'], 'ok', 'до € 180 000', 'ДА'],
    ['Георги Николов продава 4-стаен, Яворов', 'Продава', 'Георги Николов · препоръка', 'Огледи', 2, ['Оглед със Силвия Р.', 'чет 16:00'], 'ok', '€ 348 000', 'ДА'],
    ['Тодор М. наема офис в Центъра', 'Наема', 'Тодор М. · телефон', 'Оферта', 3, ['Няма следващо действие', 'добави стъпка'], 'red', '€ 1 800/мес', 'ЕГ'],
    ['Калина В. · къща в Драгалевци', 'Купува', 'Калина В. · Homes.bg', 'Запитване', 1, ['Първо обаждане', 'просрочено 1 ден'], 'red', 'до € 380 000', 'НД'],
    ['Росица Михайлова продава 2-стаен, Стрелбище', 'Продава', 'Росица Михайлова · препоръка', 'Огледи', 2, ['Оглед с купувачи', 'днес 14:30'], 'amber', '€ 168 000', 'МС'],
    ['Стефан Иванов продава Имот 1042, Козяк', 'Продава', 'Стефан Иванов · Homes.bg', 'Оферта', 3, ['Отговор на оферта € 228 000', 'пет 10:00'], 'ok', '€ 235 000', 'ДА'],
  ];
  const stages = [['Запитване', 9, '€ 2,1 млн'], ['Огледи', 14, '€ 3,4 млн'], ['Оферта', 7, '€ 1,6 млн'], ['Капаро', 5, '€ 1,1 млн'], ['Сделка', 3, '€ 0,7 млн']];
  return page({
    active: 'Сделки',
    crumbs: ['Работа', 'Сделки'],
    minH: 1100,
    body: `
${pageTitle('Сделки', `<strong style="color:${INK};font-weight:600">38 активни</strong> · <strong style="color:#c2362b;font-weight:600">6 с просрочено действие</strong> · <strong style="color:#8a5605;font-weight:600">4 без следваща стъпка</strong>`, btn('Нова сделка', { kind: 'primary', offset: true, ic: 'plus' }))}
${card(`<div style="display:grid;grid-template-columns:repeat(5,minmax(0,1fr))">${stages.map(([s, n, v], i) => `<div style="padding:14px 18px;display:flex;flex-direction:column;gap:6px;${i ? 'border-left:1px solid var(--line);' : ''}">
  <span style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)"><span style="width:18px;height:18px;border-radius:999px;border:1.5px solid ${i < 4 ? 'var(--pri)' : '#7d8897'};box-sizing:border-box;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:${INK}">${i + 1}</span>${s}</span>
  <span style="display:flex;align-items:baseline;gap:8px"><span style="font-size:22px;font-weight:700">${n}</span><span style="font-size:11px;color:var(--muted)">${v}</span></span>
  <span style="height:4px;border-radius:999px;background:#eef3f8;overflow:hidden"><span style="display:block;height:100%;width:${(n / 14) * 100}%;background:${i === 4 ? '#2e9e5b' : 'var(--pri)'}"></span></span>
</div>`).join('')}</div>`)}
${card(`
  ${tabs([['Активни', '38'], ['Спечелени', '112'], ['Загубени', '64'], ['Всички', '214']], 0)}
  ${filterBar(`${search('Сделка, контакт, имот')}${chip('Етап')}${chip('Тип')}${chip('Отговорник')}${chip('Следващо действие', true)}`)}
  ${th(cols)}
  ${rows.map(([t, r, c, st, n, nx, dc, v, a]) => tr(cols, [
    `<span style="display:flex;align-items:center;gap:12px">${thumb('deal', 34, 30)}<span style="display:flex;flex-direction:column;gap:3px;min-width:0"><span style="display:flex;gap:6px;align-items:center"><span style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${t}</span>${role(r)}</span><span style="font-size:11px;color:var(--muted)">${c}</span></span></span>`,
    `<span style="display:flex;flex-direction:column;gap:5px;align-items:flex-start">${status(st, 'blue')}${stageDots(n)}</span>`,
    due(nx, dc),
    `<span style="font-size:13px;font-weight:600">${v}</span>`,
    agent(a),
  ], dc === 'red' && nx[0].startsWith('Няма') ? 'background:#fffaf0' : '')).join('')}
  <div style="display:flex;align-items:center;gap:10px;padding:12px 20px;font-size:11px;color:var(--muted)"><span style="flex:1">1–8 от 38 · подредени по следващо действие</span>${iconBtn('chevL', 'Назад', 32)}${iconBtn('chevR', 'Напред', 32)}</div>
`)}`,
  });
};

// ---------------------------------------------------------------- property detail
export const propertyDetail = () => page({
  active: 'Имоти',
  crumbs: ['База', 'Имоти', 'Имот 1042 · Козяк'],
  minH: 1180,
  body: `
<div style="display:flex;gap:20px;align-items:flex-start">
  <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:18px">
    ${card(`
      <div style="padding:20px 22px 0;display:flex;gap:18px;align-items:flex-start">
        ${thumb('block', 68, 60, '#fff3c4')}
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;gap:6px;align-items:center">${role('Продажба')}${status('Оферта', 'amber')}<span style="font-size:11px;color:var(--muted)">· ексклузивен до 20 фев</span></div>
          <h1 style="margin:0;font-size:22px;line-height:30px;font-weight:700;letter-spacing:-0.02em">Имот 1042 · Козяк</h1>
          <span style="font-size:12px;color:var(--muted)">ул. Козяк 14 · 3-стаен · ет. 4 от 6 · тухла · 95 м²</span>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span style="font-size:22px;font-weight:700;letter-spacing:-0.01em">€ 235 000</span>
          <span style="font-size:11px;color:var(--muted)">€ 2 474/м²</span>
          ${pill(`${icon('down', 10, 2.5)} € 10 000 · преди 5 дни`, '#e3f1e8', '#28703f', { size: 10 })}
        </div>
      </div>
      <div style="display:flex;align-items:flex-end;gap:10px;padding:0 22px;margin-top:10px">
        <div style="flex:1">${tabs([['Преглед'], ['Купувачи', '4'], ['Страни', '1'], ['История', '9']], 0, '0', false)}</div>
        <div style="display:flex;gap:8px;padding-bottom:10px">${btn('Редактирай', { ic: 'edit' })}${btn('Нова сделка', { kind: 'primary', offset: true, ic: 'plus' })}</div>
      </div>
    `)}
    ${card(`
      ${cardHead('Характеристики')}
      <div style="padding:4px 20px 14px">${kv([
        ['Тип', '3-стаен апартамент'], ['Площ', '95 м² · 82 м² чиста'],
        ['Етаж', '4 от 6 · има асансьор'], ['Строителство', 'тухла · 2008'],
        ['Изложение', 'юг / изток'], ['Отопление', 'ТЕЦ'],
        ['Паркиране', 'подземен гараж'], ['Обзавеждане', 'частично'],
      ], 2)}
      <p style="margin:12px 0 0;font-size:12px;line-height:18px;color:var(--muted)">Ремонт 2021. Тиха улица до Южния парк, две тераси. Собственикът приема оглед делнични след 17:00.</p></div>`)}
    ${card(`
      ${cardHead('Подходящи купувачи', `<div style="display:inline-flex;gap:2px;padding:2px;border:1px solid var(--line);border-radius:8px"><span style="padding:4px 10px;border-radius:6px;font-size:11px;background:var(--sel);font-weight:600">Всички 4</span><span style="padding:4px 10px;font-size:11px;color:var(--muted)">Непредложени 1</span></div>`, '4')}
      ${[
        ['ИП', 'Иван Петров', 'до € 240 000 · 3-стаен · Лозенец, Козяк', 96, ['Оферта € 228 000', 'amber']],
        ['РП', 'Радослав П.', 'до € 230 000 · Лозенец · не последен етаж', 84, ['Оглед 20 ное', 'blue']],
        ['СР', 'Силвия Р.', 'до € 250 000 · 3–4 стаен · Козяк, Хиподрума', 78, ['Предложен', 'grey']],
        ['НТ', 'Николай Т.', 'до € 260 000 · 3-стаен · с гараж', 72, null],
      ].map(([ini, n, s, f, stt], i) => `<div style="display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--line)">
          ${avatar(ini, i, 34)}
          <span style="flex:1;min-width:0">${two(n, s)}</span>
          <span style="font-size:11px;font-weight:600;white-space:nowrap;padding:2px 6px;border-radius:4px;${f >= 90 ? 'background:#e3f1e8;color:#28703f' : 'background:var(--sel);color:#0e1a2b'}">${f}% съвпадение</span>
          <span style="width:130px;display:flex;justify-content:flex-end">${stt ? status(stt[0], stt[1]) : btn('Предложи', { ic: 'send', size: 'sm' })}</span>
        </div>`).join('')}`)}
  </div>
  <aside style="flex:0 0 320px;display:flex;flex-direction:column;gap:16px">
    ${card(`
      <div style="padding:18px;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;align-items:center;gap:12px">${art.personRound(48)}<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px"><span style="font-size:15px;font-weight:700">Стефан Иванов</span><span style="font-size:11px;color:var(--muted)">Собственик · от 1 сеп · Homes.bg</span></div>${iconBtn('external', 'Отвори контакта')}</div>
        <div style="display:flex;flex-direction:column;gap:6px;font-size:12px"><span style="display:flex;gap:10px;align-items:center">${icon('phone')}+359 88 903 2218</span><span style="display:flex;gap:10px;align-items:center">${icon('mail')}s.ivanov@example.bg</span></div>
        <div style="display:flex;gap:8px">${btn('Обади се', { kind: 'primary', ic: 'phone', full: true })}${btn('Viber', { ic: 'chat', full: true })}</div>
      </div>
      <div style="padding:10px 18px;border-top:1px solid var(--line);font-size:11px;color:var(--muted);display:flex;gap:6px;align-items:center">${icon('users', 12)}Още страни: няма · <a style="font-weight:600">Добави</a></div>`)}
    ${card(`
      ${cardHead('Портали')}
      ${[['Imot.bg', 'обновена днес · съвпада с CRM', 'green', 'Публикувана'], ['Homes.bg', 'цената е стара · € 245 000', 'amber', 'Остаряла']].map(([p, s, c, st]) => `<div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--line)"><span style="color:var(--muted)">${icon('globe', 15)}</span><span style="flex:1;min-width:0">${two(p, s)}</span>${status(st, c)}</div>`).join('')}`)}
    ${card(`
      ${cardHead('История')}
      <div style="padding:12px 20px;display:flex;flex-direction:column;gap:12px">${[
        ['Цената намалена с € 10 000', '18 ное'], ['Оглед с Радослав П.', '20 ное'], ['Оферта € 228 000 от Иван Петров', '14 ное'], ['Вписан имот · ексклузивен договор', '1 сеп'],
      ].map(([t, w]) => `<div style="display:flex;gap:10px;font-size:12px"><span style="width:8px;height:8px;margin-top:4px;flex-shrink:0;border-radius:999px;background:#7fbef0;border:1.5px solid #0e1a2b"></span><span style="flex:1">${t}</span><span style="font-size:10px;color:var(--muted);white-space:nowrap">${w}</span></div>`).join('')}</div>`)}
  </aside>
</div>`,
});

// ---------------------------------------------------------------- property form
export const propertyForm = () => {
  const section = (n, t, s, inner, last = false) => `<div style="display:flex;gap:28px;padding:22px 24px;${last ? '' : 'border-bottom:1px solid var(--line)'}">
    <div style="flex:0 0 190px;display:flex;flex-direction:column;gap:4px"><span style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600"><span style="width:22px;height:22px;border-radius:999px;background:var(--sel);font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${n}</span>${t}</span><span style="font-size:11px;line-height:16px;color:var(--muted);padding-left:30px">${s}</span></div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:14px">${inner}</div></div>`;
  const row = (...f) => `<div style="display:flex;gap:14px">${f.join('')}</div>`;
  return page({
    active: 'Имоти',
    crumbs: ['База', 'Имоти', 'Нов имот'],
    minH: 1240,
    body: `
${pageTitle('Нов имот', 'Полетата със <span style="color:#c2362b">*</span> са задължителни. Номерът се дава автоматично.')}
${card(`
  ${section(1, 'Основни', 'Какво предлагаме.', `
    <div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:12px;font-weight:500">Сделка<span style="color:#c2362b"> *</span></span><div>${segmented(['Продажба', 'Наем'])}</div></div>
    ${row(field('Тип имот', '3-стаен', { select: true, req: true }), field('Статус', 'Активен', { select: true }), field('Отговорник', 'Димитър А.', { select: true }))}`)}
  ${section(2, 'Местоположение', 'Кварталът участва в съвпаденията с купувачи.', `
    ${row(field('Град', 'София', { select: true, req: true, w: '180px' }), field('Квартал', 'Козяк', { select: true, req: true }))}
    ${field('Адрес', 'ул. Козяк 14, вх. А', { hint: 'Вижда се само в CRM, не в обявите.' })}`)}
  ${section(3, 'Параметри', '', `
    ${row(field('Площ', '95', { suffix: 'м²', req: true, focus: true }), field('Етаж', '4'), field('Етажи в сградата', '6'))}
    ${row(field('Строителство', 'Тухла', { select: true }), field('Година', '2008'), field('Обзавеждане', 'Частично', { select: true }))}`)}
  ${section(4, 'Цена', '', `
    ${row(field('Цена', '235 000', { prefix: '€', req: true, hint: '€ 2 474/м²' }), field('Минимална цена', '225 000', { prefix: '€', hint: 'Само за брокерите, не се публикува.' }))}`)}
  ${section(5, 'Страни', 'Собственик, съсобственик или пълномощник.', `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--line);border-radius:6px">${avatar('СИ', 1, 32)}<span style="flex:1">${two('Стефан Иванов', '+359 88 903 2218 · s.ivanov@example.bg')}</span>${tag('Собственик', '#fdf3cf', '#6b4a10')}${iconBtn('x', 'Премахни', 28)}</div>
    <div>${btn('Добави страна', { kind: 'dashed', ic: 'plus', size: 'sm' })}</div>`)}
  ${section(6, 'Бележки', '', `
    <div style="min-height:84px;box-sizing:border-box;border:1px solid #7d8897;border-radius:6px;padding:10px;font-size:13px;line-height:19px">Ремонт 2021. Тиха улица до Южния парк, две тераси. Огледи делнични след 17:00.</div>`, true)}
`)}
<div style="display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:11px;color:var(--muted)">След запис ще видиш подходящите купувачи.</span>${btn('Откажи')}${btn('Запази имота', { kind: 'primary', offset: true })}</div>`,
  });
};
