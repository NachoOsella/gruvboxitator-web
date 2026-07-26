export type RGB = [number, number, number]

export interface Preset {
  id: string
  name: string
  label: string
  description: string
  strength: number
  contrast: number
  colorStrength: number
  warmth: number
  grain: number
  vignette: number
  sharpen: number
}

export const palette = {
  bg0: "#1d2021", bg1: "#282828", bg2: "#32302f", bg3: "#3c3836",
  bg4: "#45403d", bg5: "#504945", fg0: "#d4be98", fg1: "#ddc7a1",
  fg2: "#c7b188", red: "#ea6962", orange: "#e78a4e", yellow: "#d8a657",
  green: "#a9b665", aqua: "#89b482", blue: "#7daea3", purple: "#d3869b",
} as const

export const presets: Preset[] = [
  { id: "1", name: "dark-hard", label: "Dark Hard", description: "Equilibrado y nítido", strength: 1, contrast: 1.18, colorStrength: .62, warmth: .01, grain: .004, vignette: .32, sharpen: .7 },
  { id: "2", name: "dark-hard-gray", label: "Carbon", description: "Gris y desaturado", strength: 1, contrast: 1.14, colorStrength: .14, warmth: 0, grain: .0025, vignette: .22, sharpen: .6 },
  { id: "3", name: "dark-hard-cinematic", label: "Cinema", description: "Contraste y viñeta", strength: 1, contrast: 1.32, colorStrength: .86, warmth: .03, grain: .007, vignette: .48, sharpen: .9 },
  { id: "4", name: "dark-hard-soft", label: "Soft", description: "Conserva el original", strength: .72, contrast: 1.04, colorStrength: .4, warmth: .006, grain: .0015, vignette: .1, sharpen: .35 },
]

const ramp: Array<[number, keyof typeof palette]> = [[0, "bg0"], [.13, "bg1"], [.28, "bg2"], [.45, "bg3"], [.62, "bg4"], [.78, "fg2"], [.92, "fg0"], [1, "fg1"]]
const accentNames: Array<keyof typeof palette> = ["red", "orange", "yellow", "green", "aqua", "blue", "purple"]

const hexToRgb = (value: string): RGB => [parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16)]
const paletteRgb = Object.fromEntries(Object.entries(palette).map(([key, value]) => [key, hexToRgb(value)])) as Record<keyof typeof palette, RGB>
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))
const clamp255 = (value: number) => Math.max(0, Math.min(255, Math.round(value)))
const mix = (a: RGB, b: RGB, amount: number): RGB => {
  const t = clamp01(amount)
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
}
const luminance = (color: RGB) => (.2126 * color[0] + .7152 * color[1] + .0722 * color[2]) / 255
const softLight = (a: number, b: number) => b < .5 ? 2 * a * b + a * a * (1 - 2 * b) : 2 * a * (1 - b) + Math.sqrt(Math.max(a, 0)) * (2 * b - 1)

function rgbToHls(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255, gn = g / 255, bn = b / 255
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), light = (max + min) / 2
  if (max === min) return [0, light, 0]
  const delta = max - min
  const saturation = light > .5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = max === rn ? (gn - bn) / delta + (gn < bn ? 6 : 0) : max === gn ? (bn - rn) / delta + 2 : (rn - gn) / delta + 4
  hue /= 6
  return [hue, light, saturation]
}

function tonalColor(value: number): RGB {
  const t = clamp01(value)
  for (let index = 0; index < ramp.length - 1; index++) {
    const [start, startName] = ramp[index], [end, endName] = ramp[index + 1]
    if (t <= end) {
      let local = end === start ? 0 : (t - start) / (end - start)
      local = local * local * (3 - 2 * local)
      return mix(paletteRgb[startName], paletteRgb[endName], local)
    }
  }
  return paletteRgb.fg1
}

