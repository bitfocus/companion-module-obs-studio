import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const SIZE = 64
const SAMPLES = 4

// Baked-in colours, matching the `Color` palette in src/utils.ts. An image element cannot be
// recoloured at draw time, so each state is its own icon.
const WHITE = [225, 227, 230]
const RED = [200, 0, 0]
const GRAY = [110, 118, 130]

/** Signed-distance helpers, each returning true when the sample point is inside the shape. */
const rect = (x, y, w, h) => (px, py) => px >= x && px <= x + w && py >= y && py <= y + h

const roundedRect = (x, y, w, h, r) => (px, py) => {
	const dx = Math.max(x - px, 0, px - (x + w))
	const dy = Math.max(y - py, 0, py - (y + h))
	if (dx === 0 && dy === 0) return true
	const cx = Math.min(Math.max(px, x + r), x + w - r)
	const cy = Math.min(Math.max(py, y + r), y + h - r)
	return Math.hypot(px - cx, py - cy) <= r
}

const polygon = (points) => (px, py) => {
	let inside = false
	for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
		const [xi, yi] = points[i]
		const [xj, yj] = points[j]
		if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside
	}
	return inside
}

const segment = (x1, y1, x2, y2, width) => (px, py) => {
	const dx = x2 - x1
	const dy = y2 - y1
	const len = dx * dx + dy * dy
	const t = len === 0 ? 0 : Math.min(1, Math.max(0, ((px - x1) * dx + (py - y1) * dy) / len))
	return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy)) <= width / 2
}

/** An arc stroke: the band between two radii, limited to an angle range (degrees, 0 = east, clockwise). */
const arc = (cx, cy, radius, width, fromDeg, toDeg) => (px, py) => {
	const dist = Math.hypot(px - cx, py - cy)
	if (Math.abs(dist - radius) > width / 2) return false
	let angle = (Math.atan2(py - cy, px - cx) * 180) / Math.PI
	if (angle < 0) angle += 360
	const from = ((fromDeg % 360) + 360) % 360
	const to = ((toDeg % 360) + 360) % 360
	return from <= to ? angle >= from && angle <= to : angle >= from || angle <= to
}

const union =
	(...shapes) =>
	(px, py) =>
		shapes.some((shape) => shape(px, py))

/** Rasterise a shape into an RGBA buffer, supersampling for smooth edges. */
function render(shape, color) {
	const pixels = Buffer.alloc(SIZE * SIZE * 4)
	for (let y = 0; y < SIZE; y++) {
		for (let x = 0; x < SIZE; x++) {
			let hits = 0
			for (let sy = 0; sy < SAMPLES; sy++) {
				for (let sx = 0; sx < SAMPLES; sx++) {
					if (shape(x + (sx + 0.5) / SAMPLES, y + (sy + 0.5) / SAMPLES)) hits++
				}
			}
			const offset = (y * SIZE + x) * 4
			pixels[offset] = color[0]
			pixels[offset + 1] = color[1]
			pixels[offset + 2] = color[2]
			pixels[offset + 3] = Math.round((hits / (SAMPLES * SAMPLES)) * 255)
		}
	}
	return pixels
}

function crc32(buf) {
	let crc = ~0
	for (const byte of buf) {
		crc ^= byte
		for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
	}
	return ~crc >>> 0
}

function chunk(type, data) {
	const length = Buffer.alloc(4)
	length.writeUInt32BE(data.length)
	const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
	const crc = Buffer.alloc(4)
	crc.writeUInt32BE(crc32(body))
	return Buffer.concat([length, body, crc])
}

function encodePng(pixels) {
	const header = Buffer.alloc(13)
	header.writeUInt32BE(SIZE, 0)
	header.writeUInt32BE(SIZE, 4)
	header[8] = 8 // bit depth
	header[9] = 6 // truecolour with alpha
	// Each scanline is prefixed with its filter type; 0 (none) keeps the encoder trivial.
	const raw = Buffer.alloc(SIZE * (SIZE * 4 + 1))
	for (let y = 0; y < SIZE; y++) {
		raw[y * (SIZE * 4 + 1)] = 0
		pixels.copy(raw, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4)
	}
	return Buffer.concat([
		Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
		chunk('IHDR', header),
		chunk('IDAT', deflateSync(raw, { level: 9 })),
		chunk('IEND', Buffer.alloc(0)),
	])
}

// The glyphs themselves.
const speakerBody = union(
	rect(8, 25, 10, 14),
	polygon([
		[18, 25],
		[30, 14],
		[30, 50],
		[18, 39],
	]),
)
const speakerWaves = union(arc(30, 32, 12, 3.5, 310, 50), arc(30, 32, 19, 3.5, 315, 45))
const cross = (cx, cy, r, width) =>
	union(segment(cx - r, cy - r, cx + r, cy + r, width), segment(cx + r, cy - r, cx - r, cy + r, width))

const headband = arc(32, 30, 19, 5, 180, 360)
const earCups = union(roundedRect(9, 26, 11, 20, 5), roundedRect(44, 26, 11, 20, 5))
const headphones = union(headband, earCups)

const icons = {
	speaker: { shape: union(speakerBody, speakerWaves), color: WHITE },
	speakerMuted: { shape: union(speakerBody, cross(45, 32, 8, 5)), color: RED },
	headphones: { shape: headphones, color: WHITE },
	headphonesOff: { shape: union(headphones, cross(32, 34, 24, 5)), color: GRAY },
}

const entries = Object.entries(icons).map(([name, { shape, color }]) => {
	const base64 = encodePng(render(shape, color)).toString('base64')
	// Wrapped the way prettier wants it, so the generated file passes lint as written.
	return `export const ${name}Icon =\n\t'data:image/png;base64,${base64}'`
})

const out = `// GENERATED FILE - do not edit by hand. Run \`node tools/generate-icons.mjs\` to rebuild.
${entries.join('\n\n')}
`

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'presets', 'icons.ts')
writeFileSync(target, out)
console.log(`wrote ${target}`)
