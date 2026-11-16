#!/usr/bin/env python3
"""
Генератор картинок для приложения «U613 Задачи 2». Запускать НЕ нужно: готовые файлы уже лежат в assets/default.w432-s/.
Скрипт оставлен, чтобы можно было пересоздать картинки. Нужны Pillow и шрифт Noto Color Emoji.

Что создаётся:
  e0..e8.png — эмодзи вкладок 38 × 38: 🏠 🍀 🔍 📖 🧬 💀 🤿 🎨 🩸
  tz1/tz2.png — почти прозрачные накладки на карточку (одна и две строки), ловят долгое нажатие; tp1/tp2.png — подсветка карточки при нажатии
  icon.png — иконка приложения 🧩
Текст на экране рисуют сами часы (системным шрифтом), картинок букв нет.
"""
import os
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'assets', 'default.w432-s')
NOTO = os.environ.get('NOTO', '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf')

EMOJI = ['\U0001F3E0', '\U0001F340', '\U0001F50D', '\U0001F4D6', '\U0001F9EC', '\U0001F480',
         '\U0001F93F', '\U0001F3A8', '\U0001FA78']
EMO_SIZE = 38
CARD_W = 428
CARD_H = {1: 58, 2: 92}               # высота карточки на одну и на две строки (shared/layout.js: cardH)


def render_emoji(ch, box):
    font = ImageFont.truetype(NOTO, 109)
    big = Image.new('RGBA', (160, 160), (0, 0, 0, 0))
    ImageDraw.Draw(big).text((10, 10), ch, font=font, embedded_color=True)
    big = big.crop(big.getbbox())
    s = box / max(big.size)
    return big.resize((max(1, round(big.width * s)), max(1, round(big.height * s))), Image.LANCZOS)


def build_emoji():
    for i, ch in enumerate(EMOJI):
        g = render_emoji(ch, EMO_SIZE)
        im = Image.new('RGBA', (EMO_SIZE, EMO_SIZE), (0, 0, 0, 0))
        im.alpha_composite(g, ((EMO_SIZE - g.width) // 2, (EMO_SIZE - g.height) // 2))
        im.save(os.path.join(OUT, 'e%d.png' % i), optimize=True)


def build_misc():
    for n, h in CARD_H.items():
        # alpha 1 из 255: на глаз не видно, но картинка не полностью прозрачная
        Image.new('RGBA', (CARD_W, h), (255, 255, 255, 1)).save(os.path.join(OUT, 'tz%d.png' % n), optimize=True)
        Image.new('RGBA', (CARD_W, h), (255, 255, 255, 36)).save(os.path.join(OUT, 'tp%d.png' % n), optimize=True)
    ic = Image.new('RGBA', (120, 120), (0, 0, 0, 0))
    m = Image.new('L', (120, 120), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 119, 119), radius=26, fill=255)
    ic.paste(Image.new('RGBA', (120, 120), (0x1C, 0x1C, 0x1C, 255)), (0, 0), m)
    g = render_emoji('\U0001F9E9', 84)
    ic.alpha_composite(g, ((120 - g.width) // 2, (120 - g.height) // 2))
    ic.save(os.path.join(OUT, 'icon.png'), optimize=True)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        os.remove(os.path.join(OUT, f))
    build_emoji()
    build_misc()
    print('готово: %d файлов' % len(os.listdir(OUT)))
