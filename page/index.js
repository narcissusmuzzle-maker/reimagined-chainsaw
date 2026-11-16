/**
 * «Задачи 2» (🧩) для Amazfit Bip Max: очередь задач из приложения LuvU613 (ОЧЕРЕДЬ -> ЗАДАЧИ) на часах, версия со строками.
 *
 *  - Задачи идут сверху вниз, порядок = порядок очереди на телефоне. Карточка: слева эмодзи вкладки, затем обычный горизонтальный текст,
 *    справа вплотную цветная полоска из трёх узких частей (цвета и порядок слева направо — как у квадратиков на телефоне).
 *    Текст не помещается в одну строку — идёт на вторую; больше двух строк нет, лишнее просто отрезается (без «…»). У двухстрочной задачи
 *    карточка выше, а цветная полоска растягивается на всю высоту. Размеры — в shared/layout.js.
 *  - Свайп вверх / вниз прокручивает список (на SCROLL_STEP задач). Свайп вправо — обычный выход из приложения.
 *  - ДОЛГОЕ нажатие на задачу — задача выполнена: пропадает с экрана сразу, на телефон уходит событие «tdone»
 *    (пересылается, пока телефон не подтвердит; на телефоне задача становится выполненной, как при нажатии на цветные квадратики).
 *  - Список приходит с телефона при каждом открытии приложения (оно открывается заново при включении экрана) и в ответ на каждое
 *    событие, которое отправили часы. Последний список запоминается, поэтому без связи на экране остаётся то, что было.
 *  - Системная полоска сверху скрыта (setStatusBarVisible), прокрутка страницы заблокирована (setScrollLock), а место полоски занято
 *    приложением: весь экран сдвинут вверх на LIFT px — точно так же, как в приложении «Таймер» (см. DOWN ниже);
 *    по горизонтали всё сдвинуто влево на 18 px (SHIFT_X), как в U613 Stat, чтобы экран стоял ровно по центру.
 *
 * Текст рисуют сами часы (системным шрифтом), а где переносить строку, считает страница: ширину строки узнаёт у часов (getTextLayout),
 * поэтому перенос и обрезка точно совпадают с тем, как строка будет нарисована. Часы не умеют менять содержимое готового виджета надёжно,
 * поэтому при любой смене экрана виджеты задач удаляются и создаются заново.
 */
import { BasePage } from '@zeppos/zml/base-page'
import { createWidget, deleteWidget, getTextLayout, widget, align, text_style, setStatusBarVisible } from '@zos/ui'
import { setScrollLock } from '@zos/page'
import { Vibrator } from '@zos/sensor'
import * as sensor from '@zos/sensor'
import { setWakeUpRelaunch } from '@zos/display'
import { LocalStorage } from '@zos/storage'
import * as inter from '@zos/interaction'
import * as lay from '../shared/layout'
import * as T from '../shared/tasks'

const SEND_GAP = 15000          // как часто повторять отправку неподтверждённого события, мс
const SYNC_RETRY = 15000        // пока список с телефона ни разу не пришёл — как часто повторять запрос, мс
const SWIPE_GAP = 250           // повторный свайп раньше чем через столько мс игнорируется (система иногда присылает событие дважды)
const SWIPE_EXIT = true         // true — свайп вправо закрывает приложение (обычное поведение часов)
const VIBRATE = true            // короткая вибрация при выполнении задачи
const FIT_MARGIN = 2            // запас по ширине строки, px: чтобы последний знак не обрезался из-за округления

// Положение экрана по вертикали — то же число и тот же приём, что в приложении «Таймер» (page/index.js там).
// Система считает верхние 64 px полоской: если её просто скрыть, на её месте остаётся чёрная пустота, а низ страницы обрезается.
// Поэтому весь экран (514 px) рисуется со сдвигом вверх на LIFT, то есть в координатах страницы от y = -LIFT.
//
// ===== ВОТ ЭТО ЧИСЛО МЕНЯТЬ, ЧТОБЫ ДВИГАТЬ ВЕСЬ ЭКРАН ПО ВЕРТИКАЛИ =====
// DOWN — на сколько пикселей опустить весь экран от полностью поднятого положения. Допустимо от 0 до 64.
//   Сверху обрезано (первая карточка не видна целиком) — число БОЛЬШЕ, например 45.
//   Снизу обрезано (последняя карточка прижата к краю) — число МЕНЬШЕ, например 20. Больше ничего менять не надо.
const DOWN = 33
const LIFT = 64 - DOWN
const DY = -LIFT

