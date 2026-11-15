import plainText from '@universal/Utils/plainText.js'

// Search matching shared by the bar, the note grid and the volumes list.
// A term is split on spaces. Every word must appear somewhere in the item.

export const tokensOf = (query = '') =>
	[...new Set(query.toLowerCase().split(/\s+/).filter(Boolean))].sort((a, b) => b.length - a.length)

const noteHay = (note) => [note.title, plainText(note.content ?? ''), note.origin ?? ''].join('\n').toLowerCase()

export const noteMatches = (note, tokens) => tokens.length > 0 && tokens.every(t => noteHay(note).includes(t))

// A volume matches on its own title and description, or when a note filed in it matches.
export const volumeMatches = (notebook, notes, tokens) => {
	if (!tokens.length) return false
	const own = `${notebook.title ?? ''}\n${notebook.description ?? ''}`.toLowerCase()
	if (tokens.every(t => own.includes(t))) return true
	const ids = notebook.collection ?? []
	return (notes ?? []).some(note => ids.includes(note.id) && noteMatches(note, tokens))
}

// Notes filed in a volume show through the volume, so the note grid only holds the loose ones.
export const looseNotes = (notes, notebooks) => {
	const filed = new Set((notebooks ?? []).flatMap(notebook => notebook.collection ?? []))
	return (notes ?? []).filter(note => !filed.has(note.id))
}
