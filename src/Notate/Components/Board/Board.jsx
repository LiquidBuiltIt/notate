import React from 'react'
import { NotateContext } from '@notate/Notate.jsx'
import { NOTATE_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { sendRequest } from '@universal/Hooks/useRequest/useRequest.jsx'
import { NotificationContext } from '@universal/Components/NotificationMessenger.jsx'
import { ConfirmationMsgContext } from '@notate/Components/Modals/ConfirmationModal/ConfirmationMsg.jsx'
import ConfirmationMsgHandler from '@notate/Components/Modals/ConfirmationModal/ConfimrationMsgHandler.js'
import noteSwatch from '@universal/Utils/noteSwatch.js'
import plainText from '@universal/Utils/plainText.js'
import Marked from '@universal/Components/Marked.jsx'
import { toRoman } from '@universal/Components/NotebookCard.jsx'
import { mastheadParts } from '@notate/dateWords.js'
import { tokensOf, noteMatches, volumeMatches } from '@notate/Components/Search/matching.js'
import * as B from './boardMath.js'

/*
	The board: notes and volumes laid out on one sheet of paper that you pan and zoom.
	React renders the content. Position, rotation and the view are written straight to the DOM
	(from the model in `s`), because they change every frame while a note is in hand.
	Every write is a PATCH of one field (`board`), so a position save never touches a content edit.
*/

const EMPTY = []
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
const isTyping = (el) => /^(INPUT|TEXTAREA|SELECT)$/.test(el?.tagName) || !!el?.isContentEditable
const NEW_MS = 1700
const HOLD_Y = 36   // a note held for placing hangs this far below the cursor


function NoteEl({ note, home, tokens, faded, className = '', style, clone, refCb }) {
	const swatch = noteSwatch(note.color)
	const host = (note.origin ?? '').replace(/^[a-z]+:\/\//i, '').split(/[/?#]/)[0].replace(/^www\./, '')
	const stamp = new Date(note.modified ?? note.created)
	const sameYear = stamp.getFullYear() === new Date().getFullYear()
	const date = isNaN(stamp) ? '' : stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })
	const text = plainText(note.content ?? '')

	return (
		<article
		 id={clone ? 'board-held' : `board-note-${note.id}`}
		 ref={refCb}
		 data-id={note.id}
		 className={`bd-note ${faded ? 'bd-faded' : ''} ${className}`}
		 style={{ '--sw': swatch.hex, ...style }}
		 tabIndex={clone ? undefined : (faded ? -1 : 0)}
		 aria-hidden={clone ? 'true' : undefined}
		 aria-label={clone ? undefined : `${note.title || 'Untitled'}, ${swatch.name} note${home ? `, in ${home.title}` : ''}`}
		>
			<div className="bd-meta">
				<span className="bd-no smallcaps">&sect; {String(note.id).padStart(2, '0')}</span>
				<span className="bd-vol">{home ? <>in <Marked text={home.title} tokens={tokens}/></> : ''}</span>
			</div>
			<h3 className="bd-t"><Marked text={note.title} tokens={tokens}/></h3>
			<p className="bd-b">{text ? <Marked text={text} tokens={tokens}/> : <span className="bd-none">Empty note.</span>}</p>
			<footer>
				<span className="bd-s smallcaps">{host ? <Marked text={host} tokens={tokens}/> : '—'}</span>
				<span className="bd-dt">{date}</span>
			</footer>
		</article>
	)
}