// ===== СДВИГ ВСЕГО ЭКРАНА ПО ГОРИЗОНТАЛИ — то же число и тот же приём, что в U613 Stat (SHIFT_X там) =====
// Страница приложения на часах стоит правее центра экрана, поэтому всё рисуется со сдвигом влево: минус — влево, плюс — вправо, в пикселях.
//   Справа обрезано — число МЕНЬШЕ (например -22), слева обрезано — БОЛЬШЕ (например -14). Двигаются сразу все карточки.
const SHIFT_X = -18
const DX = SHIFT_X

// ---------------------------------------------------------------------------------------------------------------------

let ls = null
const mem = {}
const store = {
  getItem(k, d) {
    try { if (ls) { const v = ls.getItem(k, d); return v === undefined || v === null ? d : v } } catch (e) { fail('getItem ' + e) }
    return k in mem ? mem[k] : d
  },
  setItem(k, v) {
    mem[k] = v
    try { if (ls) ls.setItem(k, v) } catch (e) { fail('setItem ' + e) }
  }
}

// Ошибки показываем на экране (а не оставляем чёрный экран): без этого на часах их не увидеть
let failed = 0
function fail(msg) {
  failed++
  if (failed > 3) return
  try {
    createWidget(widget.FILL_RECT, { x: DX, y: DY, w: 432, h: 514, color: 0x300000 })
    createWidget(widget.TEXT, {
      x: DX + 12, y: DY + 12 + (failed - 1) * 150, w: 408, h: 140, color: 0xffffff, text_size: 22,
      align_h: align.LEFT, align_v: align.TOP, text_style: text_style.WRAP, text: 'Ошибка ' + failed + ': ' + String(msg).slice(0, 160)
    })
  } catch (e) { /* больше показать нечем */ }
}
function guard(name, f) {
  try { return f() } catch (e) { fail(name + ': ' + e); return undefined }
}

let ST = null            // состояние (хранится): задачи с телефона, сдвиг списка, неподтверждённые завершения
let me = null
let timer = null
let vib = null
let dyn = []             // виджеты задач на экране (удаляются и создаются заново при любой перерисовке)
let msgW = null          // надпись, когда задач нет
let inflight = false
let inflightAt = 0
let syncing = false
let syncAt = 0
let synced = false       // список с телефона уже приходил в этот раз
let linkFail = false     // последний запрос к телефону не удался
let lastSwipe = 0
const wrapCache = {}     // текст -> строки (одна или две)

function save() {
  try { store.setItem('st', T.serialize(ST)) } catch (e) { /* без сохранения продолжаем работать */ }
}

function vibrate(mode) {
  try {
    if (!vib) vib = new Vibrator()
    vib.start({ mode: mode })
  } catch (e) {
    try { vib.setMode({ mode: mode }); vib.start() } catch (e2) { /* нет вибромотора */ }
  }
}

function buzz() {
  if (!VIBRATE) return
  const m = sensor.VIBRATOR_SCENE_SHORT_LIGHT
  if (m === undefined) return
  vibrate(m)
}

/** Системная полоска сверху скрыта, прокрутка страницы заблокирована. */
function applyBar() {
  try { setStatusBarVisible(false) } catch (e) { /* не квадратный экран — полоски нет */ }
  try { setScrollLock({ lock: true }) } catch (e) { /* не критично */ }
}

// ---------------------------------------------------------------------------------------------------------------------
// Текст: ширина строки и перенос
// ---------------------------------------------------------------------------------------------------------------------

let estimate = false     // getTextLayout не работает — считаем ширину приблизительно
function measure(s) {
  if (!estimate) {
    try {
      const r = getTextLayout(s, { text_size: lay.TEXT_SIZE, text_width: 4000, wrapped: 0 })
      if (r && typeof r.width === 'number') return r.width
    } catch (e) { /* ниже */ }
    estimate = true
  }
  return s.length * lay.TEXT_SIZE * 0.56
}

/** Строки задачи (одна или две): считаются один раз на каждый текст. */
function linesOf(task) {
  let l = wrapCache[task.x]
  if (!l) {
    l = T.wrapText(task.x, lay.textWidth() - FIT_MARGIN, measure)
    wrapCache[task.x] = l
  }
  return l
}

