import React from 'react';
import { createPortal } from 'react-dom'
import browser from 'webextension-polyfill'
import { NotateContext } from '@notate/Notate.jsx';
import { compareVersions, hasUnseenNotes, newestFirst, renderBullet } from '@universal/Changelog/changelog.js'

const bulletParts = (text) => renderBullet(text).map((p, i) =>
	p.type === 'bold' ? <strong key={i} className="font-semibold">{p.text}</strong>
	: p.type === 'code' ? <code key={i} className="font-mono text-[.9em]">{p.text}</code>
	: <React.Fragment key={i}>{p.text}</React.Fragment>)

export default function WhatsNewWidget() {
	const { SCROLL_STATE_CONTEXT, WHATS_NEW_OPEN_CONTEXT } = React.useContext(NotateContext)
	const [ , setScrollState ] = SCROLL_STATE_CONTEXT
	const [ open, setOpen ] = WHATS_NEW_OPEN_CONTEXT

	const version = browser.runtime.getManifest().version
	const [ sections, setSections ] = React.useState(null)   // null until loaded, or when the file is missing or broken
	const [ failed, setFailed ] = React.useState(false)
	const [ lastSeen, setLastSeen ] = React.useState(null)
	const [ seenAtOpen, setSeenAtOpen ] = React.useState(null)

	React.useEffect(() => {
		fetch(browser.runtime.getURL('changelog.json'))
			.then((r) => r.json())
			.then((data) => { if (!Array.isArray(data?.sections)) throw new Error('no sections'); setSections(data.sections) })
			.catch(() => setFailed(true))
		browser.storage.local.get('lastSeenVersion').then((v) => setLastSeen(v.lastSeenVersion ?? null))
		// The background stores the value on install and update, which can land after this page loads.
		const onChange = (changes, area) => { if (area === 'local' && changes.lastSeenVersion) setLastSeen(changes.lastSeenVersion.newValue ?? null) }
		browser.storage.onChanged.addListener(onChange)
		return () => browser.storage.onChanged.removeListener(onChange)
	}, [])

	const dot = !!sections && hasUnseenNotes(sections, lastSeen, version)

	const openPanel = () => {
		setSeenAtOpen(lastSeen)
		setLastSeen(version)
		browser.storage.local.set({ lastSeenVersion: version })
		setOpen(true)
	}
	const close = () => setOpen(false)

	React.useEffect(() => {
		if (!open) return
		setScrollState(false)
		const onKey = (e) => { if (e.key === 'Escape') close() }
		window.addEventListener('keydown', onKey)
		return () => { window.removeEventListener('keydown', onKey); setScrollState(true) }
	}, [open])

	const isNew = (s) => seenAtOpen !== null && compareVersions(s.version, seenAtOpen) > 0 && compareVersions(s.version, version) <= 0

	const panel = open && (
		<div id="whats-new-modal-container"
			className="fixed z-modal left-0 top-0 w-full h-screen bg-paper/75 flex items-center justify-center p-6 font-serif text-ink"
			onClick={(e) => { if (e.target === e.currentTarget) close() }}>
			<div id="whats-new-modal" role="dialog" aria-modal="true" aria-labelledby="whats-new-title"
				className="paper-grain hairline shadow-print-lg flex flex-col w-[36rem] max-w-full max-h-full px-8 pt-6 pb-8 animate-unfold">
				<header className="flex pb-3 mb-4 items-baseline justify-between border-b-2 border-ink">
					<h1 id="whats-new-title" className="font-display italic font-semibold text-[40px] leading-none text-ink">What's new</h1>
					<button id="whats-new-close" type="button" autoFocus aria-label="Close what's new" title="Close"
						className="focus-ink font-serif text-[34px] leading-none px-2 text-ink-soft transition duration-150 ease-out hover:text-vermilion-ink"
						onClick={close}>&times;</button>
				</header>
				<div id="whats-new-content" className="overflow-auto space-y-8">
					{ !sections && <p id="whats-new-fallback" className="text-[17px] italic text-ink-soft">The release notes could not be loaded.</p> }
					{ sections && newestFirst(sections).map((s) => (
						<section key={s.version} className="whats-new-section" data-version={s.version} data-new={isNew(s) ? 'true' : 'false'}>
							<h2 className="flex items-baseline gap-3 smallcaps text-vermilion-ink pb-2 border-b border-ink">
								<span className="font-display italic text-[26px] normal-case tracking-normal text-ink">{s.version}</span>
								{ s.date && <span className="text-ink-soft">{s.date}</span> }
								{ isNew(s) && <span className="ml-auto">New</span> }
							</h2>
							{ s.blurb && <p className="mt-3 text-[17px] italic text-ink-soft">{s.blurb}</p> }
							<ul className="mt-3 space-y-2 list-disc pl-5 text-[17px] leading-relaxed">
								{ s.bullets.map((b, i) => <li key={i}>{bulletParts(b)}</li>) }
							</ul>
						</section>
					))}
				</div>
			</div>
		</div>
	)

	return (
		<>
			<button id="whats-new-widget"
			type="button"
			aria-label={dot ? "What's new (updated)" : "What's new"}
			title="What's new"
			className="smallcaps focus-ink relative flex items-center gap-2 pb-1 border-b border-ink text-ink trans-ease hover:text-vermilion-ink hover:border-vermilion"
			onClick={openPanel}>
				<span aria-hidden="true" className="text-[15px] leading-none">&para;</span>What's new
				{ dot && <span id="whats-new-dot" aria-hidden="true" className="absolute -top-1 -right-3 size-2 rounded-full bg-vermilion"></span> }
			</button>
			{ panel && createPortal(panel, document.body) }
		</>
	)
}