export default function Board() {
	const {
		NOTE_CONTEXT, NOTEBOOK_CONTEXT, SEARCH_TERM_CONTEXT, RECENT_NOTES_STATE_CONTEXT, DRAG_TO_TRASH_STATE_CONTEXT,
		NOTATE_DB_CONTEXT, USER_CONFIGURATION_DB_CONTEXT, MODAL_STATE_CONTEXT, SETTINGS_OPEN_CONTEXT, WHATS_NEW_OPEN_CONTEXT, BOARD_API_CONTEXT
	} = React.useContext(NotateContext)
	const [ selectedNote, setSelectedNote ] = NOTE_CONTEXT
	const [ selectedNotebook, setSelectedNotebook ] = NOTEBOOK_CONTEXT
	const [ searchTerm ] = SEARCH_TERM_CONTEXT
	const [ updateState, setUpdateState ] = RECENT_NOTES_STATE_CONTEXT
	const [ , setDragging ] = DRAG_TO_TRASH_STATE_CONTEXT
	const [ database, setDatabase ] = NOTATE_DB_CONTEXT
	const [ configuration, setConfiguration ] = USER_CONFIGURATION_DB_CONTEXT
	const [ modalState, setModalState ] = MODAL_STATE_CONTEXT
	const [ settingsOpen ] = SETTINGS_OPEN_CONTEXT
	const [ whatsNewOpen ] = WHATS_NEW_OPEN_CONTEXT
	const [ confMsgState, setConfMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ notification, setNotification ] = React.useContext(NotificationContext)

	const [ , bump ] = React.useReducer(x => x + 1, 0)
	const [ held, setHeld ] = React.useState(null)    // { id, phase: 'in' | 'lift' | 'settle' }
	const [ toast, setToast ] = React.useState(null)  // { text, undo, on }

	const rootRef = React.useRef(null)
	const boardRef = React.useRef(null)
	const worldRef = React.useRef(null)
	const handRef = React.useRef(null)
	const zoomRef = React.useRef(null)
	const liveRef = React.useRef(null)

	// The board model. Mutated in place; `bump()` re-renders when React content must change.
	const S = React.useRef(null)
	if (!S.current) S.current = {
		n: new Map(), f: new Map(),            // id -> { x, y, r, z } / { x, y, w, h }
		zTop: 10, sheet: { w: 3200, h: 2000 }, view: { x: 0, y: 0, z: 1 },
		over: new Map(),                       // note id -> volume id | null: filing that is saved but not yet read back
		gone: new Set(), pending: null, pendingF: null,
		fresh: new Map(), seen: new Set(), order: [], sig: '', started: false,
		place: null, expect: null, ptr: null, placedAt: 0,   // place: { id } while a just-saved note sticks to the cursor; expect: { created, title } of the note the new tab is saving; ptr: last pointer position
		queue: [], inflight: false, dirtyN: new Set(), dirtyF: new Set(),
		P: null, D: null, nEl: new Map(), fEl: new Map(), heldId: null, heldEl: null, trashKey: '', timers: {}
	}
	const s = S.current

	const notes = database?.inventory?.NOTES ?? EMPTY
	const rawBooks = database?.inventory?.NOTEBOOKS ?? EMPTY
	const books = React.useMemo(() => [...rawBooks].sort((a, b) => a.id - b.id), [rawBooks])
	const tokens = React.useMemo(() => tokensOf(searchTerm), [searchTerm])

	// Which volume holds each note: the stored collections (lowest volume id wins), then the unsaved filing on top.
	const dbHomes = new Map()
	books.forEach(bk => (bk.collection ?? []).forEach(id => { if (!dbHomes.has(id)) dbHomes.set(id, bk.id) }))
	const homes = new Map(dbHomes)
	s.over.forEach((fid, id) => fid == null ? homes.delete(id) : homes.set(id, fid))
	const noteMap = new Map(notes.map(n => [n.id, n]))
	const bookMap = new Map(books.map(b => [b.id, b]))
	const homeOf = (id) => homes.get(id) ?? null

	const L = React.useRef({})
	L.current = { notes, books, noteMap, bookMap, homes, dbHomes, selectedNote, selectedNotebook,
		modalOpen: !!(selectedNote || selectedNotebook || confMsgState || settingsOpen || whatsNewOpen) }

	const A = React.useRef({})


	/* ---- requests: one at a time, in order, so a later position never lands before an earlier one ---- */
	// The chain does not depend on the component: after the board unmounts it still sends what is left, in order.
	const pump = async () => {
		if (s.inflight || !s.queue.length) return
		s.inflight = true
		const req = s.queue.shift()
		const res = await sendRequest(req)
		s.inflight = false
		if (res) {
			const { data, database: name } = res
			if (name === NOTATE_DB) setDatabase(data)
			else if (name === USER_CONFIGURATION_DB) setConfiguration(data)
		} else {
			A.current.failed(req)   // the queue moves on, so later changes still save
		}
		pump()
	}
	const enqueue = (...requests) => { s.queue.push(...requests); pump() }

	// A change that could not be saved goes back to where it was last stored.
	const failed = (req) => {
		if (!boardRef.current) return
		const { noteMap, bookMap } = L.current
		const each = req.data?.$each ?? []
		each.forEach(({ id }) => {
			const m = req.store === 'NOTES' ? s.n.get(id) : s.f.get(id)
			const b = (req.store === 'NOTES' ? noteMap : bookMap).get(id)?.board
			if (m && b && (req.store === 'NOTES' ? B.validNotePos(b) : B.validFramePos(b))) Object.assign(m, b)
		})
		if (!s.queue.length) { s.over.clear(); s.gone.clear() }   // nothing more is coming, so the unsaved filing and deletions are dropped
		applyAll(); bump()
		showToast('That change could not be saved')
	}

	// Positions and filing. One $each per store; every record is patched by id, `board` only.
	const save = (nIds, fIds, extra = []) => {
		const np = [], bp = []
		nIds.forEach(id => {
			const m = s.n.get(id)
			if (m) np.push({ id, data: { board: { x: Math.round(m.x), y: Math.round(m.y), r: B.round(m.r, 2), z: Math.round(m.z) } } })
		})
		fIds.forEach(id => {
			const f = s.f.get(id)
			if (f) bp.push({ id, data: { board: { x: Math.round(f.x), y: Math.round(f.y), w: Math.round(f.w), h: Math.round(f.h) } } })
		})
		bp.push(...extra)
		if (np.length) enqueue({ type: 'PATCH_DATABASE', data: { $each: np }, store: 'NOTES', database: NOTATE_DB })
		if (bp.length) enqueue({ type: 'PATCH_DATABASE', data: { $each: bp }, store: 'NOTEBOOKS', database: NOTATE_DB })
	}
	const saveAll = () => save(new Set(s.n.keys()), new Set(s.f.keys()))

	const flushDirty = () => {
		clearTimeout(s.timers.save)
		if (!s.dirtyN.size && !s.dirtyF.size) return
		save(s.dirtyN, s.dirtyF)
		s.dirtyN = new Set(); s.dirtyF = new Set()
	}
	const saveSoon = () => { clearTimeout(s.timers.save); s.timers.save = setTimeout(flushDirty, 500) }

	const saveViewSoon = () => {
		clearTimeout(s.timers.view)
		s.viewDue = true
		s.timers.view = setTimeout(sendView, 400)
	}
	const sendView = () => {
		s.viewDue = false
		const v = s.view
		enqueue({
			type: 'PATCH_DATABASE', store: 'USER_CONFIGURATION', database: USER_CONFIGURATION_DB,
			data: { Notate: { board: { view: { x: Math.round(v.x), y: Math.round(v.y), z: B.round(v.z, 3) } } } }
		})
	}

	// Filing: a note is held by one volume. Returns the volume patches; `s.over` shows the result at once.
	const refile = (id, fid) => {
		const out = []
		L.current.books.forEach(bk => {
			const has = (bk.collection ?? []).includes(id)
			if (bk.id === fid && !has) out.push({ id: bk.id, data: { collection: { $add: [id] } } })
			else if (bk.id !== fid && has) out.push({ id: bk.id, data: { collection: { $remove: [id] } } })
		})
		s.over.set(id, fid)
		return out
	}


	/* ---- geometry: the model written to the DOM ---- */
	const rect = () => boardRef.current.getBoundingClientRect()
	const toBoard = (cx, cy) => { const R = rect(), v = s.view; return { x: (cx - R.left - v.x) / v.z, y: (cy - R.top - v.y) / v.z } }
	const viewCentre = () => { const R = rect(); return toBoard(R.left + R.width / 2, R.top + (R.height - 80) / 2) }

	const writeNote = (id) => {
		const el = s.nEl.get(id), m = s.n.get(id)
		if (!el || !m) return
		el.style.translate = `${m.x}px ${m.y}px`; el.style.rotate = `${m.r}deg`; el.style.zIndex = m.z
	}
	const writeFrame = (id) => {
		const el = s.fEl.get(id), f = s.f.get(id)
		if (!el || !f) return
		Object.assign(el.style, { left: `${f.x}px`, top: `${f.y}px`, width: `${f.w}px`, height: `${f.h}px` })
	}
	const writeHeld = (id, rot) => {
		const el = s.heldEl, m = s.n.get(id)
		if (!el || !m) return
		el.style.translate = `${m.x}px ${m.y}px`; el.style.rotate = `${rot ?? m.r}deg`; el.style.zIndex = m.z
	}
	const refreshSheet = () => {
		const rects = []
		s.n.forEach(m => rects.push({ x: m.x, y: m.y, w: B.NW, h: B.NH }))
		s.f.forEach(f => rects.push(f))
		s.sheet = B.sheetOf(rects)
	}
	const applyAll = () => {
		if (!worldRef.current) return
		refreshSheet()
		worldRef.current.style.width = `${s.sheet.w}px`; worldRef.current.style.height = `${s.sheet.h}px`
		s.n.forEach((_, id) => writeNote(id)); s.f.forEach((_, id) => writeFrame(id))
		if (s.heldId != null) writeHeld(s.heldId, s.D?.rot)
	}

	const clampView = () => {
		const R = rect(), M = 160, v = s.view
		v.x = B.clamp(v.x, M - s.sheet.w * v.z, R.width - M)
		v.y = B.clamp(v.y, M - s.sheet.h * v.z, R.height - M)
	}
	const applyView = (glide, persist = true) => {
		const v = s.view, t = `translate(${v.x}px, ${v.y}px) scale(${v.z})`
		for (const el of [worldRef.current, handRef.current]) { el.classList.toggle('bd-glide', !!glide); el.style.transform = t }
		worldRef.current.style.setProperty('--iz', B.clamp(1 / v.z, 1, 2))   // names stay readable zoomed out
		zoomRef.current.textContent = `${Math.round(v.z * 100)}%`
		if (persist) saveViewSoon()
	}
	const zoomAt = (cx, cy, z, glide) => {
		const b = toBoard(cx, cy), R = rect(), v = s.view
		v.z = B.clamp(z, B.MIN_ZOOM, B.MAX_ZOOM); v.x = cx - R.left - b.x * v.z; v.y = cy - R.top - b.y * v.z
		clampView(); applyView(glide)
	}
	const zoomMid = (f) => { const R = rect(); zoomAt(R.left + R.width / 2, R.top + R.height / 2, s.view.z * f, true) }
	const bbox = (only) => {
		let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9
		const add = (x, y, w, h) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h) }
		s.n.forEach((m, id) => { if (!only || only.n.has(id)) add(m.x, m.y, B.NW, B.NH) })
		s.f.forEach((f, id) => { if (!only || only.f.has(id)) { const k = B.frameBlock(f); add(k.x, k.y, k.w, k.h) } })
		return x0 > x1 ? { x: 0, y: 0, w: 1200, h: 800 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
	}
	const fitView = (glide, minZ = B.MIN_ZOOM, only, persist = true) => {
		const R = rect(), b = bbox(only), m = 44, W = R.width - m - 96, H = R.height - m - 72   // room for the rail and the search tab
		const v = s.view
		v.z = B.clamp(Math.min(W / b.w, H / b.h), minZ, 1)
		v.x = m + Math.max(0, (W - b.w * v.z) / 2) - b.x * v.z
		v.y = m + Math.max(0, (H - b.h * v.z) / 2) - b.y * v.z
		clampView(); applyView(glide, persist)
	}
	const ensureVisible = (id) => {
		const el = s.nEl.get(id)
		if (!el) return
		const R = rect(), r = el.getBoundingClientRect(), m = 48
		let dx = 0, dy = 0
		if (r.left < R.left + m) dx = R.left + m - r.left; else if (r.right > R.right - 110) dx = R.right - 110 - r.right
		if (r.top < R.top + m) dy = R.top + m - r.top; else if (r.bottom > R.bottom - 90) dy = R.bottom - 90 - r.bottom
		if (dx || dy) { s.view.x += dx; s.view.y += dy; clampView(); applyView(true) }
	}
	const frameAt = (bx, by) => {
		for (let i = L.current.books.length - 1; i >= 0; i--) {
			const id = L.current.books[i].id, f = s.f.get(id)
			if (f && bx >= f.x && bx <= f.x + f.w && by >= f.y && by <= f.y + f.h) return id
		}
		return null
	}
	const membersOf = (fid) => L.current.notes.filter(n => s.n.has(n.id) && homeOf(n.id) === fid)
	// A frame always holds its notes. Returns true when it grew.
	const growIt = (fid) => {
		const f = s.f.get(fid)
		if (!f) return false
		const g = B.growFrame(f, membersOf(fid).map(n => s.n.get(n.id)))
		if (g.x === f.x && g.y === f.y && g.w === f.w && g.h === f.h) return false
		Object.assign(f, g)
		return true
	}
	// Everything a new note must stay clear of, except one note (the one being placed).
	const occupied = (skip) => B.occupancy([...s.n].filter(([id]) => id !== skip).map(([, m]) => ({ x: m.x, y: m.y, w: B.NW, h: B.NH })).concat([...s.f.values()].map(B.frameBlock)))
	const front = (id) => { const m = s.n.get(id); if (m) { m.z = ++s.zTop; writeNote(id); if (s.heldId === id) writeHeld(id, s.D?.rot) } }
	const say = (t) => { if (liveRef.current) liveRef.current.textContent = t }

	const showToast = (text, undo) => {
		clearTimeout(s.timers.toast)
		setToast({ text, undo, on: true })
		s.timers.toast = setTimeout(() => setToast(t => t && { ...t, on: false }), undo ? 5200 : 2800)
	}


	/* ---- hydrate: bring the model in line with the stored notes and volumes; place what has no place yet ---- */
	const hydrate = () => {
		if (!database?.inventory?.NOTES || !boardRef.current) return
		const { notes: ns, books: bs } = L.current
		const ids = new Set(ns.map(n => n.id)), bids = new Set(bs.map(b => b.id))
		for (const id of [...s.n.keys()]) if (!ids.has(id)) s.n.delete(id)
		for (const id of [...s.f.keys()]) if (!bids.has(id)) s.f.delete(id)
		if (s.place && !ids.has(s.place.id)) { s.place = s.heldId = null; setHeld(null) }   // the held note was deleted elsewhere

		const tN = new Set(), tF = new Set(), seeded = new Set(), extra = []
		const isNum = (v) => typeof v === 'number' && Number.isFinite(v)
		// Existing ids are never re-seeded, so a later patch from elsewhere cannot override the live model.
		for (const n of ns) if (!s.n.has(n.id) && B.validNotePos(n.board)) {
			s.n.set(n.id, { x: n.board.x, y: n.board.y, r: isNum(n.board.r) ? n.board.r : B.rotationFor(n.id), z: isNum(n.board.z) ? n.board.z : 0 })
			s.zTop = Math.max(s.zTop, s.n.get(n.id).z); seeded.add(n.id)
		}
		for (const b of bs) if (!s.f.has(b.id) && B.validFramePos(b.board)) s.f.set(b.id, { x: b.board.x, y: b.board.y, w: b.board.w, h: b.board.h })

		const first = !s.started
		const positioned = { n: new Set(s.n.keys()), f: new Set(s.f.keys()) }
		let hadView = false
		if (first) {
			s.started = true
			const sv = B.savedView(configuration)
			refreshSheet()
			if (sv) { s.view = { ...sv }; clampView(); hadView = true } else fitView(false, .6, positioned, false)
			applyView(false, false)
		}

		refreshSheet()
		const taken = occupied(s.place?.id)
		const centre = viewCentre()

		for (const bk of bs) if (!s.f.has(bk.id)) {
			const size = B.defaultFrameSize((bk.collection ?? []).filter(id => ids.has(id)).length)
			const spot = B.placeFree(taken, size.w + 16, size.h + 60, centre, s.sheet)
			s.f.set(bk.id, { x: spot.x + 8, y: spot.y + 52, ...size }); tF.add(bk.id)
			taken.add(B.frameBlock(s.f.get(bk.id)))
			refreshSheet()
		}

		// A note the new tab just saved sticks to the cursor. Any other note without a place (made on a web page,
		// or never placed before the tab closed) goes to a free spot.
		const want = s.expect
		const mine = !first && !s.place && want ? ns.find(n => !s.n.has(n.id) && n.created === want.created && n.title === want.title)?.id ?? null : null
		if (mine != null) s.expect = null
		for (const n of ns) if (!s.n.has(n.id)) {
			if (n.id === mine) {
				const p = s.ptr ? toBoard(s.ptr.x, s.ptr.y) : centre
				s.n.set(n.id, { r: B.rotationFor(n.id), z: ++s.zTop, x: p.x - B.NW / 2, y: p.y - HOLD_Y })
				s.place = { id: n.id }; s.heldId = n.id; s.seen.add(n.id)
				continue
			}
			let home = homeOf(n.id), fid = home != null && s.f.has(home) ? home : null
			const base = { r: B.rotationFor(n.id), z: ++s.zTop }
			if (fid != null) {
				const pos = B.slotInFrame(s.f.get(fid), membersOf(fid).map(m => s.n.get(m.id)))
				s.n.set(n.id, { ...base, ...pos })
			} else {
				const pos = B.placeFree(taken, B.NW, B.NH, centre, s.sheet)
				s.n.set(n.id, { ...base, ...pos })
			}
			const placed = s.n.get(n.id)
			taken.add({ x: placed.x, y: placed.y, w: B.NW, h: B.NH })
			tN.add(n.id)
		}
		if (mine != null) { setHeld({ id: mine, phase: 'lift' }); say('Click to place the note, or press Escape') }

		// Old data: a filed note outside its volume is slotted in. Notes already placed in one are left alone.
		for (const n of ns) if (seeded.has(n.id) && !tN.has(n.id)) {
			const fid = homeOf(n.id), f = fid != null && s.f.get(fid), m = s.n.get(n.id)
			if (f && (m.x + B.NW / 2 < f.x || m.x + B.NW / 2 > f.x + f.w || m.y + B.NH / 2 < f.y || m.y + B.NH / 2 > f.y + f.h)) {
				Object.assign(m, B.slotInFrame(f, membersOf(fid).filter(o => o.id !== n.id).map(o => s.n.get(o.id)))); tN.add(n.id)
			}
		}
		for (const bk of bs) if (growIt(bk.id)) tF.add(bk.id)

		// Reading order is the Tab order: bands of 300 units, left to right.
		const sig = [...s.n.keys()].sort((a, b) => a - b).join(',')
		let changed = false
		if (sig !== s.sig) {
			s.sig = sig
			s.order = [...s.n.keys()].sort((a, b) => Math.floor(s.n.get(a).y / 300) - Math.floor(s.n.get(b).y / 300) || s.n.get(a).x - s.n.get(b).x)
			changed = true
		}
		const fresh = (key, kind, delay) => {
			s.fresh.set(key, { cls: kind, delay })
			setTimeout(() => { s.fresh.delete(key); bump() }, NEW_MS + (delay || 0))
			changed = true
		}
		s.order.forEach((id, i) => { if (!s.seen.has(id)) { s.seen.add(id); fresh(`n${id}`, first ? 'bd-rise' : 'bd-land', first ? Math.min(i * 28, 1500) : 0) } })
		for (const bk of bs) if (!s.seen.has(`f${bk.id}`)) { s.seen.add(`f${bk.id}`); if (!first) fresh(`f${bk.id}`, 'bd-land') }

		if (tN.size || tF.size || extra.length) save(tN, tF, extra)
		if (first && !hadView) { refreshSheet(); fitView(false, .6, positioned.n.size + positioned.f.size ? undefined : undefined, false) }

		// Once everything sent has been read back, the unsaved filing and deletions are no longer needed.
		if (!s.inflight && !s.queue.length && (s.over.size || s.gone.size)) { s.over.clear(); s.gone.clear(); changed = true }
		if (changed) bump()
	}


	/* ---- dragging ---- */
	const trashEvent = (near, over) => window.dispatchEvent(new CustomEvent('notate:trash-over', { detail: { near, over } }))
	const clearAim = () => {
		s.trashKey = ''; trashEvent(false, false)
		s.fEl.forEach(el => el.classList.remove('bd-dropping'))
	}
	// Where the pointer is: 'trash', a volume id, or null. Also lights the trash and the volume under the pointer.
	const aim = (px, py, d) => {
		let near = false, over = false
		const zone = document.getElementById('drag-to-trash-hover-region')
		if (zone) {
			const r = zone.getBoundingClientRect(), rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16
			near = px >= r.left && px <= r.right && py >= r.top && py <= r.bottom
			over = near && py >= r.bottom - 8 * rem && py <= r.bottom - 2 * rem
		}
		d.near = near
		const key = `${near}:${over}`
		if (key !== s.trashKey) { s.trashKey = key; trashEvent(near, over) }
		const b = toBoard(px, py)
		const f = d.kind === 'note' && !over ? frameAt(b.x, b.y) : null
		s.fEl.forEach((el, id) => el.classList.toggle('bd-dropping', f != null && id === f && id !== d.home))
		d.tgt = over ? 'trash' : f
		return d.tgt
	}
	const autoPan = (d) => {
		const R = rect(), Z = 48, MAX = 18
		const edge = (p, lo, hi) => p < lo + Z ? Math.min(1, (lo + Z - p) / Z) : p > hi - Z ? -Math.min(1, (p - (hi - Z)) / Z) : 0
		const ax = edge(d.x, R.left, R.right), ay = edge(d.y, R.top, R.bottom)
		if (!ax && !ay) return
		const v = s.view, ox = v.x, oy = v.y
		v.x += ax * MAX; v.y += ay * MAX; clampView()
		if (v.x !== ox || v.y !== oy) applyView(false)
	}
	const tick = () => {
		const d = s.D
		if (!d || d.kind === 'pan') return
		if (!d.near) autoPan(d)
		const b = toBoard(d.x, d.y)
		if (d.kind === 'note') {
			d.vx *= .85
			const want = -1.5 + (reduced() ? 0 : B.clamp(d.vx * .3, -5, 5))   // lean into the motion, ease back
			d.rot += (want - d.rot) * (reduced() ? 1 : .18)
			const m = s.n.get(d.id)
			m.x = b.x - d.ox; m.y = b.y - d.oy
			writeHeld(d.id, d.rot); writeNote(d.id)
		} else {
			const dx = b.x - d.b0.x, dy = b.y - d.b0.y, f = s.f.get(d.fid)
			f.x = d.fx + dx; f.y = d.fy + dy; writeFrame(d.fid)
			d.ms.forEach(([id, x, y]) => { const m = s.n.get(id); m.x = x + dx; m.y = y + dy; writeNote(id) })
		}
		d.raf = requestAnimationFrame(tick)
	}
	const beginNote = (id, px, py) => {
		const m = s.n.get(id), b = toBoard(px, py)
		front(id); clearTimeout(s.timers.settle)
		s.hadFocus = document.activeElement === s.nEl.get(id)
		s.D = { kind: 'note', id, ox: b.x - m.x, oy: b.y - m.y, sx: m.x, sy: m.y, x: px, y: py, rot: m.r, vx: 0, raf: 0, home: homeOf(id), tgt: null, near: false }
		s.heldId = id
		setHeld({ id, phase: 'in' }); setDragging(true)
		s.D.raf = requestAnimationFrame(tick)
		// The lift class goes on a frame later, so the scale transition has something to start from.
		requestAnimationFrame(() => requestAnimationFrame(() => { if (s.D?.id === id) setHeld({ id, phase: 'lift' }) }))
	}
	const beginFrame = (fid, px, py) => {
		const f = s.f.get(fid)
		s.D = { kind: 'frame', fid, b0: toBoard(px, py), fx: f.x, fy: f.y, x: px, y: py, raf: 0, near: false, ms: membersOf(fid).map(n => [n.id, s.n.get(n.id).x, s.n.get(n.id).y]) }
		s.fEl.get(fid)?.classList.add('bd-lift')
		setDragging(true)
		s.D.raf = requestAnimationFrame(tick)
	}
	const beginPan = (px, py) => {
		s.D = { kind: 'pan', x0: px, y0: py, vx: s.view.x, vy: s.view.y }
		rootRef.current.classList.add('bd-panning')
	}

	// Call before the final position is written, so the move is animated.
	const settleHeld = (id) => {
		s.heldEl?.classList.remove('bd-lift'); s.heldEl?.classList.add('bd-settling')
		setHeld({ id, phase: 'settle' })
		s.timers.settle = setTimeout(() => {
			s.heldId = null; setHeld(null)
			if (s.hadFocus) s.nEl.get(id)?.focus({ preventScroll: true })
		}, reduced() ? 0 : 340)
	}

	const askDeleteNote = (id, next) => {
		const note = L.current.noteMap.get(id)
		if (!note) return
		s.pending = id; bump()
		setConfMsgState(new ConfirmationMsgHandler(
			'Delete Item?',
			'Are you sure you want to delete this note? This is a permanent action!',
			'Delete',
			() => {
				s.pending = null; s.gone.add(id)
				enqueue({ type: 'DELETE_DATABASE', data: { id }, store: 'NOTES', database: NOTATE_DB })
				setNotification(notification.showInfo('Note Deleted!'))
				bump()
				if (next) next()
			},
			true,
			() => { s.pending = null; bump() }
		))
	}
	const askDeleteNotebook = (fid) => {
		if (!L.current.bookMap.has(fid)) return
		s.pendingF = fid; bump()
		setConfMsgState(new ConfirmationMsgHandler(
			'Delete Notebook?',
			'The notebook goes, but its notes stay in your Recents.',
			'Delete',
			() => {
				s.pendingF = null
				enqueue({ type: 'DELETE_DATABASE', data: { id: fid }, store: 'NOTEBOOKS', database: NOTATE_DB })
				setNotification(notification.showInfo('Notebook Deleted!'))
				bump()
			},
			true,
			() => { s.pendingF = null; bump() }
		))
	}

	const endNote = (drop) => {
		const d = s.D, m = s.n.get(d.id)
		cancelAnimationFrame(d.raf); s.D = null
		const t = drop ? aim(d.x, d.y, d) : null
		clearAim(); setDragging(false)

		if (t === 'trash') {            // back where it was; the delete waits for the confirmation
			m.x = d.sx; m.y = d.sy
			settleHeld(d.id); applyAll(); askDeleteNote(d.id)
			return
		}
		if (!drop) { m.x = d.sx; m.y = d.sy }
		m.x = Math.round(B.clamp(m.x, 0, s.sheet.w - B.NW)); m.y = Math.round(B.clamp(m.y, B.TOP_MARGIN, s.sheet.h - B.NH))

		let extra = [], msg = ''
		const before = d.home
		if (drop && t != null && t !== before) { extra = refile(d.id, t); msg = `Filed under ${L.current.bookMap.get(t)?.title ?? 'a notebook'}` }
		else if (drop && t == null && before != null) { extra = refile(d.id, null); msg = `Taken out of ${L.current.bookMap.get(before)?.title ?? 'a notebook'}` }

		const fid = s.over.has(d.id) ? s.over.get(d.id) : before
		const tF = new Set()
		if (fid != null && growIt(fid)) tF.add(fid)
		if (fid != null && !tF.size && drop) tF.add(fid)
		settleHeld(d.id); applyAll()
		if (drop) { save([d.id], tF, extra); if (msg) showToast(`${msg}: ${L.current.noteMap.get(d.id)?.title ?? ''}`) }
		bump()
	}
	const endFrame = (drop) => {
		const d = s.D, f = s.f.get(d.fid)
		cancelAnimationFrame(d.raf); s.D = null
		const t = drop ? aim(d.x, d.y, d) : null
		clearAim(); setDragging(false)
		s.fEl.get(d.fid)?.classList.remove('bd-lift')

		if (t === 'trash' || !drop) {
			f.x = d.fx; f.y = d.fy
			d.ms.forEach(([id, x, y]) => { const m = s.n.get(id); m.x = x; m.y = y })
			applyAll()
			if (t === 'trash') askDeleteNotebook(d.fid)
			return
		}
		const dx = Math.round(B.clamp(f.x, 0, s.sheet.w - f.w)) - f.x, dy = Math.round(B.clamp(f.y, B.TOP_MARGIN, s.sheet.h - f.h)) - f.y
		f.x = Math.round(f.x + dx); f.y = Math.round(f.y + dy)
		d.ms.forEach(([id]) => { const m = s.n.get(id); m.x = Math.round(m.x + dx); m.y = Math.round(m.y + dy) })
		applyAll()
		save(d.ms.map(([id]) => id), [d.fid])
	}
	const endDrag = (drop) => {
		const d = s.D
		if (!d) return
		if (d.kind === 'note') return endNote(drop)
		if (d.kind === 'frame') return endFrame(drop)
		s.D = null; rootRef.current.classList.remove('bd-panning')
	}
	const stopDrag = () => { s.P = null; if (s.place) endPlace(null); if (s.D) endDrag(false) }

	/* ---- placing: a note saved on the new tab sticks to the cursor until it is clicked down or dropped ---- */
	const followPlace = () => {
		const id = s.place.id, m = s.n.get(id), b = toBoard(s.ptr.x, s.ptr.y)
		m.x = b.x - B.NW / 2; m.y = b.y - HOLD_Y
		writeHeld(id)
	}
	// b: the board point that was clicked, or null to drop the note into the nearest free spot.
	const endPlace = (b) => {
		const id = s.place.id, m = s.n.get(id)
		s.place = null
		settleHeld(id)
		let extra = [], fid = null
		if (b) {
			m.x = Math.round(B.clamp(b.x - B.NW / 2, 0, s.sheet.w - B.NW)); m.y = Math.round(B.clamp(b.y - HOLD_Y, B.TOP_MARGIN, s.sheet.h - B.NH))
			fid = frameAt(b.x, b.y)
			if (fid != null) extra = refile(id, fid)
		} else {
			Object.assign(m, B.placeFree(occupied(id), B.NW, B.NH, { x: m.x + B.NW / 2, y: m.y + B.NH / 2 }, s.sheet))
		}
		const tF = new Set()
		if (fid != null && growIt(fid)) tF.add(fid)
		applyAll(); save([id], tF, extra); say('Note placed'); bump()
		s.placedAt = Date.now()
		requestAnimationFrame(() => front(id))   // the click may have focused a note underneath, which would otherwise come to the front
	}
	// Pointer down anywhere: on the board it places the note there (and is not a pan or a click on a note); elsewhere it drops it.
	const onPlaceDown = (e) => {
		if (!s.place || e.button || e.target.closest?.('#board-rail')) return   // the zoom rail works while the note stays held
		if (e.target.closest?.('#board')) { e.stopPropagation(); endPlace(toBoard(e.clientX, e.clientY)) }
		else endPlace(null)
	}
	const onPointer = (e) => { s.ptr = { x: e.clientX, y: e.clientY }; if (s.place) followPlace() }

	const openNote = (id) => {
		const note = L.current.noteMap.get(id)
		if (!note || L.current.selectedNotebook) return
		setSelectedNote(note); setModalState(true)
	}
	const openNotebook = (fid) => {
		const nb = L.current.bookMap.get(fid)
		if (!nb || L.current.selectedNote) return
		setSelectedNotebook(nb); setModalState(true)
	}

	const onDown = (e) => {
		if (e.button || s.D || Date.now() - s.placedAt < 400) return   // a quick second click is not a click on the note just placed
		const ne = e.target.closest('.bd-note'), pl = e.target.closest('.bd-plate')
		s.P = { x: e.clientX, y: e.clientY, id: ne ? Number(ne.dataset.id) : null, fid: pl ? Number(pl.dataset.fid) : null }
		if (s.P.id != null) front(s.P.id)
		try { boardRef.current.setPointerCapture(e.pointerId) } catch { /* no active pointer */ }
	}
	const onMove = (e) => {
		const p = s.P
		if (p && !s.D && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) {
			if (p.id != null && s.n.has(p.id)) beginNote(p.id, p.x, p.y)
			else if (p.fid != null && s.f.has(p.fid)) beginFrame(p.fid, p.x, p.y)
			else beginPan(p.x, p.y)
		}
		const d = s.D
		if (!d) return
		if (d.kind === 'pan') {
			s.view.x = d.vx + e.clientX - d.x0; s.view.y = d.vy + e.clientY - d.y0
			clampView(); applyView(false)
		} else {
			if (d.kind === 'note') d.vx += e.clientX - d.x
			d.x = e.clientX; d.y = e.clientY
			aim(d.x, d.y, d)
		}
	}
	const onUp = () => {
		const p = s.P; s.P = null
		if (s.D) { endDrag(true); return }
		if (!p) return
		if (p.id != null) openNote(p.id)
		else if (p.fid != null) openNotebook(p.fid)
	}
	const onCancel = () => { s.P = null; if (s.D) endDrag(false) }
	const onWheel = (e) => {
		e.preventDefault()
		const k = e.deltaMode === 1 ? 16 : 1
		if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, s.view.z * Math.exp(-e.deltaY * k * .0022))
		else {
			const sideways = e.shiftKey && !e.deltaX
			s.view.x -= (sideways ? e.deltaY : e.deltaX) * k; s.view.y -= sideways ? 0 : e.deltaY * k
			clampView(); applyView(false)
		}
	}


	/* ---- keyboard on notes: arrows nudge (Shift = 40), Enter opens, Delete removes ---- */
	const nudge = (id, dx, dy) => {
		const m = s.n.get(id)
		if (!m) return
		s.nEl.get(id)?.classList.add('bd-nudge')
		m.x = B.clamp(m.x + dx, 0, s.sheet.w - B.NW); m.y = B.clamp(m.y + dy, B.TOP_MARGIN, s.sheet.h - B.NH)
		const was = homeOf(id), now = frameAt(m.x + B.NW / 2, m.y + B.NH / 2)
		s.dirtyN.add(id)
		if (now !== was) {   // by keyboard the note's centre decides which volume holds it
			const extra = refile(id, now)
			if (now != null && growIt(now)) s.dirtyF.add(now)
			if (now != null) s.dirtyF.add(now)
			save([], [], extra)
			showToast(now != null ? `Filed under ${L.current.bookMap.get(now)?.title ?? 'a notebook'}` : `Taken out of ${L.current.bookMap.get(was)?.title ?? 'a notebook'}`)
			bump()
		}
		applyAll(); saveSoon()
		say(`${L.current.noteMap.get(id)?.title ?? 'Note'} at ${Math.round(m.x)}, ${Math.round(m.y)}`)
		ensureVisible(id)
	}
	const liveNotes = () => [...worldRef.current.querySelectorAll('.bd-note:not(.bd-faded)')].map(el => Number(el.dataset.id))
	const onBoardKey = (e) => {
		if (e.ctrlKey || e.metaKey || e.altKey) return
		const plate = e.target.closest?.('.bd-plate')
		if (plate && e.key === 'Enter') { e.preventDefault(); openNotebook(Number(plate.dataset.fid)); return }
		const el = e.target.closest?.('.bd-note')
		if (!el || el.id === 'board-held') return
		const id = Number(el.dataset.id), step = e.shiftKey ? 40 : 8
		const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key]
		if (d) { e.preventDefault(); nudge(id, d[0], d[1]) }
		else if (e.key === 'Enter') { e.preventDefault(); openNote(id) }
		else if (e.key === 'Delete' || e.key === 'Backspace') {
			e.preventDefault()
			const l = liveNotes(), i = l.indexOf(id), nx = l[i + 1] ?? l[i - 1]
			askDeleteNote(id, () => (nx != null ? s.nEl.get(nx) : document.getElementById('searchInput'))?.focus())
		}
	}
	const onFocusIn = (e) => {
		const el = e.target.closest?.('.bd-note')
		if (!el) return
		boardRef.current.scrollTop = boardRef.current.scrollLeft = 0
		const id = Number(el.dataset.id)
		front(id)
		if (el.matches(':focus-visible')) ensureVisible(id)
	}
	const onFocusOut = (e) => e.target.closest?.('.bd-note')?.classList.remove('bd-nudge')


	/* ---- tidy: loose notes in a grid, volumes to the right; saved, with an undo ---- */
	const animated = (fn) => {
		worldRef.current.classList.add('bd-tidying'); fn()
		clearTimeout(s.timers.tidy); s.timers.tidy = setTimeout(() => worldRef.current?.classList.remove('bd-tidying'), 1100)
	}
	const restore = (snap) => {
		animated(() => {
			snap.n.forEach(([id, m]) => { if (s.n.has(id)) { Object.assign(s.n.get(id), m); s.nEl.get(id)?.style.setProperty('--d', '0ms') } })
			snap.f.forEach(([id, f]) => { if (s.f.has(id)) Object.assign(s.f.get(id), f) })
			s.view = { ...snap.view }; applyAll(); applyView(true)
		})
		saveAll(); setToast(t => t && { ...t, on: false })
	}
	const tidy = () => {
		stopDrag()
		const { notes: ns, books: bs } = L.current
		const snap = { n: [...s.n].map(([id, m]) => [id, { ...m }]), f: [...s.f].map(([id, f]) => [id, { ...f }]), view: { ...s.view } }
		const has = (n) => s.n.has(n.id)
		const loose = ns.filter(n => has(n) && homeOf(n.id) == null).map(n => ({ id: n.id }))
		const frames = bs.filter(b => s.f.has(b.id)).map(b => ({ id: b.id, members: ns.filter(n => has(n) && homeOf(n.id) === b.id).map(n => ({ id: n.id })) }))
		const lay = B.tidyLayout(loose, frames)
		animated(() => {
			lay.order.forEach((id, i) => { Object.assign(s.n.get(id), lay.n[id]); s.nEl.get(id)?.style.setProperty('--d', `${reduced() ? 0 : i * 18}ms`) })
			Object.entries(lay.f).forEach(([id, f]) => Object.assign(s.f.get(Number(id)), f))
			applyAll()
		})
		fitView(true)
		saveAll()
		showToast('Tidied: newest first, volumes to the right.', () => restore(snap))
	}


	/* ---- keys that work anywhere on the page ---- */
	const onGlobalKey = (e) => {
		if (e.key === 'Escape' && s.place) { endPlace(null); return }
		if (L.current.modalOpen) return
		const ae = document.activeElement
		if (e.key === 'Escape') {
			if (s.D) { stopDrag(); return }
			if (ae?.classList?.contains('bd-note')) document.getElementById('searchInput')?.focus()
			return
		}
		if (isTyping(ae) || e.ctrlKey || e.metaKey || e.altKey) return
		if (e.key === '+' || e.key === '=') zoomMid(1.25)
		else if (e.key === '-') zoomMid(.8)
		else if (e.key === '0') fitView(true)
		else if (e.key === 't' || e.key === 'T') tidy()
	}

	A.current = { failed, flushAll: () => { flushDirty(); if (s.viewDue) sendView() }, onDown, onMove, onUp, onCancel, onWheel, onBoardKey, onFocusIn, onFocusOut, onGlobalKey, onPointer, onPlaceDown,
		onResize: () => { clampView(); applyView(false, false) } }


	/* ---- effects ---- */
	React.useEffect(() => {
		const board = boardRef.current, call = (name) => (e) => A.current[name](e)
		const on = [
			[board, 'pointerdown', call('onDown')], [board, 'pointermove', call('onMove')], [board, 'pointerup', call('onUp')],
			[board, 'pointercancel', call('onCancel')], [board, 'wheel', call('onWheel'), { passive: false }],
			[board, 'keydown', call('onBoardKey')], [board, 'focusin', call('onFocusIn')], [board, 'focusout', call('onFocusOut')],
			[board, 'scroll', () => { board.scrollTop = board.scrollLeft = 0 }],   // focus must not scroll the viewport; the view pans instead
			[window, 'resize', call('onResize')], [document, 'keydown', call('onGlobalKey')],
			[window, 'pointermove', call('onPointer')], [window, 'pointerdown', call('onPlaceDown'), true]
		]
		on.forEach(([el, type, fn, opt]) => el.addEventListener(type, fn, opt))
		return () => {
			on.forEach(([el, type, fn, opt]) => el.removeEventListener(type, fn, opt))
			// Unsaved changes join the queue, which keeps sending after the board is gone.
			A.current.flushAll()
			Object.values(S.current.timers).forEach(clearTimeout)
			clearAim(); setDragging(false)
		}
	}, [])

	React.useLayoutEffect(hydrate, [notes, rawBooks])
	React.useLayoutEffect(applyAll)

	// The grid refreshes through RecentNotes; with no grid mounted the board closes the editor's loop itself.
	React.useEffect(() => {
		if (!updateState) return
		if (!modalState) { setSelectedNote(null); setSelectedNotebook(null) }
		setUpdateState(false)
	}, [updateState, database])

	// The search bar asks how many of its matches are off screen.
	BOARD_API_CONTEXT.current = {
		expectPlace: (note) => { s.expect = { created: note.created, title: note.title } },   // the new tab is saving this note: when it arrives, it follows the cursor
		countOutOfView: (ids) => {
			if (!boardRef.current) return 0   // the search bar renders before the board has mounted
			const R = rect(), v = s.view
			let n = 0
			ids.forEach(id => {
				const m = s.n.get(id)
				if (!m) return
				const l = R.left + m.x * v.z + v.x, t = R.top + m.y * v.z + v.y
				if (l + B.NW * v.z < R.left || l > R.right || t + B.NH * v.z < R.top || t > R.bottom - 60) n++
			})
			return n
		}
	}
	React.useEffect(() => () => { BOARD_API_CONTEXT.current = null }, [])


	/* ---- render ---- */
	const counts = new Map()
	homes.forEach((fid) => counts.set(fid, (counts.get(fid) ?? 0) + 1))
	const inOrder = new Set(s.order)
	const ordered = [...s.order.filter(id => noteMap.has(id)), ...notes.filter(n => !inOrder.has(n.id)).map(n => n.id)]
	const nothingFound = tokens.length > 0 && !notes.some(n => noteMatches(n, tokens)) && !books.some(b => volumeMatches(b, notes, tokens))
	const { weekday, day, month } = mastheadParts()

	const noteClass = (id) => [
		held?.id === id ? 'bd-hidden' : '', s.pending === id ? 'bd-pending' : '', s.gone.has(id) ? 'bd-gone' : '', s.fresh.get(`n${id}`)?.cls ?? ''
	].join(' ')
	const heldNote = held && noteMap.get(held.id)
	const reg = (map, id) => (el) => { if (el) map.set(id, el); else map.delete(id) }

	return (
		<div className="bd-root" ref={rootRef}>
			<header className="bd-top">
				<div className="bd-brand">
					<img id="board-logo" src="./Designs/notate-logo.svg" alt="" className="bd-logo"/>
					<span className="smallcaps">Notate</span>
				</div>
				<h1 className="bd-date" id="board-date">{weekday}, <span className="bd-d2">{day}</span> {month}<span className="bd-dot">.</span></h1>
				<div className="bd-tr">
					<span className="bd-hint">Drag the paper to pan &nbsp;&middot;&nbsp; Ctrl + wheel to zoom</span>
					<span className="bd-counts smallcaps" id="board-counts">{plural(notes.length, 'note')} &nbsp;&middot;&nbsp; {plural(books.length, 'volume')}</span>
					<span id="board-settings-slot" className="flex items-center gap-8"></span>
				</div>
			</header>

			<main id="board" ref={boardRef} className="bd-board" aria-label="Board. Tab to a note, arrow keys move it, Shift for a larger step, Enter opens, Delete removes.">
				<div id="board-world" ref={worldRef} className="bd-world">
					<span className="bd-cm a"/><span className="bd-cm b"/><span className="bd-cm c"/><span className="bd-cm d"/>
					<span className="bd-sheet-l smallcaps">Sheet I &nbsp;&middot;&nbsp; the board</span>

					{ books.map((bk, i) => {
						const count = counts.get(bk.id) ?? 0
						const lit = !tokens.length || volumeMatches(bk, notes, tokens)
						return (
							<section
							 key={bk.id}
							 id={`board-frame-${bk.id}`}
							 ref={reg(s.fEl, bk.id)}
							 className={`bd-frame ${lit ? '' : 'bd-faded'} ${s.pendingF === bk.id ? 'bd-pending' : ''} ${s.fresh.get(`f${bk.id}`)?.cls ?? ''}`}
							 aria-label={`Volume ${bk.title}, ${plural(count, 'note')}`}
							>
								<div className="bd-plate" id={`board-plate-${bk.id}`} data-fid={bk.id} role="button" tabIndex={lit ? 0 : -1} title="Drag to move the volume and its notes. Click to open it.">
									<span className="bd-rn smallcaps">Vol. {toRoman(i + 1)}</span>
									<span className="bd-vn"><Marked text={bk.title} tokens={tokens}/></span>
									<span className="bd-vc smallcaps">{plural(count, 'note')}</span>
								</div>
								<p className="bd-fd">{bk.description}</p>
								<p className="bd-fe" hidden={count > 0}>Drop a note here to file it.</p>
							</section>
						)
					})}

					{ ordered.map(id => {
						const note = noteMap.get(id), fresh = s.fresh.get(`n${id}`)
						return <NoteEl key={id} note={note} home={bookMap.get(homes.get(id))} tokens={tokens} refCb={reg(s.nEl, id)}
							faded={tokens.length > 0 && !noteMatches(note, tokens)} className={noteClass(id)} style={fresh?.delay ? { animationDelay: `${fresh.delay}ms` } : undefined}/>
					})}

				</div>
			</main>

			<div className="bd-hand"><div className="bd-handw" ref={handRef}>
				{ heldNote && <NoteEl clone note={heldNote} home={bookMap.get(homes.get(held.id))} tokens={tokens}
					refCb={(el) => { s.heldEl = el }} className={held.phase === 'lift' ? 'bd-lift' : held.phase === 'settle' ? 'bd-settling' : ''}/> }
			</div></div>

			<nav id="board-rail" className="bd-rail" aria-label="View">
				<button className="bd-zb" type="button" id="board-zoom-in" title="Zoom in (+)" aria-label="Zoom in" onClick={() => zoomMid(1.25)}>+</button>
				<button className="bd-zl smallcaps" type="button" id="board-zoom-level" ref={zoomRef} title="Actual size" aria-label="Zoom level, click for actual size" onClick={() => zoomMid(1 / s.view.z)}></button>
				<button className="bd-zb" type="button" id="board-zoom-out" title="Zoom out (-)" aria-label="Zoom out" onClick={() => zoomMid(.8)}>&minus;</button>
				<button className="bd-lb" type="button" id="board-fit" title="Show all notes (0)" onClick={() => fitView(true)}><i aria-hidden="true">&#8689;</i><span className="smallcaps">Fit</span></button>
				<button className="bd-lb bd-tidy" type="button" id="board-tidy" title="Tidy up into a grid (T)" onClick={tidy}><i aria-hidden="true">&para;</i><span className="smallcaps">Tidy</span></button>
			</nav>

			{ nothingFound && (
				<div id="board-empty" className="bd-empty">Nothing in your notes for &ldquo;{searchTerm.trim()}&rdquo;<small className="smallcaps">&crarr; search the web instead</small></div>
			)}

			{ s.place && <div id="board-placing" className="bd-placing smallcaps" role="status">Click to place &nbsp;&middot;&nbsp; Esc to drop anywhere</div> }

			{ toast && (
				<div id="board-toast" className={`bd-toast ${toast.on ? 'bd-on' : ''}`} role="status" aria-live="polite">
					{toast.text}
					{ toast.undo && <button type="button" id="board-undo" className="bd-undo smallcaps" onClick={() => { toast.undo(); setToast(t => t && { ...t, on: false }) }}>Undo</button> }
				</div>
			)}
			<div className="bd-sr" ref={liveRef} aria-live="polite"></div>
		</div>
	)
}