// ---------------------------------------------------------------------------------------------------------------------
// Рисование
// ---------------------------------------------------------------------------------------------------------------------

function clearDyn() {
  for (let k = 0; k < dyn.length; k++) {
    try { deleteWidget(dyn[k]) } catch (e) { /* уже удалён */ }
  }
  dyn = []
  if (msgW) {
    try { deleteWidget(msgW) } catch (e) { /* уже удалён */ }
    msgW = null
  }
}

function rect(r, color) {
  dyn.push(createWidget(widget.FILL_RECT, { x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, color: color }))
}

/** Одна карточка: фон, три части полоски на всю высоту, эмодзи, одна или две строки текста. */
function drawRow(item, task, lines) {
  const y = item.y
  rect(lay.cardRect(y, item.lines), lay.CARD)
  for (let s = 0; s < 3; s++) rect(lay.segRect(y, item.lines, s), lay.segColor(task.c[s]))
  if (task.e >= 0) {
    const r = lay.emojiRect(y)
    dyn.push(createWidget(widget.IMG, { x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, src: 'e' + task.e + '.png' }))
  }
  for (let i = 0; i < lines.length; i++) {
    if (!lines[i]) continue
    const r = lay.lineRect(y, i)
    dyn.push(createWidget(widget.TEXT, {
      x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, color: lay.TEXT_COLOR, text_size: lay.TEXT_SIZE,
      align_h: align.LEFT, align_v: align.CENTER_V, text: lines[i]
    }))
  }
}

/** Прозрачная кнопка на всю карточку (создаётся после всех карточек, чтобы лежать выше): долгое нажатие — задача выполнена. */
function drawButton(item, task) {
  const id = task.i
  const r = lay.cardRect(item.y, item.lines)
  dyn.push(createWidget(widget.BUTTON, {
    x: r.x + DX, y: r.y + DY, w: r.w, h: r.h, text: '',
    normal_src: 'tz' + item.lines + '.png', press_src: 'tp' + item.lines + '.png',
    click_func: () => { /* обычное нажатие ничего не делает */ },
    longpress_func: () => { guard('долгое', () => me.done(id)) }
  }))
}

function showMessage(text) {
  msgW = createWidget(widget.TEXT, {
    x: DX + 24, y: DY + 180, w: 384, h: 154, color: 0x8c8c8c, text_size: 30,
    align_h: align.CENTER_H, align_v: align.CENTER_V, text_style: text_style.WRAP, text: text
  })
}

/** Сколько строк у каждой из показанных задач (по порядку). */
function lineCounts(list) {
  const c = []
  for (let k = 0; k < list.length; k++) c.push(linesOf(list[k]).length)
  return c
}