function nearestAccent(r: number, g: number, b: number): RGB {
  const [hue] = rgbToHls(r, g, b)
  let best = paletteRgb.red, bestDistance = Infinity
  for (const name of accentNames) {
    const color = paletteRgb[name]
    const [candidateHue] = rgbToHls(...color)
    const rawDistance = Math.abs(hue - candidateHue)
    const distance = Math.min(rawDistance, 1 - rawDistance)
    if (distance < bestDistance) { bestDistance = distance; best = color }
  }
  return best
}

function percentileBounds(data: Uint8ClampedArray): [number, number] {
  const histogram = new Uint32Array(256)
  for (let index = 0; index < data.length; index += 4) histogram[Math.round(.299 * data[index] + .587 * data[index + 1] + .114 * data[index + 2])]++
  const total = data.length / 4
  const find = (target: number) => { let sum = 0; for (let i = 0; i < 256; i++) { sum += histogram[i]; if (sum >= target) return i } return 255 }
  const low = find(total * .006), high = find(total * .994)
  return high <= low ? [0, 255] : [low, high]
}

function enhanceContrast(data: Uint8ClampedArray, factor: number) {
  for (let index = 0; index < data.length; index += 4) for (let channel = 0; channel < 3; channel++) data[index + channel] = clamp255(128 + factor * (data[index + channel] - 128))
}

function gaussianKernel(sigma: number) {
  const radius = Math.ceil(sigma * 2), kernel = new Float64Array(radius * 2 + 1)
  let total = 0
  for (let index = -radius; index <= radius; index++) { const value = Math.exp(-(index * index) / (2 * sigma * sigma)); kernel[index + radius] = value; total += value }
  for (let index = 0; index < kernel.length; index++) kernel[index] /= total
  return { kernel, radius }
}

function unsharpMask(data: Uint8ClampedArray, width: number, height: number, sigma: number, percent: number, threshold: number) {
  const { kernel, radius } = gaussianKernel(sigma)
  const horizontal = new Float32Array(data.length), blurred = new Float32Array(data.length)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 3; channel++) {
    let sum = 0
    for (let offset = -radius; offset <= radius; offset++) sum += data[(y * width + Math.max(0, Math.min(width - 1, x + offset))) * 4 + channel] * kernel[offset + radius]
    horizontal[(y * width + x) * 4 + channel] = sum
  }
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) for (let channel = 0; channel < 3; channel++) {
    let sum = 0
    for (let offset = -radius; offset <= radius; offset++) sum += horizontal[(Math.max(0, Math.min(height - 1, y + offset)) * width + x) * 4 + channel] * kernel[offset + radius]
    blurred[(y * width + x) * 4 + channel] = sum
  }
  const amount = percent / 100
  for (let index = 0; index < data.length; index += 4) for (let channel = 0; channel < 3; channel++) {
    const difference = data[index + channel] - blurred[index + channel]
    if (Math.abs(difference) > threshold) data[index + channel] = clamp255(data[index + channel] + difference * amount)
  }
}

const seededRandom = () => {
  let state = 0x67727576
  return () => { state = (state + 0x6d2b79f5) | 0; let value = Math.imul(state ^ state >>> 15, 1 | state); value = value + Math.imul(value ^ value >>> 7, 61 | value) ^ value; return ((value ^ value >>> 14) >>> 0) / 4294967296 }
}

