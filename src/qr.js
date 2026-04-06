/**
 * Minimal QR code generator — returns an SVG string.
 * Supports alphanumeric/byte mode, error correction level L.
 * No external dependencies.
 */

// Galois field GF(256) tables
const EXP = new Uint8Array(256)
const LOG = new Uint8Array(256)
{
  let v = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = v
    LOG[v] = i
    v = (v << 1) ^ (v & 128 ? 0x11d : 0)
  }
  EXP[255] = EXP[0]
}

function gfMul(a, b) {
  return a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]
}

function polyMul(a, b) {
  const r = new Uint8Array(a.length + b.length - 1)
  for (let i = 0; i < a.length; i++)
    for (let j = 0; j < b.length; j++)
      r[i + j] ^= gfMul(a[i], b[j])
  return r
}

function rsEncode(data, ecLen) {
  let gen = Uint8Array.of(1)
  for (let i = 0; i < ecLen; i++)
    gen = polyMul(gen, Uint8Array.of(1, EXP[i]))
  const msg = new Uint8Array(data.length + ecLen)
  msg.set(data)
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i]
    if (coef !== 0)
      for (let j = 0; j < gen.length; j++)
        msg[i + j] ^= gfMul(gen[j], coef)
  }
  return msg.slice(data.length)
}

// Version configs: [totalCodewords, ecCodewordsPerBlock, numBlocks]
// Error correction level L only, versions 1-10
const VERSIONS = [
  null,
  [26, 7, 1], [44, 10, 1], [70, 15, 1], [100, 20, 1], [134, 26, 1],
  [172, 18, 2], [196, 20, 2], [242, 24, 2], [292, 30, 2], [346, 18, 2],
]

function chooseVersion(dataLen) {
  for (let v = 1; v <= 10; v++) {
    const [total, ecPerBlock, blocks] = VERSIONS[v]
    const dataCapacity = total - ecPerBlock * blocks
    if (dataLen <= dataCapacity) return v
  }
  throw new Error('Data too long for QR versions 1-10')
}

function encodeData(text) {
  // Byte mode
  const bytes = new TextEncoder().encode(text)
  const bits = []
  const push = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1) }

  const version = chooseVersion(bytes.length + 3) // mode + count + data rough estimate
  const [total, ecPerBlock, numBlocks] = VERSIONS[version]
  const dataCapacity = total - ecPerBlock * numBlocks

  push(0b0100, 4) // byte mode
  push(bytes.length, version <= 9 ? 8 : 16) // character count
  for (const b of bytes) push(b, 8)

  // Terminator
  const dataBits = dataCapacity * 8
  const termLen = Math.min(4, dataBits - bits.length)
  push(0, termLen)

  // Pad to byte boundary
  while (bits.length % 8 !== 0) bits.push(0)

  // Pad codewords
  const pads = [0xec, 0x11]
  let pi = 0
  while (bits.length < dataBits) {
    push(pads[pi], 8)
    pi ^= 1
  }

  // Convert to bytes
  const data = new Uint8Array(dataCapacity)
  for (let i = 0; i < dataCapacity; i++) {
    let byte = 0
    for (let b = 0; b < 8; b++) byte = (byte << 1) | (bits[i * 8 + b] || 0)
    data[i] = byte
  }

  // Split into blocks and generate EC
  const blockDataLen = Math.floor(dataCapacity / numBlocks)
  const longBlocks = dataCapacity % numBlocks
  const dataBlocks = []
  const ecBlocks = []
  let offset = 0
  for (let i = 0; i < numBlocks; i++) {
    const len = blockDataLen + (i >= numBlocks - longBlocks ? 1 : 0)
    const block = data.slice(offset, offset + len)
    dataBlocks.push(block)
    ecBlocks.push(rsEncode(block, ecPerBlock))
    offset += len
  }

  // Interleave
  const result = []
  const maxDataLen = blockDataLen + (longBlocks > 0 ? 1 : 0)
  for (let i = 0; i < maxDataLen; i++)
    for (const block of dataBlocks)
      if (i < block.length) result.push(block[i])
  for (let i = 0; i < ecPerBlock; i++)
    for (const block of ecBlocks)
      result.push(block[i])

  return { version, codewords: result }
}

function createMatrix(version) {
  const size = version * 4 + 17
  const matrix = Array.from({ length: size }, () => new Int8Array(size)) // 0=unset, 1=black, -1=white
  const reserved = Array.from({ length: size }, () => new Uint8Array(size))

  function setModule(r, c, val) {
    matrix[r][c] = val ? 1 : -1
    reserved[r][c] = 1
  }

  // Finder patterns
  function finderPattern(row, col) {
    for (let dr = -1; dr <= 7; dr++)
      for (let dc = -1; dc <= 7; dc++) {
        const r = row + dr, c = col + dc
        if (r < 0 || r >= size || c < 0 || c >= size) continue
        const inOuter = dr === -1 || dr === 7 || dc === -1 || dc === 7
        const inRing = dr === 0 || dr === 6 || dc === 0 || dc === 6
        const inInner = dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4
        setModule(r, c, !inOuter && (inRing || inInner))
      }
  }

  finderPattern(0, 0)
  finderPattern(0, size - 7)
  finderPattern(size - 7, 0)

  // Alignment pattern (version >= 2)
  if (version >= 2) {
    const pos = [6, version * 4 + 10] // simplified for v2-10
    for (const r of pos)
      for (const c of pos) {
        if (reserved[r]?.[c]) continue
        for (let dr = -2; dr <= 2; dr++)
          for (let dc = -2; dc <= 2; dc++)
            setModule(r + dr, c + dc, Math.abs(dr) === 2 || Math.abs(dc) === 2 || (dr === 0 && dc === 0))
      }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0)
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0)
  }

  // Dark module
  setModule(size - 8, 8, true)

  // Reserve format info areas
  for (let i = 0; i < 8; i++) {
    if (!reserved[8][i]) { reserved[8][i] = 1; matrix[8][i] = -1 }
    if (!reserved[8][size - 1 - i]) { reserved[8][size - 1 - i] = 1; matrix[8][size - 1 - i] = -1 }
    if (!reserved[i][8]) { reserved[i][8] = 1; matrix[i][8] = -1 }
    if (!reserved[size - 1 - i][8]) { reserved[size - 1 - i][8] = 1; matrix[size - 1 - i][8] = -1 }
  }
  if (!reserved[8][8]) { reserved[8][8] = 1; matrix[8][8] = -1 }

  return { matrix, reserved, size }
}

