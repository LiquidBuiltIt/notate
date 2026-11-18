import { uniqueId } from './InputFormatters.js'
import { TEXT_EDITOR_ID } from './TextInput.jsx'

// Images go into the note as data URLs. A big picture is shrunk to WebP first so one note does not fill the database.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 1600
const KEEP_BYTES = 500 * 1024
const MAX_PIXELS = 40_000_000 // a small file can declare a huge picture; drawing it could exhaust memory

const read = (file) => new Promise((resolve, reject) => {
	const reader = new FileReader()
	reader.onload = () => resolve(reader.result)
	reader.onerror = reject
	reader.readAsDataURL(file)
})

const load = (src) => new Promise((resolve, reject) => {
	const image = new Image()
	image.onload = () => resolve(image)
	image.onerror = reject
	image.src = src
})

// Takes the editor's caret now, before any await: a web page can move the selection while a file is read.
// The returned function puts an <img> at that caret, or at the end of the editor when the caret is gone or was never in it. Never elsewhere.
const caretInserter = (root) => {
	const editor = root.getElementById(TEXT_EDITOR_ID)
	if (!editor) return null
	const selection = root.getSelection?.()
	const range = selection?.rangeCount ? selection.getRangeAt(0).cloneRange() : null
	const inside = () => range && editor.contains(range.commonAncestorContainer)
	return (img) => {
		if (inside()) { range.deleteContents(); range.insertNode(img); range.collapse(false) }
		else editor.appendChild(img)
	}
}

// Builds the <img> for an image file and hands it to `insert`. Returns false when the file is not accepted.
// A small, ordinary image keeps its original bytes (GIF animation and PNG alpha stay). SVG is always drawn to a bitmap.
export const insertImageFile = async (file, root, insert = caretInserter(root)) => {
	if (!insert || !file?.type.startsWith('image/') || file.size > MAX_FILE_BYTES) return false
	try {
		let src = await read(file)
		const source = await load(src)
		let width = source.naturalWidth, height = source.naturalHeight
		if (!width || !height || width * height > MAX_PIXELS) return false
		const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
		if (scale < 1 || file.size > KEEP_BYTES || file.type === 'image/svg+xml') {
			const w = Math.max(1, Math.round(width * scale))
			const h = Math.max(1, Math.round(height * scale))
			const canvas = document.createElement('canvas')
			canvas.width = w
			canvas.height = h
			canvas.getContext('2d').drawImage(source, 0, 0, w, h)
			const webp = canvas.toDataURL('image/webp', 0.85)
			// A picture that is within 1600 px and that WebP does not make smaller keeps its original bytes. SVG has no bitmap to keep.
			if (scale < 1 || file.type === 'image/svg+xml' || webp.length < src.length) { src = webp; width = w; height = h }
		}
		const img = document.createElement('img')
		img.src = src
		img.id = uniqueId('img')
		img.style.width = `${width}px`
		img.setAttribute('draggable', 'true')
		img.setAttribute('data-natural-width', width)
		img.setAttribute('data-natural-height', height)
		insert(img)
		return true
	} catch {
		return false
	}
}

export const pickImage = (root) => {
	const input = document.createElement('input')
	input.type = 'file'
	input.accept = 'image/*'
	const insert = caretInserter(root) // the caret as it is now, before the dialog opens
	input.onchange = () => insertImageFile(input.files[0], root, insert)
	input.click()
}
