import React from 'react';
import { NotateContext } from '@notate/Notate.jsx'
import { NOTATE_DB, USER_CONFIGURATION_DB } from '@background/background.js'
import { ConfirmationMsgContext } from '@notate/Components/Modals/ConfirmationModal/ConfirmationMsg.jsx'
import NoteHandler from '@universal/Handlers/NoteHandler.js'
import NotebookHandler from '@universal/Handlers/NotebookHandler.js'
import { NoteColors } from '@notate/Components/Modals/NoteModal/Components/NoteColorProvider.js'
import { searchEngineProviders } from './searchEngineProviders.js'
import { tokensOf, noteMatches, volumeMatches, looseNotes } from './matching.js'
import { isBoardOn } from '@notate/Components/Board/boardMath.js'

const DEFAULT_ENGINE = 'perplexityai'
const COMMANDS = [
	{ name: 'note', arg: '"my note"', desc: 'Create a note with this title' },
	{ name: 'notebook', arg: '"my notebook"', desc: 'Create a notebook (a new volume)' }
]
const NOTICE_MS = 3000
const TUCK_DELAY_MS = 400

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`

// "/note", "/note "text"": pick mode while the name is still being typed, args mode after a space.
const parseSlash = (value) => {
	const [ , name, spaced, rest ] = value.match(/^\/(\S*)(\s+([\s\S]*))?$/)
	const lower = name.toLowerCase()

	if (spaced !== undefined) {
		const arg = (rest || '').trim().replace(/^["“]|["”]$/g, '').trim()
		return { mode: 'args', name: lower, command: COMMANDS.find(c => c.name === lower), arg }
	}
	return { mode: 'pick', name: lower, list: COMMANDS.filter(c => c.name.startsWith(lower)) }
}

const Key = ({ k, children, optional }) => (
	<span className={optional ? "max-[760px]:hidden" : ""}>
		<b className="inline-block mr-[5px] px-1 pt-[2px] pb-px border border-ink-faint font-normal tracking-[.04em] text-ink-soft">{k}</b>{children}
	</span>
)

export default function SearchBar() {
	const {
		SEARCH_TERM_CONTEXT, NOTATE_DB_CONTEXT, USER_CONFIGURATION_DB_CONTEXT, REQUEST_CONTEXT,
		NOTE_CONTEXT, NOTEBOOK_CONTEXT, DRAG_TO_TRASH_STATE_CONTEXT, SETTINGS_OPEN_CONTEXT, BOARD_API_CONTEXT
	} = React.useContext(NotateContext)
	const [ confMsgState ] = React.useContext(ConfirmationMsgContext)
	const [ , setSearchTerm ] = SEARCH_TERM_CONTEXT
	const [ database ] = NOTATE_DB_CONTEXT
	const [ configuration ] = USER_CONFIGURATION_DB_CONTEXT
	const [ , makeRequest ] = REQUEST_CONTEXT
	const [ selectedNote, setSelectedNote ] = NOTE_CONTEXT
	const [ selectedNotebook, setSelectedNotebook ] = NOTEBOOK_CONTEXT
	const [ dragging ] = DRAG_TO_TRASH_STATE_CONTEXT
	const [ settingsOpen ] = SETTINGS_OPEN_CONTEXT

	const [ value, setValue ] = React.useState('')
	const [ selected, setSelected ] = React.useState(0)
	const [ notice, setNotice ] = React.useState(null)
	const [ menuOpen, setMenuOpen ] = React.useState(false)
	const [ hotHover, setHotHover ] = React.useState(false)
	const [ dockHover, setDockHover ] = React.useState(false)
	const [ focusWithin, setFocusWithin ] = React.useState(false)
	const [ up, setUp ] = React.useState(false)

	const inputRef = React.useRef(null)
	const chipRef = React.useRef(null)
	const menuRef = React.useRef(null)

	const modalOpen = !!(selectedNote || selectedNotebook || confMsgState || settingsOpen)

	/* The engine lives in the stored settings, so Settings and the bar always agree. */
	const configured = configuration?.inventory?.USER_CONFIGURATION?.[0]?.Notate?.search?.preferredEngine?.value
	const engineId = Object.hasOwn(searchEngineProviders, configured) ? configured : DEFAULT_ENGINE
	const engine = searchEngineProviders[engineId]

	/* Matching, derived from the stored data so a saved edit never resets it. */
	const slash = value.startsWith('/')
	const tokens = React.useMemo(() => slash ? [] : tokensOf(value), [value, slash])
	const notes = database?.inventory?.NOTES ?? []
	const notebooks = database?.inventory?.NOTEBOOKS ?? []
	// The board shows every note on the sheet; the grid shows only the loose ones.
	const board = isBoardOn(configuration)
	const hitIds = React.useMemo(
		() => (board ? notes : looseNotes(notes, notebooks)).filter(note => noteMatches(note, tokens)).map(note => note.id),
		[notes, notebooks, tokens, board]
	)
	const noteHits = hitIds.length
	const volumeHits = React.useMemo(
		() => notebooks.filter(notebook => volumeMatches(notebook, notes, tokens)).length,
		[notes, notebooks, tokens]
	)
	const nothingFound = tokens.length > 0 && noteHits === 0 && volumeHits === 0
	const command = slash ? parseSlash(value) : null
	const rows = command ? (command.mode === 'pick' ? command.list : (command.command ? [command.command] : [])) : []
	const row = rows[Math.min(selected, rows.length - 1)]


	/* Up while hovered, focused, holding text or showing a menu; tucks after a short delay. */
	const wantUp = !dragging && (hotHover || dockHover || focusWithin || value !== '' || menuOpen)

	React.useEffect(() => {
		if (wantUp) { setUp(true); return }
		const timer = setTimeout(() => setUp(false), TUCK_DELAY_MS)
		return () => clearTimeout(timer)
	}, [wantUp])

	// No pointer events reach the bar during a drag, so forget any hover it had.
	React.useEffect(() => {
		if (dragging) { setHotHover(false); setDockHover(false) }
	}, [dragging])

	React.useEffect(() => {
		if (!notice) return
		const timer = setTimeout(() => setNotice(null), NOTICE_MS)
		return () => clearTimeout(timer)
	}, [notice])

	React.useEffect(() => {
		if (menuOpen) menuRef.current?.querySelector('[aria-selected="true"]')?.focus()
	}, [menuOpen])


	const changeValue = (next) => {
		setValue(next)
		setSelected(0)
		setNotice(null)
		setSearchTerm(next.startsWith('/') ? '' : next)
	}

	const closeMenu = (returnTo) => {
		setMenuOpen(false)
		returnTo?.focus()
	}


	/* Slash commands, through the same requests the editors use. */
	const complete = (picked) => {
		changeValue(`/${picked.name} "`)
		inputRef.current?.focus()
	}

	const runCommand = () => {
		const { command: cmd, arg } = command
		if (!cmd) return

		// With no title the command opens the blank editor instead.
		if (!arg) {
			changeValue('')
			inputRef.current?.blur()
			if (cmd.name === 'note') setSelectedNote(new NoteHandler.Note)
			else setSelectedNotebook(new NotebookHandler.Notebook)
			return
		}

		if (cmd.name === 'note') {
			const note = new NoteHandler.Note(arg)
			const name = configuration?.inventory?.USER_CONFIGURATION?.[0]?.Notate?.noteModal?.preferredColor?.value
			// Same stored shape the note editor writes.
			if (Object.hasOwn(NoteColors, name)) note.color = { name, styles: NoteColors[name] }
			BOARD_API_CONTEXT.current?.expectPlace()
			makeRequest({ type: 'POST_DATABASE', data: note, store: 'NOTES', database: NOTATE_DB })
		} else {
			makeRequest({ type: 'POST_DATABASE', data: new NotebookHandler.Notebook(arg), store: 'NOTEBOOKS', database: NOTATE_DB })
		}

		changeValue('')
		setNotice(`${cmd.name === 'note' ? 'Note' : 'Notebook'} created: ${arg}`)
	}

	const searchTheWeb = () => {
		const text = value.trim()
		if (text) window.location.assign(engine.URLPrefix + encodeURIComponent(text))
	}


	/* The engine menu. */
	const pickEngine = (id) => {
		if (id !== configured) {
			makeRequest({
				type: 'PATCH_DATABASE',
				data: { Notate: { search: { preferredEngine: { value: id } } } },
				store: 'USER_CONFIGURATION',
				database: USER_CONFIGURATION_DB
			})
		}
		setNotice(`Enter searches ${searchEngineProviders[id].name}`)
		closeMenu(inputRef.current)
	}

	const handleMenuKeys = (event) => {
		const options = [...menuRef.current.querySelectorAll('[role="option"]')]
		const i = options.indexOf(document.activeElement)
		const key = event.key

		if (key === 'ArrowDown' || key === 'ArrowUp') {
			event.preventDefault()
			options[(i + (key === 'ArrowDown' ? 1 : -1) + options.length) % options.length].focus()
		} else if (key === 'Home' || key === 'End') {
			event.preventDefault()
			options[key === 'Home' ? 0 : options.length - 1].focus()
		} else if ((key === 'Enter' || key === ' ') && i >= 0) {
			event.preventDefault()
			pickEngine(options[i].dataset.id)
		} else if (key === 'Escape') {
			event.preventDefault()
			event.stopPropagation()
			closeMenu(chipRef.current)
		} else if (key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
			options.find(o => o.dataset.name.toLowerCase().startsWith(key.toLowerCase()))?.focus()
		}
	}

	const handleMenuBlur = (event) => {
		if (menuRef.current && !menuRef.current.contains(event.relatedTarget) && event.relatedTarget !== chipRef.current) closeMenu()
	}


	/* Keys on the input. */
	const handleInputKeys = (event) => {
		// An IME uses Enter, the arrows and Tab to pick candidates.
		if (event.nativeEvent.isComposing || event.keyCode === 229) return

		const key = event.key

		if (key === 'Enter') {
			event.preventDefault()
			if (!slash) searchTheWeb()
			else if (command.mode === 'pick') { if (row) complete(row) }
			else runCommand()
		} else if (slash && key === 'Tab' && row) {
			event.preventDefault()
			complete(row)
		} else if (slash && (key === 'ArrowDown' || key === 'ArrowUp') && rows.length) {
			event.preventDefault()
			setSelected((Math.min(selected, rows.length - 1) + (key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length)
		} else if (key === 'ArrowDown' && !slash) {
			event.preventDefault()
			const card = document.querySelector('#recent-notes-grid [id^="note-card-"][tabindex="0"], #board-world .bd-note[tabindex="0"]')
			if (card) card.focus()
			else setMenuOpen(true)
		}
	}

	const handleDockKeys = (event) => {
		if (event.key !== 'Escape') return
		if (value) changeValue('')
		else document.activeElement?.blur()
	}


	/* Page keys: "/" focuses the bar, Alt+E opens the engine menu. Neither works while a modal is open. */
	React.useEffect(() => {
		const handleKeys = (event) => {
			if (modalOpen) return

			// By key, not code: AltGr+E and Option+E type a character and must keep it.
			if (event.altKey && !event.ctrlKey && event.key.toLowerCase() === 'e') {
				event.preventDefault()
				if (menuOpen) closeMenu(chipRef.current)
				else setMenuOpen(true)
			} else if (event.key === '/' && !event.ctrlKey && !event.metaKey && !event.altKey) {
				const active = document.activeElement
				if (/^(INPUT|TEXTAREA|SELECT)$/.test(active?.tagName) || active?.isContentEditable) return
				event.preventDefault()
				inputRef.current?.focus()
			}
		}

		document.addEventListener('keydown', handleKeys)
		return () => document.removeEventListener('keydown', handleKeys)
	}, [modalOpen, menuOpen])


	/* The status line says what Enter will do. */
	let status, warn = false, keys
	if (slash) {
		if (command.mode === 'args' && command.command) {
			status = command.arg
				? <>&crarr; create {command.command.name} <q className="normal-case tracking-[.01em] italic text-[14px]">{command.arg}</q></>
				: `↵ open a blank ${command.command.name}`
		} else if (command.mode === 'args' || !rows.length) {
			status = 'Unknown command'; warn = true
		} else {
			status = `Command · ${plural(rows.length, 'match').replace('matchs', 'matches')}`
		}
		keys = <><Key k="Tab">pick</Key><Key k={"↑↓"} optional>choose</Key><Key k={"↵"}>run</Key><Key k="Esc">clear</Key></>
	} else {
		if (notice) status = notice
		else if (menuOpen) status = 'Choose where Enter searches'
		else if (!tokens.length) status = `${plural(notes.length, 'note')} · ${plural(notebooks.length, 'volume')}`
		else if (nothingFound) { status = `No notes match — Enter searches ${engine.name}`; warn = true }
		else {
			const away = board ? BOARD_API_CONTEXT?.current?.countOutOfView(hitIds) ?? 0 : 0
			status = `${plural(noteHits, 'note')} · ${plural(volumeHits, 'volume')}${away ? ` · ${away} out of view` : ''} · Enter searches ${engine.name}`
		}

		if (tokens.length) keys = <>{noteHits > 0 && <Key k={"↓"} optional>matches</Key>}<Key k="Esc">clear</Key></>
		else keys = focusWithin ? <><Key k="/">commands</Key><Key k="Alt E" optional>engine</Key><Key k="Esc">close</Key></> : <Key k="/">focus</Key>
	}


	return (
		<div id="search-bar-container" className="contents">
			<div
			 id="search-bar-hot"
			 className={`dock-hot ${ dragging ? "pointer-events-none" : "" }`}
			 aria-hidden="true"
			 onPointerEnter={(e) => e.pointerType === 'mouse' && setHotHover(true)}
			 onPointerLeave={() => setHotHover(false)}
			/>

			<div
			 id="search-bar-dock"
			 className={`dock ${ up ? "up" : "" } ${ dragging ? "dragging" : "" }`}
			 onPointerEnter={(e) => e.pointerType === 'mouse' && setDockHover(true)}
			 onPointerLeave={() => setDockHover(false)}
			 onFocus={() => setFocusWithin(true)}
			 onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setFocusWithin(false) }}
			 onKeyDown={handleDockKeys}
			>
				<div
				 id="search-bar-tab"
				 className="dock-tab smallcaps paper-grain text-ink"
				 aria-hidden="true"
				 onClick={() => inputRef.current?.focus()}
				>&sect; Search &nbsp;&middot;&nbsp; /</div>

				<div className="dock-slip paper-grain">
					{ slash && (
						<div id="search-commands" role="listbox" aria-label="Commands"
						 className="absolute left-0 right-0 bottom-[calc(100%+12px)] paper-grain hairline shadow-print animate-rise">
							<div className="smallcaps px-4 pt-[10px] pb-2 text-ink-faint border-b border-paper-edge">Commands</div>
							{ rows.length ? rows.map((c, i) => (
								<div
								 key={c.name}
								 id={`search-command-${c.name}`}
								 role="option"
								 aria-selected={c === row}
								 data-command={c.name}
								 className={`grid grid-cols-[8.5rem_11rem_1fr] max-xl:grid-cols-[7rem_1fr] items-baseline gap-3 py-[11px] pr-4 pl-[14px] border-l-2 cursor-pointer ${ i > 0 ? "border-t border-t-paper-edge" : "" } ${ c === row ? "border-l-vermilion" : "border-l-transparent" }`}
								 onMouseDown={(e) => { e.preventDefault(); complete(c) }}
								>
									<span className={`font-display italic text-[21px] leading-none ${ c === row ? "text-ink" : "text-ink-soft" }`}>/{c.name}</span>
									<span className="italic text-[17px] text-ink-faint max-xl:hidden">{c.arg}</span>
									<span className={`text-[16.5px] ${ c === row ? "text-ink" : "text-ink-soft" }`}>{c.desc}</span>
								</div>
							)) : (
								<div className="p-4 italic text-ink-soft">No command called <i className="text-vermilion-ink">/{command.name}</i>. Try <i>/note</i> or <i>/notebook</i>.</div>
							)}
						</div>
					)}

					{ menuOpen && (
						<div id="search-engine-menu" role="listbox" aria-label="Search engine" ref={menuRef}
						 className="absolute right-0 bottom-[calc(100%+12px)] z-[2] w-[17rem] paper-grain hairline shadow-print animate-rise"
						 onKeyDown={handleMenuKeys}
						 onBlur={handleMenuBlur}
						 onMouseDown={(e) => { if (!e.target.closest('[role="option"]')) e.preventDefault() }}
						>
							<div className="smallcaps px-4 pt-[10px] pb-2 text-ink-faint border-b border-paper-edge">Enter searches</div>
							{ Object.entries(searchEngineProviders).map(([id, provider], i) => (
								<div
								 key={id}
								 id={`search-engine-${id}`}
								 role="option"
								 tabIndex={-1}
								 aria-selected={id === engineId}
								 data-id={id}
								 data-name={provider.name}
								 className={`grid grid-cols-[18px_1fr_auto] items-center gap-3 py-[7px] pr-[14px] pl-3 border-l-2 border-l-transparent text-[19px] leading-[1.2] cursor-pointer hover:border-l-vermilion hover:bg-paper-deep focus:border-l-vermilion focus:bg-paper-deep focus:outline-none ${ i > 0 ? "border-t border-t-paper-edge" : "" } ${ id === engineId ? "italic" : "" }`}
								 onClick={() => pickEngine(id)}
								>
									<img src={provider.favicon} alt="" width="18" height="18" className="size-[18px] object-contain"/>
									<span>{provider.name}</span>
									{ id === engineId && <span className="smallcaps text-vermilion-ink">current</span> }
								</div>
							))}
						</div>
					)}

					<div className="dock-ink smallcaps flex justify-between items-baseline gap-4 mb-2 min-h-[13px] text-ink-soft whitespace-nowrap">
						<span id="search-status" role="status" aria-live="polite" aria-atomic="true"
						 className={`overflow-hidden text-ellipsis ${ warn ? "text-vermilion-ink" : "" }`}>{status}</span>
						<span className="flex-1"></span>
						<span id="search-keys" aria-hidden="true" className="flex shrink-0 gap-4 text-ink-faint">{keys}</span>
						{ !slash && (
							<button
							 id="search-engine-chip"
							 ref={chipRef}
							 type="button"
							 aria-haspopup="listbox"
							 aria-expanded={menuOpen}
							 aria-label={`Search engine: ${engine.name}. Change`}
							 data-engine={engineId}
							 className="focus-ink flex shrink-0 items-center gap-[7px] -my-[3px] py-[3px] pl-3 border-l border-paper-edge text-ink whitespace-nowrap hover:text-vermilion-ink"
							 onClick={() => menuOpen ? closeMenu() : setMenuOpen(true)}
							 onKeyDown={(e) => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); setMenuOpen(true) } }}
							>
								<img src={engine.favicon} alt="" width="18" height="18" className="size-[18px] object-contain"/>
								<span className="smallcaps">{engine.name}</span>
								<span aria-hidden="true" className={`text-[10px] transition-transform duration-200 ${ menuOpen ? "rotate-180" : "" }`}>&#9662;</span>
							</button>
						)}
					</div>

					<div className="flex items-end gap-4">
						<div className="dock-field relative flex flex-1 min-w-0 items-baseline gap-4 border-b border-ink">
							<label htmlFor="searchInput" className={`dock-ink smallcaps shrink-0 cursor-text trans-ease ${ slash ? "text-vermilion-ink" : "text-ink-soft" }`}>{ slash ? "Command" : "Search" }</label>
							<input
							 type="text"
							 id="searchInput"
							 ref={inputRef}
							 role="combobox"
							 aria-expanded={slash}
							 aria-controls="search-commands"
							 aria-autocomplete="list"
							 aria-activedescendant={slash && row ? `search-command-${row.name}` : undefined}
							 autoComplete="off"
							 spellCheck="false"
							 className={`dock-input flex-1 min-w-0 py-2 bg-transparent font-serif text-[clamp(20px,1.7vw,26px)] leading-tight text-ink caret-vermilion text-ellipsis rounded-none outline-none placeholder:italic placeholder:text-ink-faint ${ slash ? "italic" : "" }`}
							 placeholder="Search your notes, / for commands, &crarr; for the web"
							 value={value}
							 onChange={(e) => changeValue(e.target.value)}
							 onKeyDown={handleInputKeys}
							/>
							<span className="dock-draw"/>
						</div>

						<button
						 id="new-note-button"
						 type="button"
						 aria-label="New note"
						 className="focus-ink shrink-0 flex items-center gap-[10px] h-[50px] px-[22px] bg-ink text-paper transition duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[3px_3px_0_0_theme(colors.vermilion.DEFAULT)]"
						 onClick={() => setSelectedNote(new NoteHandler.Note)}
						>
							<span aria-hidden="true" className="text-[22px] leading-none">+</span><span className="smallcaps">New</span>
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}
