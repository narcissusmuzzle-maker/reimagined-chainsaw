// Прогон настоящего page/index.js на заглушках API часов: экран, прокрутка, долгое нажатие, отправка на телефон.
// Запуск: node --import ./tests/register.mjs tests/page.test.mjs   (из папки приложения)
import assert from 'node:assert'

let n = 0
async function t(name, f) { await f(); n++; console.log('ok  ' + name) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const alive = () => globalThis.__W.filter((w) => w.alive)
const buttons = () => alive().filter((w) => w.type === 'BUTTON')
const texts = () => alive().filter((w) => w.type === 'TEXT').map((w) => w.props.text)
const DY = -31
const DX = -18          // горизонтальный сдвиг, как в U613 Stat

const phone = { q: [], got: [], online: true }
function task(i, e, x, c) { return { i: i, e: e, x: x, c: c } }
phone.q = [
  task('a', '🏠', 'найти электрика', [0, 0, 2]),
  task('b', '🧬', 'индекс 100 элементов', [2, 1, 0]),
  task('c', '🩸', 'запись текучки', [2, 0, 0]),
  task('d', '🏠', 'очень длинное название задачи на две строки', [0, 0, 1]),
  task('e', '🏠', 'уборка в коридоре', [0, 0, 2]),
  task('f', '📖', 'а'.repeat(90), [2, 1, 0]),
  task('g', '🍀', 'седьмая', [1, 1, 1]),
  task('h', '📦', 'восьмая', [0, 1, 2]),
  task('i', '🤿', 'девятая', [2, 2, 2]),
  task('j', '🎨', 'десятая', [2, 2, 2]),
  task('k', '💀', 'одиннадцатая', [0, 2, 0]),
  task('l', '🔍', 'двенадцатая', [0, 0, 0])
]
globalThis.__REQ = (p) => {
  phone.got.push(p)
  if (!phone.online) return Promise.reject(new Error('offline'))
  if (p.t === 'tasks') return Promise.resolve({ ok: true, reply: { t: 'tasks', q: phone.q } })
  if (p.t === 'tdone') {
    phone.q = phone.q.filter((x) => x.i !== p.tid)
    return Promise.resolve({ ok: true, reply: { t: 'ack', id: p.id, q: phone.q } })
  }
  return Promise.resolve({ ok: false })
}
globalThis.Page = (o) => { globalThis.__PAGE = o }
await import('../page/index.js')
const page = globalThis.__PAGE

await t('запуск: полоска скрыта, прокрутка заблокирована, задачи нарисованы строками', async () => {
  page.onInit()
  page.build()
  await sleep(20)
  assert.equal(globalThis.__STATUSBAR, false)
  assert.equal(globalThis.__SCROLLLOCK, true)
  assert.equal(globalThis.__RELAUNCH, true)
  const cards = alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0x1c1c1c)
  assert.ok(cards.length >= 4)
  assert.ok(cards.every((w) => w.props.x === 26 + DX && w.props.w === 380))   // 26…406 на экране = 8…388 на странице
  assert.equal(cards[0].props.y, 48 + DY)
  // последняя карточка кончается не ниже 464 (низ как у вертикальных полосок U613 Stat)
  assert.ok(cards.every((w) => w.props.y - DY + w.props.h <= 464))
  assert.equal(buttons().length, cards.length)
})

await t('одна и две строки: двухстрочная карточка выше, полоска растянута, текст в две строки без «…»', async () => {
  const cards = alive().filter((w) => w.type === 'FILL_RECT' && w.props.color === 0x1c1c1c)
  const hs = cards.map((w) => w.props.h)
  assert.deepEqual(hs.slice(0, 4), [58, 92, 58, 92])                  // b и d — две строки (рамка уже, чем раньше)
  assert.equal(cards[1].props.y - cards[0].props.y, 62)               // 58 + просвет 4
  assert.equal(cards[2].props.y - cards[1].props.y, 96)               // 92 + просвет 4
  assert.equal(cards[3].props.y - cards[2].props.y, 62)
  const strips = alive().filter((w) => w.type === 'FILL_RECT' && w.props.w === 23)
  assert.equal(strips.length, cards.length * 3)
  const row4 = strips.slice(9, 12)                                    // части полоски четвёртой карточки
  assert.ok(row4.every((w) => w.props.h === 92 && w.props.y === cards[3].props.y))
  assert.deepEqual(row4.map((w) => w.props.x), [331 + DX, 357 + DX, 383 + DX])
  const tx = texts()
  assert.ok(tx.includes('очень длинное название') || tx.some((s) => s.startsWith('очень')))
  assert.ok(tx.every((s) => !s.includes('…') && !s.includes('...')))
  assert.ok(tx.every((s) => s.length * 14 <= 241))                    // каждая строка помещается
})

