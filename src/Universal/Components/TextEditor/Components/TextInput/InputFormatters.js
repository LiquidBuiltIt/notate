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
