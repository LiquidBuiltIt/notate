import { TEXT_EDITOR_ID } from './TextInput.jsx'

export const uniqueId = (prefix) => {
     	return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};


// One allowlist guards stored note HTML (sanitizeInto) and the live editor (sanitizeTree, run by a MutationObserver).
// Stored note HTML is parsed in an inert document and cleaned in place; the output is never a string.
// Properties are read through prototype getters and methods: a node named "attributes" or "remove" can clobber the own property.
const getter = (type, name) => Object.getOwnPropertyDescriptor(type.prototype, name).get
const [bodyOf, childNodesOf, nodeTypeOf, dataOf, localNameOf, namespaceOf, ownerDocumentOf] = [
	getter(Document, 'body'), getter(Node, 'childNodes'), getter(Node, 'nodeType'), getter(CharacterData, 'data'),
	getter(Element, 'localName'), getter(Element, 'namespaceURI'), getter(Node, 'ownerDocument'),
]
const KEEP_TAGS = new Set(['b', 'i', 'u', 'strike', 's', 'p', 'span', 'font', 'div', 'br', 'a', 'img'])
const DROP_TAGS = new Set(['script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math', 'form'])
const KEEP_STYLES = ['text-align', 'width', 'height', 'max-width', 'white-space', 'color', 'font-weight', 'font-style', 'text-decoration', 'font-size']
const KEEP_ATTRS = {
	a: { href: (v) => URL.canParse(v) && ['http:', 'https:'].includes(new URL(v).protocol) },
	img: { src: (v) => v.startsWith('data:image/'), id: (v) => /^img-/.test(v), draggable: () => true, 'data-natural-width': () => true, 'data-natural-height': () => true },
	font: { size: (v) => /^[1-7]$/.test(v) },
}

const cleanStyle = (value, doc) => {
	const parsed = doc.createElement('span').style
	const kept = doc.createElement('span').style
	parsed.cssText = value
	for (const name of KEEP_STYLES) {
		const v = parsed.getPropertyValue(name)
		if (/^[\w.% -]+$/.test(v)) kept.setProperty(name, v)
	}
	return kept.cssText
}

// Removes what is off the list from `parent`, in place, and returns true if it changed anything.
// A bad node is removed, or unwrapped with its text kept; a bad attribute is removed. Valid content is not touched.
// Children are cleaned before an unwrap, so no dropped node is ever moved (moving an iframe reloads it).
export const sanitizeTree = (parent) => {
	let changed = false
	const doc = ownerDocumentOf.call(parent)
	const remove = (parent, node) => { Node.prototype.removeChild.call(parent, node); changed = true }
	const clean = (parent) => {
		for (const node of Array.from(childNodesOf.call(parent))) {
			const type = nodeTypeOf.call(node)
			if (type === Node.TEXT_NODE) continue
			if (type !== Node.ELEMENT_NODE) { remove(parent, node); continue }
			const tag = localNameOf.call(node)
			if (namespaceOf.call(node) !== 'http://www.w3.org/1999/xhtml' || DROP_TAGS.has(tag)) { remove(parent, node); continue }
			if (!KEEP_TAGS.has(tag)) {
				clean(node)
				Element.prototype.replaceWith.call(node, ...Array.from(childNodesOf.call(node)))
				changed = true
				continue
			}
			for (const name of Element.prototype.getAttributeNames.call(node)) {
				const value = Element.prototype.getAttribute.call(node, name)
				if (name === 'style') {
					const css = cleanStyle(value, doc)
					if (css === value) continue
					if (css) Element.prototype.setAttribute.call(node, name, css)
					else Element.prototype.removeAttribute.call(node, name)
				} else if (KEEP_ATTRS[tag]?.[name]?.(value)) continue
				else Element.prototype.removeAttribute.call(node, name)
				changed = true
			}
			clean(node)
		}
	}
	clean(parent)
	return changed
}

// On any failure the raw HTML shows as text: the editor must not go blank, and the error must not unmount the app.
export const sanitizeInto = (target, html) => {
	try {
		const body = bodyOf.call(new DOMParser().parseFromString(html, 'text/html'))
		sanitizeTree(body)
		target.replaceChildren(...Array.from(childNodesOf.call(body)))
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
