import { uniqueId } from './InputFormatters.js'

// Images go into the note as data URLs. A big picture is shrunk to WebP first so one note does not fill the database.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const MAX_SIDE = 1600
const KEEP_BYTES = 500 * 1024

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

const insertAtCaret = (img) => document.execCommand('insertHTML', false, img.outerHTML)

// Builds the <img> for an image file and hands it to `insert`. Returns false when the file is not accepted.
// A small, ordinary image keeps its original bytes (GIF animation and PNG alpha stay). SVG is always drawn to a bitmap.
export const insertImageFile = async (file, insert = insertAtCaret) => {
	if (!file?.type.startsWith('image/') || file.size > MAX_FILE_BYTES) return false
	try {
		let src = await read(file)
		const source = await load(src)
		let width = source.naturalWidth, height = source.naturalHeight
		if (!width || !height) return false
		const scale = Math.min(1, MAX_SIDE / Math.max(width, height))
		if (scale < 1 || file.size > KEEP_BYTES || file.type === 'image/svg+xml') {
			width = Math.max(1, Math.round(width * scale))
			height = Math.max(1, Math.round(height * scale))
			const canvas = document.createElement('canvas')
			canvas.width = width
			canvas.height = height
			canvas.getContext('2d').drawImage(source, 0, 0, width, height)
			src = canvas.toDataURL('image/webp', 0.85)
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

export const pickImage = () => {
	const input = document.createElement('input')
	input.type = 'file'
	input.accept = 'image/*'
	input.onchange = () => insertImageFile(input.files[0])
	input.click()
}
