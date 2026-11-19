import { TEXT_EDITOR_ID } from './TextInput.jsx'

// Block formats (lists, checkbox, headings, quote). Making a block goes through execCommand, so Ctrl+Z undoes it.
// A checkbox is a list item with data-checked; the box is drawn by CSS and is never an <input>.
// Ticking or unticking sets the attribute directly, so it is not in the undo history.
const TAGS = { h1: 'h1', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h5', h6: 'h6', quote: 'blockquote' }
const SHORTCUTS = { '-': 'ul', '*': 'ul', '1.': 'ol', '#': 'h1', '##': 'h2', '###': 'h3', '####': 'h4', '#####': 'h5', '######': 'h6', '>': 'quote' }
// "[ ]", "[]", "-[ ]", "- [x]" ... : "- " alone has already made a list item, so a box typed in an item ticks or unticks that item.
const BOX = /^(?:- ?)?\[([ xX]?)\]$/
const BLOCK_TAGS = new Set(['br', 'div', 'p', 'ul', 'ol', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'table', 'hr'])

// The element of the caret, if it is inside the editor.
const caretIn = (root, selector) => {
	const node = root.getSelection()?.anchorNode
	const found = (node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement)?.closest(selector)
	return found && root.getElementById(TEXT_EDITOR_ID)?.contains(found) ? found : null
}

export const applyBlock = (root, kind) => {
	if (kind === 'ul' || kind === 'ol') return document.execCommand(kind === 'ul' ? 'insertUnorderedList' : 'insertOrderedList')
	if (kind === 'check' || kind === 'checked') {
		const state = kind === 'checked' ? 'true' : 'false'
		const li = caretIn(root, 'li')
		if (li && !li.hasAttribute('data-checked')) return li.setAttribute('data-checked', state)
		// Second press: the item stops being a checkbox and the list is undone.
		if (li) return document.execCommand(li.parentElement.localName === 'ol' ? 'insertOrderedList' : 'insertUnorderedList')
		document.execCommand('insertUnorderedList')
		return caretIn(root, 'li')?.setAttribute('data-checked', state)
	}
	document.execCommand('formatBlock', false, caretIn(root, TAGS[kind]) ? 'div' : TAGS[kind])
}

export const toggleChecked = (li) => li.setAttribute('data-checked', li.getAttribute('data-checked') === 'true' ? 'false' : 'true')

// Ctrl+Enter: flip the item the caret is in. Returns false when the caret is not in a checkbox.
export const toggleCaretItem = (root) => {
	const li = caretIn(root, 'li[data-checked]')
	if (li) toggleChecked(li)
	return !!li
}

// Chrome copies data-checked when Enter splits an item. Taken at keydown and applied after the input, these make only the new items start unchecked.
export const checkboxItems = (editor) => new Set(editor.querySelectorAll('li[data-checked]'))
export const uncheckNewItems = (editor, before) => editor.querySelectorAll('li[data-checked]').forEach((li) => { if (!before.has(li)) li.setAttribute('data-checked', 'false') })

// Typing Space after "-", "1.", "[ ]", "#" ... at the start of a line turns the line into that block. Returns true when it did.
export const blockShortcut = (root) => {
	const selection = root.getSelection()
	const node = selection?.anchorNode
	if (!selection.isCollapsed || node?.nodeType !== Node.TEXT_NODE) return false
	const prefix = node.data.slice(0, selection.anchorOffset).replace(/ /g, ' ')
	const box = BOX.exec(prefix)
	const kind = box ? (box[1].trim() ? 'checked' : 'check') : Object.hasOwn(SHORTCUTS, prefix) && SHORTCUTS[prefix]
	const parent = node.parentElement
	const before = node.previousSibling
	const inItem = box && parent.localName === 'li' && !parent.hasAttribute('data-checked')
	if (!kind || !(inItem || parent.id === TEXT_EDITOR_ID || ['div', 'p'].includes(parent.localName)) || (before && !BLOCK_TAGS.has(before.localName))) return false
	selection.setBaseAndExtent(node, 0, node, selection.anchorOffset)
	document.execCommand('delete')
	applyBlock(root, kind)
	return true
}