function redraw() {
  clearDyn()
  const list = T.shownTasks(ST)
  const counts = lineCounts(list)
  ST.off = T.clampOffset(ST.off, counts)
  const items = T.pack(counts, ST.off)
  for (let k = 0; k < items.length; k++) {
    const it = items[k]
    guard('карточка ' + k, () => drawRow(it, list[it.idx], linesOf(list[it.idx])))
  }
  for (let k = 0; k < items.length; k++) {
    const it = items[k]
    guard('кнопка ' + k, () => drawButton(it, list[it.idx]))
  }
  if (!list.length) {
    if (synced) showMessage('Очередь задач пуста')
    else if (linkFail) showMessage('Нет связи с телефоном')
    else showMessage('Загрузка…')
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Жесты
// ---------------------------------------------------------------------------------------------------------------------

/** Свайпы: вверх / вниз — прокрутка. Возвращает true — «система, не обрабатывай». */
function onSwipe(e) {
  if (e === inter.GESTURE_RIGHT) return !SWIPE_EXIT     // свайп вправо — обычный выход из приложения
  if (e === inter.GESTURE_UP || e === inter.GESTURE_DOWN) {
    const now = Date.now()
    if (now - lastSwipe < SWIPE_GAP) return true
    lastSwipe = now
    const counts = lineCounts(T.shownTasks(ST))
    const off = T.scrolled(ST.off, e === inter.GESTURE_UP ? 1 : -1, counts)
    if (off !== ST.off) {
      ST.off = off
      redraw()
    }
    return true
  }
  return true   // свайп влево ничего не делает
}

function setupGestures() {
  try {
    inter.onGesture({
      callback: function (e) {
        const swipe = e === inter.GESTURE_RIGHT || e === inter.GESTURE_LEFT || e === inter.GESTURE_UP || e === inter.GESTURE_DOWN
        if (!swipe) return false
        return guard('жест', () => onSwipe(e))
      }
    })
  } catch (e) { /* без обработки жестов */ }
}

// ---------------------------------------------------------------------------------------------------------------------

/** Новый список с телефона (в ответе на запрос или на событие). */
function takeList(raw) {
  if (!Array.isArray(raw)) return
  const list = T.cleanTasks(raw)
  const changed = T.applyTasks(ST, list)
  save()
  if (changed) redraw()
}

Page(
  BasePage({
    onInit() {
      try { if (!ls) ls = new LocalStorage() } catch (e) { /* ошибка покажется в build */ }
      applyBar()   // полоска скрывается до построения экрана, чтобы страница сразу получила весь экран
    },

    build() {
      me = this
      guard('старт', () => { ls = new LocalStorage() })
      applyBar()
      guard('открытие', () => setWakeUpRelaunch({ relaunch: true }))   // при включении экрана приложение открывается заново и обновляет список
      ST = guard('состояние', () => T.restore(store.getItem('st', ''))) || T.newState()
      ST.off = 0                                                      // каждое открытие — с начала очереди
      for (let k = 0; k < ST.pend.length; k++) ST.pend[k].tried = 0   // новое открытие: неподтверждённые завершения отправляются сразу, а не через SEND_GAP
      setupGestures()
      guard('экран', redraw)
      applyBar()   // ещё раз после построения: прокрутка заблокирована при любом размере содержимого
      guard('отправка', () => this.sendDue(Date.now()))
      guard('телефон', () => this.syncPhone(true))
      timer = setInterval(() => { guard('секунда', () => this.tick()) }, 1000)
    },

    onDestroy() {
      if (timer) { clearInterval(timer); timer = null }
      save()
    },

    tick() {
      const now = Date.now()
      if (!synced && now - syncAt >= SYNC_RETRY) this.syncPhone(false)
      if (ST.pend.length) this.sendDue(now)
    },

    /** Долгое нажатие на задачу: задача выполнена. Перерисовка — чуть позже, потому что кнопка, на которую нажали, сама удаляется. */
    done(taskId) {
      const now = Date.now()
      const id = T.complete(ST, taskId, now)
      if (!id) return
      buzz()
      save()
      setTimeout(() => { guard('экран', redraw) }, 40)
      this.sendDue(now)
    },

    /** Спросить у телефона очередь задач. */
    syncPhone(force) {
      const now = Date.now()
      if (!force && syncing && now - syncAt < 30000) return
      syncing = true
      syncAt = now
      this.request({ method: 'u613.send', params: { t: 'tasks' } })
        .then((res) => {
          syncing = false
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'tasks' && Array.isArray(r.q)) {
            const first = !synced
            synced = true
            linkFail = false
            takeList(r.q)
            if (first && !T.shownTasks(ST).length) guard('экран', redraw)   // «Загрузка…» → «Очередь задач пуста»
          } else {
            linkFail = true
            if (!T.shownTasks(ST).length) guard('экран', redraw)
          }
        })
        .catch(() => {
          syncing = false
          linkFail = true
          if (!T.shownTasks(ST).length) guard('экран', redraw)
        })
    },

    /** Отправить телефону одно неподтверждённое завершение (по одному за раз). */
    sendDue(now) {
      if (inflight && now - inflightAt < 30000) return
      const owner = ST
      const d = T.due(owner, now, SEND_GAP)
      if (!d.length) return
      const target = d[0]
      target.tried = now
      inflight = true
      inflightAt = now
      const id = target.id
      this.request({ method: 'u613.send', params: { t: 'tdone', id: id, tid: target.tid, ts: target.ts } })
        .then((res) => {
          inflight = false
          const r = res && res.ok ? res.reply : null
          if (r && r.t === 'ack' && r.id === id) {
            T.ack(owner, id)
            synced = true
            linkFail = false
            if (Array.isArray(r.q)) takeList(r.q)
            else { save(); guard('экран', redraw) }
            this.sendDue(Date.now())
          }
        })
        .catch(() => { inflight = false })
    }
  })
)
