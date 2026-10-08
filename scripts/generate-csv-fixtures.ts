import fs from 'fs';
import path from 'path';
import iconv from 'iconv-lite';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures', 'imports');
if (!fs.existsSync(fixturesDir)) {
  fs.mkdirSync(fixturesDir, { recursive: true });
}

// 1. UTF-8 Comma with messy phones and duplicates
const utf8Comma = `Име,Фамилия,Имейл,Телефон,Фирма,Бележка
Иван,Иванов,ivan@example.com,0888 123 456,Иван ЕООД,"Contacted yesterday"
Мария,Петрова,maria@example.com, +359 89 9 123 456  ,, "Needs call"
Иван,Иванов,ivan@example.com,0888123456,Иван ЕООД,"Duplicate in-file"
Георги,,georgi@example.com,0877112233,,
`;
fs.writeFileSync(path.join(fixturesDir, 'utf8-comma.csv'), utf8Comma, 'utf8');
console.log('Created utf8-comma.csv');

// 2. Windows-1251 Semicolon
const win1251Semicolon = `Пълно име;Телефон;Имейл;Тип
Петър Тодоров;0888999888;peter@example.com;лице
Омега АД;;omega@example.com;фирма
`;
fs.writeFileSync(path.join(fixturesDir, 'windows-1251-semicolon.csv'), iconv.encode(win1251Semicolon, 'win1251'));
console.log('Created windows-1251-semicolon.csv');

// 3. 5000 rows limit test
const largeFilePath = path.join(fixturesDir, 'large-5000.csv');
const writeStream = fs.createWriteStream(largeFilePath, { encoding: 'utf8' });
writeStream.write('First Name,Last Name,Email,Phone\n');
for (let i = 1; i <= 5000; i++) {
  writeStream.write(`Test${i},User${i},user${i}@example.com,0888${i.toString().padStart(6, '0')}\n`);
}
writeStream.end();
writeStream.on('finish', () => {
  console.log('Created large-5000.csv');
});