await t('цвета частей полоски идут слева направо как квадратики: важность, сложность, срочность', async () => {
  const strips = alive().filter((w) => w.type === 'FILL_RECT' && w.props.w === 23)
  assert.deepEqual(strips.slice(0, 3).map((w) => w.props.color), [0x3fb950, 0x3fb950, 0xf85149])   // a: [0,0,2]
  assert.deepEqual(strips.slice(3, 6).map((w) => w.props.color), [0xf85149, 0xe3b341, 0x3fb950])   // b: [2,1,0]
})

await t('эмодзи слева у карточки, на уровне первой строки', async () => {
  const e = alive().filter((w) => w.type === 'IMG')
  assert.equal(e[0].props.src, 'e0.png')       // 🏠
  assert.equal(e[1].props.src, 'e4.png')       // 🧬
  assert.equal(e[0].props.x, 36 + DX)
  assert.equal(e[0].props.y, 58 + DY)
})

await t('прокрутка: свайп вверх сдвигает на 4 задачи, вниз — назад; вправо — выход из приложения', async () => {
  const g = globalThis.__GESTURE
  assert.equal(g('R'), false)                     // выход
  assert.equal(g('L'), true)                      // влево ничего не делает
  const first = () => alive().filter((w) => w.type === 'TEXT')[0].props.text
  assert.equal(first(), 'найти электрика')
  assert.equal(g('U'), true)
  assert.notEqual(first(), 'найти электрика')     // сдвинулись
  await sleep(300)
  assert.equal(g('D'), true)
  assert.equal(first(), 'найти электрика')
  page.onDestroy()
})

await t('долгое нажатие: задача пропадает, на телефон уходит tdone, после подтверждения список обновляется', async () => {
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(20)
  const before = globalThis.__VIB || 0
  const nBtn = buttons().length
  buttons()[1].props.longpress_func()             // вторая карточка — задача b
  await sleep(120)
  assert.equal((globalThis.__VIB || 0), before + 1)
  const td = phone.got.filter((p) => p.t === 'tdone')
  assert.equal(td.length, 1)
  assert.equal(td[0].tid, 'b')
  assert.equal(phone.q.length, 11)
  assert.ok(buttons().length >= nBtn - 1)         // освободившееся место заняла следующая задача
  assert.equal(texts().includes('индекс 100 элементов'), false)
  page.onDestroy()
})

await t('нет связи: выполнение запоминается и пересылается, пока телефон не подтвердит', async () => {
  phone.online = false
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(20)
  buttons()[0].props.longpress_func()             // задача a
  await sleep(120)
  assert.equal(texts().includes('найти электрика'), false)
  assert.equal(JSON.parse(globalThis.__LS.st).pend.length, 1)
  page.onDestroy()
  phone.online = true
  globalThis.__W.length = 0
  phone.got.length = 0
  page.build()
  await sleep(50)
  assert.equal(phone.got.filter((p) => p.t === 'tdone').length, 1)
  assert.equal(phone.q.find((x) => x.i === 'a'), undefined)
  assert.equal(JSON.parse(globalThis.__LS.st).pend.length, 0)
  page.onDestroy()
})

await t('пустая очередь: надпись', async () => {
  phone.q = []
  globalThis.__W.length = 0
  page.build()
  await sleep(30)
  assert.equal(buttons().length, 0)
  assert.deepEqual(texts(), ['Очередь задач пуста'])
  page.onDestroy()
})

console.log('\nвсего: ' + n)
process.exit(0)