export async function gruvboxitate(source: ImageData, preset: Preset, onProgress?: (value: number) => void): Promise<ImageData> {
  const { width, height } = source
  const data = new Uint8ClampedArray(source.data)
  enhanceContrast(data, preset.contrast)
  if (preset.sharpen > 0) unsharpMask(data, width, height, 1.35, Math.trunc(90 * preset.sharpen), 3)
  onProgress?.(22)
  await new Promise(requestAnimationFrame)
  const [low, high] = percentileBounds(data)
  const centerX = (width - 1) / 2, centerY = (height - 1) / 2
  const maxDistance = Math.hypot(centerX, centerY) || 1
  const random = seededRandom(), bg0 = paletteRgb.bg0, bg1 = paletteRgb.bg1, yellow = paletteRgb.yellow, bg0Luma = luminance(bg0)
  for (let index = 0; index < data.length; index += 4) {
    const r = data[index], g = data[index + 1], b = data[index + 2]
    const y = (.2126 * r + .7152 * g + .0722 * b) / 255
    const normalized = Math.pow(clamp01((y * 255 - low) / Math.max(1, high - low)), .92)
    let t = softLight(.72 * clamp01(y) + .28 * normalized, .53)
    if (preset.vignette > 0) {
      const pixel = index / 4, x = pixel % width, py = Math.floor(pixel / width)
      t *= 1 - preset.vignette * Math.pow(Math.hypot(x - centerX, py - centerY) / maxDistance, 1.65)
    }
    const [, , saturation] = rgbToHls(r, g, b)
    let accentMix = clamp01((saturation - .05) / .55) * preset.colorStrength
    if (y > .62) accentMix *= .72
    if (y < .2) accentMix *= .55
    let colored = mix(tonalColor(t), nearestAccent(r, g, b), accentMix)
    colored = mix(colored, yellow, preset.warmth * Math.pow(t, 1.8))
    const currentLuma = Math.max(luminance(colored), 1e-5)
    const scale = Math.pow((.035 + .7 * t) / currentLuma, .72)
    colored = mix(colored, colored.map(channel => clamp255(channel * scale)) as RGB, .74)
    if (t < .4) colored = mix(colored, mix(bg0, bg1, clamp01(t / .4)), Math.pow(1 - t / .4, .55))
    let final = mix([r, g, b], colored, preset.strength)
    if (luminance(final) < bg0Luma) final = bg0
    if (preset.grain > 0) {
      const noise = (random() - .5) * 255 * preset.grain
      final = [final[0] + noise, final[1] + noise * .94, final[2] + noise * .82]
    }
    data[index] = clamp255(final[0]); data[index + 1] = clamp255(final[1]); data[index + 2] = clamp255(final[2]); data[index + 3] = 255
    if (index > 0 && index % (width * 4 * 200) === 0) onProgress?.(22 + Math.round(55 * index / data.length))
  }
  onProgress?.(80)
  await new Promise(requestAnimationFrame)
  enhanceContrast(data, 1.035)
  unsharpMask(data, width, height, .65, 38, 2)
  for (let index = 0; index < data.length; index += 4) if (luminance([data[index], data[index + 1], data[index + 2]]) < bg0Luma) { data[index] = bg0[0]; data[index + 1] = bg0[1]; data[index + 2] = bg0[2] }
  onProgress?.(100)
  return new ImageData(data, width, height)
}

export function createPaletteSwatch(): HTMLCanvasElement {
  const names: Array<keyof typeof palette> = ["bg0", "bg1", "bg2", "bg3", "bg4", "fg0", "red", "orange", "yellow", "green", "aqua", "blue", "purple"]
  const canvas = document.createElement("canvas"), cellWidth = 180, cellHeight = 84
  canvas.width = cellWidth * 4; canvas.height = cellHeight * Math.ceil(names.length / 4)
  const context = canvas.getContext("2d")!
  context.fillStyle = palette.bg0; context.fillRect(0, 0, canvas.width, canvas.height); context.font = "16px ui-monospace, monospace"
  names.forEach((name, index) => {
    const x = index % 4 * cellWidth, y = Math.floor(index / 4) * cellHeight
    context.fillStyle = palette[name]; context.fillRect(x, y, cellWidth, cellHeight)
    context.fillStyle = luminance(paletteRgb[name]) > .45 ? palette.bg0 : palette.fg0
    context.fillText(name, x + 10, y + 30); context.fillText(palette[name], x + 10, y + 56)
  })
  return canvas
}