function placeData(matrix, reserved, size, codewords) {
  const bits = []
  for (const cw of codewords)
    for (let i = 7; i >= 0; i--) bits.push((cw >> i) & 1)

  let bitIdx = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5 // skip timing column
    const rows = upward ? Array.from({ length: size }, (_, i) => size - 1 - i) : Array.from({ length: size }, (_, i) => i)
    for (const row of rows) {
      for (const col of [right, right - 1]) {
        if (!reserved[row][col]) {
          matrix[row][col] = (bits[bitIdx] || 0) ? 1 : -1
          bitIdx++
        }
      }
    }
    upward = !upward
  }
}

function applyMask(matrix, reserved, size, maskNum) {
  const maskFn = [
    (r, c) => (r + c) % 2 === 0,
    (r, c) => r % 2 === 0,
    (r, c) => c % 3 === 0,
    (r, c) => (r + c) % 3 === 0,
    (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
    (r, c) => (r * c) % 2 + (r * c) % 3 === 0,
    (r, c) => ((r * c) % 2 + (r * c) % 3) % 2 === 0,
    (r, c) => ((r + c) % 2 + (r * c) % 3) % 2 === 0,
  ][maskNum]

  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (!reserved[r][c] && maskFn(r, c))
        matrix[r][c] = matrix[r][c] === 1 ? -1 : 1
}

function placeFormatInfo(matrix, size, maskNum) {
  // Format info for EC level L (01) and mask pattern
  const FORMAT_BITS = [
    0x77c4, 0x72f3, 0x7daa, 0x789d, 0x662f, 0x6318, 0x6c41, 0x6976,
  ]
  const bits = FORMAT_BITS[maskNum]

  for (let i = 0; i < 6; i++) matrix[8][i] = (bits >> (14 - i)) & 1 ? 1 : -1
  matrix[8][7] = (bits >> 8) & 1 ? 1 : -1
  matrix[8][8] = (bits >> 7) & 1 ? 1 : -1
  matrix[7][8] = (bits >> 6) & 1 ? 1 : -1
  for (let i = 0; i < 6; i++) matrix[5 - i][8] = (bits >> (i + 9)) & 1 ? 1 : -1

  for (let i = 0; i < 8; i++) matrix[8][size - 1 - i] = (bits >> i) & 1 ? 1 : -1
  for (let i = 0; i < 7; i++) matrix[size - 1 - i][8] = (bits >> (14 - i)) & 1 ? 1 : -1
}

function penalty(matrix, size) {
  let score = 0
  // Rule 1: runs of same color
  for (let r = 0; r < size; r++) {
    let run = 1
    for (let c = 1; c < size; c++) {
      if (matrix[r][c] === matrix[r][c - 1]) run++
      else { if (run >= 5) score += run - 2; run = 1 }
    }
    if (run >= 5) score += run - 2
  }
  for (let c = 0; c < size; c++) {
    let run = 1
    for (let r = 1; r < size; r++) {
      if (matrix[r][c] === matrix[r - 1][c]) run++
      else { if (run >= 5) score += run - 2; run = 1 }
    }
    if (run >= 5) score += run - 2
  }
  return score
}

export function generateQrSvg(text, { size: svgSize = 200, margin = 2, fg = '#ffffff', bg = 'transparent' } = {}) {
  const { version, codewords } = encodeData(text)
  const { matrix, reserved, size } = createMatrix(version)
  placeData(matrix, reserved, size, codewords)

  // Try all masks, pick best
  let bestMask = 0, bestScore = Infinity
  for (let m = 0; m < 8; m++) {
    const copy = matrix.map(r => Int8Array.from(r))
    applyMask(copy.map((r, i) => { matrix[i] = r; return r }), reserved, size, m)
    // Restore for scoring
    const testMatrix = matrix.map(r => Int8Array.from(r))
    placeFormatInfo(testMatrix, size, m)
    const s = penalty(testMatrix, size)
    if (s < bestScore) { bestScore = s; bestMask = m }
    // Reset
    for (let r = 0; r < size; r++) matrix[r].set(copy[r])
  }

  applyMask(matrix, reserved, size, bestMask)
  placeFormatInfo(matrix, size, bestMask)

  const totalSize = size + margin * 2
  const cellSize = svgSize / totalSize
  let paths = ''
  for (let r = 0; r < size; r++)
    for (let c = 0; c < size; c++)
      if (matrix[r][c] === 1)
        paths += `M${c + margin},${r + margin}h1v1h-1z`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${svgSize}" height="${svgSize}">` +
    (bg !== 'transparent' ? `<rect width="${totalSize}" height="${totalSize}" fill="${bg}"/>` : '') +
    `<path d="${paths}" fill="${fg}"/></svg>`
}
