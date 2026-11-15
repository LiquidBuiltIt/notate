// Pure geometry for the board. Every number is a board unit; the view (pan and zoom) sits on top.

export const NW = 224          // note width
export const NH = 208          // note height, fixed so layout never needs to measure the DOM
export const FRAME_PAD = 22    // room between a frame edge and its notes
export const FRAME_TOP = 46    // room for the frame's description line
export const MIN_ZOOM = .3
export const MAX_ZOOM = 1.6
export const TOP_MARGIN = 56   // keeps the frame tabs on the sheet

const SHEET_MIN = { w: 3200, h: 2000 }
const SHEET_MAX = { w: 12000, h: 8000 }

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export const round = (v, places = 0) => Math.round(v * 10 ** places) / 10 ** places

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
export const validNotePos = (b) => !!b && isNum(b.x) && isNum(b.y)
export const validFramePos = (b) => !!b && isNum(b.x) && isNum(b.y) && isNum(b.w) && isNum(b.h) && b.w > 0 && b.h > 0

// A small, steady tilt per note, between -1.5 and 1.5 degrees.
export const rotationFor = (id) => ((Math.abs(Number(id) || 0) * 37) % 31) / 10 - 1.5

// The sheet grows with its content, so a crowded board never runs out of paper.
export function sheetOf(rects) {
	const right = Math.max(0, ...rects.map(r => r.x + r.w))
	const bottom = Math.max(0, ...rects.map(r => r.y + r.h))
	return { w: clamp(right + 800, SHEET_MIN.w, SHEET_MAX.w), h: clamp(bottom + 800, SHEET_MIN.h, SHEET_MAX.h) }
}

// What a frame blocks when something else is placed: its body and the tab above it.
export const frameBlock = (f) => ({ x: f.x - 8, y: f.y - 52, w: f.w + 16, h: f.h + 60 })

const overlaps = (a, b, gap) => a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y

// What is taken, bucketed so a box is only tested against the rects near it. rects: [{ x, y, w, h }]
export function occupancy(rects = [], size = 256) {
	const buckets = new Map()
	let bottom = 0
	const each = (r, gap, fn) => {
		for (let i = Math.floor((r.x - gap) / size); i <= Math.floor((r.x + r.w + gap) / size); i++)
			for (let j = Math.floor((r.y - gap) / size); j <= Math.floor((r.y + r.h + gap) / size); j++) if (fn(`${i},${j}`)) return true
		return false
	}
	const add = (r) => { bottom = Math.max(bottom, r.y + r.h); each(r, 0, (k) => { (buckets.get(k) ?? buckets.set(k, []).get(k)).push(r) }) }
	rects.forEach(add)
	return { add, bottom: () => bottom, hits: (box, gap) => each(box, gap, (k) => buckets.get(k)?.some(r => overlaps(box, r, gap))) }
}

const spiral = new Map()   // the cells around the anchor, nearest first, kept per cell size
const cellsAround = (sx, sy, R) => {
	const key = `${sx},${sy},${R}`
	if (!spiral.has(key)) {
		const cells = []
		for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) cells.push([i, j, (i * sx) ** 2 + (j * sy) ** 2])
		spiral.set(key, cells.sort((a, b) => a[2] - b[2]))
	}
	return spiral.get(key)
}

// The free spot nearest the anchor for a w x h box: the anchor itself first, then outwards. `taken` is an occupancy.
export function placeFree(taken, w, h, anchor, sheet, gap = 14) {
	const sx = w + gap, sy = h + gap, R = 12
	const cx = clamp(anchor.x, w / 2, sheet.w - w / 2), cy = clamp(anchor.y, TOP_MARGIN + h / 2, sheet.h - h / 2)

	for (const [i, j] of cellsAround(sx, sy, R)) {
		const box = { x: Math.round(cx - w / 2 + i * sx), y: Math.round(cy - h / 2 + j * sy), w, h }
		if (box.x < 0 || box.y < TOP_MARGIN || box.x + w > sheet.w || box.y + h > sheet.h) continue
		if (!taken.hits(box, gap)) return { x: box.x, y: box.y }
	}
	return { x: clamp(Math.round(cx - w / 2), 0, sheet.w - w), y: Math.round(taken.bottom() + gap) }
}

