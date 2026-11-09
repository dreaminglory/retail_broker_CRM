/**
 * The 2,000-row property import scale file (spec: property-import rule 11, Task 7). Fake data:
 * Sofia, Plovdiv, Varna and Burgas; Alpha's seeded areas plus 20 new ones; mixed types, EUR and
 * BGN prices, unique addresses and refs; 1,500 owners, some on two rows. Deterministic.
 *
 *   node scripts/property-import/generate-scale.ts [out.csv] [rows]
 *
 * `measure.test.ts` imports `scaleCsv` directly; the file is not committed.
 */
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const SCALE_HEADERS = [
  'Тип имот', 'Населено място', 'Квартал', 'Адрес', 'Квадратура', 'Площ на парцела', 'Етаж', 'Етажност',
  'Строителство', 'Продажна цена', 'Цена наем', 'Статус', 'Реф. номер', 'Собственик', 'Телефон на собственика',
];

const PLACES: { settlement: string; areas: string[] }[] = [
  { settlement: 'София', areas: ['Лозенец', 'Младост 1', 'Център', 'Витоша', 'Бояна', 'Драгалевци', 'Гоце Делчев', 'Хиподрума'] },
  { settlement: 'Пловдив', areas: ['Кършияка', 'Тракия', 'Смирненски', 'Каменица 1', 'Старият град'] },
  { settlement: 'Варна', areas: ['Бриз', 'Чайка', 'Левски', 'Владиславово', 'Аспарухово'] },
  { settlement: 'Бургас', areas: ['Лазур', 'Зорница', 'Изгрев', 'Сарафово', 'Меден рудник'] },
];
const TYPES = ['двустаен', 'тристаен', 'едностаен', 'студио', 'мезонет', 'къща', 'гараж', 'парцел', 'четиристаен'];
const CONSTRUCTIONS = ['тухла', 'панел', 'ЕПК', ''];
const STATUSES = ['', '', '', 'активна', 'резервирана', 'продадена'];

const quote = (value: string) => (/[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value);

export function scaleRows(count = 2000): string[][] {
  const rows: string[][] = [];
  for (let i = 0; i < count; i++) {
    const place = PLACES[i % PLACES.length];
    const type = TYPES[i % TYPES.length];
    const isPlot = type === 'парцел';
    const isHouse = type === 'къща';
    const isGarage = type === 'гараж';
    const floorsTotal = isPlot || isGarage ? '' : String(2 + (i % 10));
    const floor = isPlot || isHouse || isGarage ? '' : String(1 + (i % 2));
    const price = 30000 + (i % 400) * 1000;
    const bgn = i % 10 === 0;
    const sale = i % 3 === 2 ? '' : bgn ? `${price * 2} лв.` : String(price);
    const rent = i % 3 === 0 ? '' : String(300 + (i % 50) * 10);
    // 1,500 owners: the first 500 of them own two properties.
    const ownerIndex = i < 1000 ? i % 500 : i - 500;
    rows.push([
      type,
      place.settlement,
      place.areas[i % place.areas.length],
      `ул. Мащаб ${i + 1}`,
      isPlot ? '' : String(30 + (i % 150)),
      isPlot || isHouse ? String(300 + (i % 900)) : '',
      floor,
      floorsTotal,
      isPlot ? '' : CONSTRUCTIONS[i % CONSTRUCTIONS.length],
      sale,
      rent,
      STATUSES[i % STATUSES.length],
      `SCALE-${String(i + 1).padStart(5, '0')}`,
      `Мащаб Собственик-${ownerIndex + 1}`,
      `0899 ${String(500000 + ownerIndex).slice(0, 3)} ${String(500000 + ownerIndex).slice(3)}`,
    ]);
  }
  return rows;
}

export function scaleCsv(count = 2000): string {
  return [SCALE_HEADERS, ...scaleRows(count)].map((row) => row.map(quote).join(',')).join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const out = process.argv[2] ?? join(tmpdir(), 'properties-scale.csv');
  const count = Number(process.argv[3] ?? 2000);
  writeFileSync(out, scaleCsv(count));
  console.log(`Wrote ${count} rows to ${out}`);
}
