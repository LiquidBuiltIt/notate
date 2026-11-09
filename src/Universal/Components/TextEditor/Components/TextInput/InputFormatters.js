import { TEXT_EDITOR_ID } from './TextInput.jsx'

// execCommand('insertHTML') and ('insertImage') fire an input event with an empty inputType and no beforeinput, so
// the editor cannot tell the page's calls from its own. The editor marks its own calls and undoes the rest.
let ownInsert = false
export const insertOwnHTML = (html) => {
	ownInsert = true
	try { document.execCommand('insertHTML', false, html) } finally { ownInsert = false }
}
export const isForeignInsert = (event) => event.inputType === '' && !ownInsert

export const uniqueId = (prefix) => {
     	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};


// Stored note HTML is parsed in an inert document and rebuilt node by node from an allowlist; the output is never a string.
// Properties are read through prototype getters: a node named "attributes" or "childNodes" can clobber the own property.
const getter = (type, name) => Object.getOwnPropertyDescriptor(type.prototype, name).get
const [bodyOf, childNodesOf, nodeTypeOf, dataOf, localNameOf, namespaceOf] = [
	getter(Document, 'body'), getter(Node, 'childNodes'), getter(Node, 'nodeType'), getter(CharacterData, 'data'),
	getter(Element, 'localName'), getter(Element, 'namespaceURI'),
]
const KEEP_TAGS = new Set(['b', 'i', 'u', 'strike', 's', 'p', 'span', 'font', 'div', 'br', 'a', 'img'])
const DROP_TAGS = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'form'])
const KEEP_STYLES = ['text-align', 'width', 'height', 'max-width', 'white-space', 'color', 'font-weight', 'font-style', 'text-decoration', 'font-size']
const KEEP_ATTRS = {
	a: { href: (v) => URL.canParse(v) && ['http:', 'https:'].includes(new URL(v).protocol) },
	img: { src: (v) => v.startsWith('data:image/'), id: (v) => /^img-/.test(v), draggable: () => true, 'data-natural-width': () => true, 'data-natural-height': () => true },
	font: { size: (v) => /^[1-7]$/.test(v) },
}

const copyStyle = (from, to, doc) => {
	const parsed = doc.createElement('span').style
	parsed.cssText = from
	for (const name of KEEP_STYLES) {
		const value = parsed.getPropertyValue(name)
		if (/^[\w.% -]+$/.test(value)) to.style.setProperty(name, value)
	}
}

const copyChildren = (from, into, doc) => {
	for (const node of Array.from(childNodesOf.call(from))) {
		const type = nodeTypeOf.call(node)
		if (type === Node.TEXT_NODE) { into.append(doc.createTextNode(dataOf.call(node))); continue }
		if (type !== Node.ELEMENT_NODE) continue
		const tag = localNameOf.call(node)
		if (namespaceOf.call(node) !== 'http://www.w3.org/1999/xhtml' || DROP_TAGS.has(tag)) continue
		if (!KEEP_TAGS.has(tag)) { copyChildren(node, into, doc); continue }
		const copy = doc.createElement(tag)
		for (const name of Element.prototype.getAttributeNames.call(node)) {
			const value = Element.prototype.getAttribute.call(node, name)
			if (name === 'style') copyStyle(value, copy, doc)
			else if (KEEP_ATTRS[tag]?.[name]?.(value)) copy.setAttribute(name, value)
		}
		copyChildren(node, copy, doc)
		into.append(copy)
	}
}

// On any failure the raw HTML shows as text: the editor must not go blank, and the error must not unmount the app.
export const sanitizeInto = (target, html) => {
	try {
		const doc = target.ownerDocument
		const fragment = doc.createDocumentFragment()
		copyChildren(bodyOf.call(new DOMParser().parseFromString(html, 'text/html')), fragment, doc)
		target.replaceChildren(fragment)
	} catch {
		target.textContent = html
	}
}


export const links = (text) => {
	const urlRegex = /https?:\/\/\S+/g
	// DOMParser documents are inert; text nodes outside an anchor get their URLs wrapped through the DOM API.
	const doc = new DOMParser().parseFromString(text, 'text/html')
	const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT)
	const textNodes = []

	while (walker.nextNode()) {
		if (!walker.currentNode.parentElement.closest('a') && urlRegex.test(walker.currentNode.data)) {
			textNodes.push(walker.currentNode)
		}
		urlRegex.lastIndex = 0
	}

	textNodes.forEach( node => {
		const fragment = doc.createDocumentFragment()
		let last = 0

		for (const match of node.data.matchAll(urlRegex)) {
			const anchor = doc.createElement('a')
			anchor.setAttribute('href', match[0])
			anchor.textContent = match[0]
			fragment.append(node.data.slice(last, match.index), anchor)
			last = match.index + match[0].length
		}

		fragment.append(node.data.slice(last))
		node.replaceWith(fragment)
	})

	return doc.body.innerHTML
};


export const textContent = (element) => {
	if (element instanceof HTMLElement) {
		const children = element.children

		element.style.color = 'inherit'

		if (children?.length > 0) {
			Array.from(children).forEach( child => textContent(child) )
		}
	}
}


export const imageAtCursor = (imgElement, root, ref, setText, dropTarget) => {
	if (dropTarget.id === TEXT_EDITOR_ID) {
		dropTarget.appendChild(imgElement)
	} else if (dropTarget && dropTarget.parentNode) {
        	// Insert after the drop target
        	if (dropTarget.nextSibling) {
            		dropTarget.parentNode.insertBefore(imgElement, dropTarget.nextSibling);
        	} else {
            		dropTarget.parentNode.appendChild(imgElement);
        	}
    	} else {
        	// Fallback to original behavior if no drop target
        	const selection = root.getSelection();
        	if (selection.rangeCount > 0) {
            		const range = selection.getRangeAt(0);
            		range.deleteContents();
            		range.insertNode(imgElement);
            		range.collapse(false);
        	} else {
            		ref.current.appendChild(imgElement);
        	}
    	}

    	setText(ref.current.innerHTML);
};
