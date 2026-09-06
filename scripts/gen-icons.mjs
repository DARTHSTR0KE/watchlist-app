import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

// Minimal PNG encoder: writes a solid background with a centered circle.
// Used only to produce temporary placeholder icons.

function crc32(buf) {
  let c
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256)
    for (let n = 0; n < 256; n++) {
      c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      t[n] = c >>> 0
    }
    return t
  })())
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function makePng(size, bgHex, fgHex, { fullBleed = false } = {}) {
  const [br, bg, bb] = hexToRgb(bgHex)
  const [fr, fg, fb] = hexToRgb(fgHex)
  const cx = size / 2
  const cy = size / 2
  // Maskable icons need content within the safe zone (inner ~80%); for a
  // regular icon we can let the circle fill most of the canvas.
  const radius = fullBleed ? size * 0.32 : size * 0.36

  const rowBytes = size * 3
  const raw = Buffer.alloc((rowBytes + 1) * size)
  let pos = 0
  for (let y = 0; y < size; y++) {
    raw[pos++] = 0 // filter type: none
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const inCircle = dx * dx + dy * dy <= radius * radius
      if (inCircle) {
        raw[pos++] = fr
        raw[pos++] = fg
        raw[pos++] = fb
      } else {
        raw[pos++] = br
        raw[pos++] = bg
        raw[pos++] = bb
      }
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // color type: truecolor
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = deflateSync(raw)

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const THEME_BG = '#101014'
const THEME_FG = '#f5c451'

mkdirSync('public/icons', { recursive: true })

writeFileSync('public/icons/icon-192.png', makePng(192, THEME_BG, THEME_FG))
writeFileSync('public/icons/icon-512.png', makePng(512, THEME_BG, THEME_FG))
writeFileSync('public/icons/icon-maskable-512.png', makePng(512, THEME_BG, THEME_FG, { fullBleed: true }))

console.log('Placeholder icons written to public/icons/')