// A frame size that holds `count` notes in two columns.
export function defaultFrameSize(count) {
	const rows = Math.max(1, Math.ceil(count / 2))
	return { w: 540, h: Math.max(330, FRAME_TOP + rows * (NH + 20) - 20 + FRAME_PAD) }
}

// A frame always holds its notes: it grows to fit them and never shrinks on its own.
export function growFrame(frame, notes) {
	let x0 = frame.x, y0 = frame.y, x1 = frame.x + frame.w, y1 = frame.y + frame.h
	for (const n of notes) {
		x0 = Math.min(x0, n.x - FRAME_PAD); y0 = Math.min(y0, n.y - FRAME_TOP)
		x1 = Math.max(x1, n.x + NW + FRAME_PAD); y1 = Math.max(y1, n.y + NH + FRAME_PAD)
	}
	return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

// The first free slot inside a frame, reading left to right, top to bottom.
export function slotInFrame(frame, others) {
	const cols = Math.max(1, Math.floor((frame.w - 2 * FRAME_PAD + 20) / (NW + 20)))
	for (let k = 0; ; k++) {
		const x = frame.x + FRAME_PAD + (k % cols) * (NW + 20), y = frame.y + FRAME_TOP + Math.floor(k / cols) * (NH + 20)
		if (!others.some(o => overlaps({ x, y, w: NW, h: NH }, { x: o.x, y: o.y, w: NW, h: NH }, 0))) return { x, y }
	}
}

// Tidy: loose notes in four columns, newest first; frames in two columns to the right, each packed inside.
// loose: [{ id }]; frames: [{ id, members: [{ id }] }]. Returns { n: { id: { x, y, r } }, f: { id: { x, y, w, h } } }.
export function tidyLayout(loose, frames) {
	const G = 24, IG = 20, FP = 24, FT = 50, ox = 80, oy = 80, LC = 4, FW = FP * 2 + NW * 2 + IG
	const argmin = (a) => a.indexOf(Math.min(...a)), n = {}, f = {}, order = []
	const cy = Array(LC).fill(oy)

	;[...loose].sort((a, b) => b.id - a.id).forEach(note => {
		const c = argmin(cy)
		n[note.id] = { x: ox + c * (NW + G), y: cy[c], r: 0 }
		cy[c] += NH + G; order.push(note.id)
	})

	const fx = ox + LC * (NW + G) + 40, fy = [oy + 44, oy + 44]
	frames.forEach(frame => {
		const c = argmin(fy), iy = [0, 0], x = fx + c * (FW + 48), y = fy[c]
		;[...frame.members].sort((a, b) => b.id - a.id).forEach(note => {
			const k = argmin(iy)
			n[note.id] = { x: x + FP + k * (NW + IG), y: y + FT + iy[k], r: 0 }
			iy[k] += NH + IG; order.push(note.id)
		})
		const h = Math.max(220, FT + Math.max(...iy) - IG + FP)
		f[frame.id] = { x, y, w: FW, h }
		fy[c] += h + 92
	})
	return { n, f, order }
}

// The settings toggle. Stored as the string "true" / "false", like the other two-option settings.
export const isBoardOn = (configuration) =>
	configuration?.inventory?.USER_CONFIGURATION?.[0]?.Notate?.page?.boardLayout?.value === 'true'

// The saved pan and zoom, or null when there is none.
export const savedView = (configuration) => {
	const v = configuration?.inventory?.USER_CONFIGURATION?.[0]?.Notate?.board?.view
	return v && isNum(v.x) && isNum(v.y) && isNum(v.z) ? { x: v.x, y: v.y, z: clamp(v.z, MIN_ZOOM, MAX_ZOOM) } : null
}
