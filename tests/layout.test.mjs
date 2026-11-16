import assert from 'node:assert'
import * as lay from '../shared/layout.js'

let n = 0
function t(name, f) { f(); n++; console.log('ok  ' + name) }

t('рамки как у циферблата и U613 Stat: x = 26…406 по центру экрана, y = 48…464; одна строка 58 px, две строки 92 px', () => {
  const a = lay.cardRect(48, 1), b = lay.cardRect(110, 2)
  assert.equal(a.x, 26); assert.equal(a.w, 380); assert.equal(a.x + a.w, 406)
  assert.equal(a.x, lay.SCREEN_W - (a.x + a.w), 'поля слева и справа равны')
  assert.equal(lay.LIST_TOP, 48); assert.equal(lay.LIST_BOTTOM, 464)
  assert.equal(a.h, 58); assert.equal(b.h, 92)
})

t('на экран без прокрутки помещается шесть однострочных задач (или четыре двухстрочных)', () => {
  assert.equal(lay.LIST_H, 416)
  const six = 6 * lay.cardH(1) + 5 * lay.GAP
  assert.ok(six <= lay.LIST_H)
  assert.ok(7 * lay.cardH(1) + 6 * lay.GAP > lay.LIST_H)
})

t('полоска: 75 px справа вплотную к краю карточки, три части по 23 с зазорами 3', () => {
  assert.equal(3 * lay.SEG_LEN + 2 * lay.SEG_GAP, lay.STRIP_LEN)
  const s = [0, 1, 2].map((k) => lay.segRect(48, 1, k))
  assert.deepEqual(s.map((r) => r.x), [331, 357, 383])
  assert.equal(s[2].x + s[2].w, 406)
  assert.ok(s.every((r) => r.w === 23 && r.y === 48 && r.h === 58))
})

t('полоска растягивается на две строки: части на всю высоту двухстрочной карточки', () => {
  const s = lay.segRect(100, 2, 1)
  assert.equal(s.y, 100); assert.equal(s.h, 92)
})

t('эмодзи слева на уровне первой строки; текст между эмодзи и полоской', () => {
  const e = lay.emojiRect(48)
  assert.equal(e.x, 36); assert.equal(e.y, 58); assert.equal(e.w, 38)
  assert.equal(lay.textX(), 82)
  assert.equal(lay.textX() + lay.textWidth() + lay.TEXT_PAD, 331)   // дальше начинается полоска
  assert.equal(lay.textWidth(), 241)
})

t('строки текста: вторая ровно под первой', () => {
  const a = lay.lineRect(48, 0), b = lay.lineRect(48, 1)
  assert.equal(a.y, 60); assert.equal(b.y - a.y, lay.LINE_PITCH)
  assert.ok(b.y + b.h <= 48 + lay.cardH(2))
})

t('цвета сегментов: зелёный, жёлтый, красный как квадратики на телефоне', () => {
  assert.equal(lay.segColor(0), 0x3fb950)
  assert.equal(lay.segColor(1), 0xe3b341)
  assert.equal(lay.segColor(2), 0xf85149)
  assert.equal(lay.segColor('мусор'), 0x3fb950)
})

console.log('\nвсего: ' + n)
