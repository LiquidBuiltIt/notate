import React from 'react';
import * as Format from './InputFormatters.js'
import { TextInputContext, ShadowRootContext } from '../../TextEditor.jsx';
import GhostEditor from './firefox.jsx';
import { insertImageFile } from './images.js';
import { EditorLinksContext, linkStyles } from '../../linksContext.js'
import { inlineShortcut, enterShortcut, codeKey, tabKey, footnoteShortcut, pasteMarkdown } from './markdownTyping.js';
import { blockShortcut, toggleCaretItem, toggleChecked, checkboxItems, uncheckNewItems } from './blocks.js';


export const TEXT_EDITOR_ID = 'input-text-display'




export default function TextInput() {
	const [text, setText] = React.useContext(TextInputContext);
	const [shadowRootElement] = React.useContext(ShadowRootContext);

	const [ root, setRoot ] = React.useState(null)


	const textDisplayRef = React.useRef(null);
	const itemsBeforeEnter = React.useRef(null)
	const plainPaste = React.useRef(false)
	const links = React.useContext(EditorLinksContext)


	const handleChange = (event) => {
		const target = event.target

		// Chrome copies data-checked when Enter splits an item: the new item starts unchecked, the old one keeps its state.
		if (event.nativeEvent.inputType === 'insertParagraph' && itemsBeforeEnter.current) {
			uncheckNewItems(target, itemsBeforeEnter.current)
		}
		itemsBeforeEnter.current = null

		// A closing marker typed as text (**, *, `, ], ...) turns the span into its element. Only typed text, never undo, paste or our own insert.
		if (event.nativeEvent.inputType === 'insertText' && !event.nativeEvent.isComposing && root) {
			try { inlineShortcut(root) } catch {}
		}

		// If the walker throws, the observer fails closed and sets the text; nothing unchecked is read here.
		try { Format.sanitizeTree(target) } catch { return }
		Format.textContent(target)

		const content = target.innerHTML;
		const findLinks = Format.links(content)
		setText(findLinks);
	};




	const handleDragStart = (event) => {
		if (event.target.tagName === 'IMG') {
        	  	event.dataTransfer.setData('text/plain', event.target.id);
        	}
	}

	
	const handleDragOver = (event) => {
        	event.preventDefault();
        	event.stopPropagation();
    	};
	
	const handleDrop = (event) => {
    		event.preventDefault();
    		event.stopPropagation();

    		const htmlData = event.dataTransfer.getData('text/html');
    		const plainTextData = event.dataTransfer.getData('text/plain');
		const target = event.target


    		if (htmlData && plainTextData.startsWith('img-')) {

        		// Handle existing image reposition
        		const parser = new DOMParser();
        		const doc = parser.parseFromString(htmlData, 'text/html');
        		const img = doc.querySelector('img');
        
        		if (img) {
            			// The id comes from page-supplied drag data: only a picture that is already in the editor can be moved.
            			const existingImg = /^img-/.test(img.id) && Array.from(textDisplayRef.current.querySelectorAll('img')).find((i) => i.id === img.id);
            			if (existingImg) {
                			Format.imageAtCursor(existingImg, textDisplayRef, setText, target);
            			}
        		}
    		} else {
        		const files = event.dataTransfer.files;
        		if (files && files.length > 0) {
            			insertImageFile(files[0], root, (img) => Format.imageAtCursor(img, textDisplayRef, setText, target));
        		}
    		}
	};


  	const handleKeyDown = (event) => {
		if (event.key === 'Enter') itemsBeforeEnter.current = checkboxItems(textDisplayRef.current)

		if (event.key === ' ' && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing && root) {
			try { if (blockShortcut(root) || footnoteShortcut(root)) event.preventDefault() } catch {}
		}

		if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v') plainPaste.current = true

		// Markdown lines, code blocks, lists and tables. A handled key is not passed on.
		let handled = false
		if (root && !event.ctrlKey && !event.metaKey && !event.altKey && !event.nativeEvent.isComposing) {
			try {
				handled = ['Enter', 'Tab', 'ArrowDown'].includes(event.key) && codeKey(root, event)
				|| event.key === 'Enter' && !event.shiftKey && enterShortcut(root)
				|| event.key === 'Tab' && tabKey(root, event)
			} catch {}
			if (handled) event.preventDefault()
		}

      		if (handled) {
      		} else if (event.key === 'Tab') {
      			event.preventDefault();
      			document.execCommand('insertText', true, '\t');
    		} else if (event.ctrlKey && event.key === 'z') {
      			event.preventDefault();
      			document.execCommand('undo', false, null);
    		} else if (event.ctrlKey && event.key === 'Enter') {
			if (root && toggleCaretItem(root)) event.preventDefault()
    		} else if (event.ctrlKey && event.key === 'y') {
      			event.preventDefault();
 			document.execCommand('redo', false, null);
		} else {
			event.stopPropagation()
    		}

    		try { setText(Format.readClean(event.target)) } catch {}
	};

	const handleKeyUp = () => { plainPaste.current = false }

	// A click in the box left of a checkbox item flips it.
	const handleClick = (event) => {
		const li = event.target instanceof Element && event.target.closest('li[data-checked]')
		if (li && event.clientX < li.getBoundingClientRect().left) toggleChecked(li)

		// A real click on a note link or a tag. A script's click does nothing.
		if (links && event.isTrusted && event.target instanceof Element) {
			const link = event.target.closest('[data-note-link]')
			const tag = link ? null : event.target.closest('[data-tag]')
			if (link) links.openNote?.(link.getAttribute('data-note-link'))
			else if (tag) links.openTag?.(tag.getAttribute('data-tag'))
		}
	}

	const handlePaste = (event) => {
		event.preventDefault()
		const pastedPlainText = event.clipboardData.getData('text/plain')
		const image = Array.from(event.clipboardData.files).find((file) => file.type.startsWith('image/'))

		// A copied picture has no text with it. Text stays plain text, so a copied page does not bring its markup.
		const plain = plainPaste.current // set from Ctrl+Shift+V until the key comes up
		if (image && !pastedPlainText && root) insertImageFile(image, root)
		else {
			// Text that looks like Markdown becomes formatting; Ctrl+Shift+V pastes it as typed.
			let done = false
			if (!plain && pastedPlainText) { try { done = pasteMarkdown(pastedPlainText) } catch {} }
			if (!done) document.execCommand('insertText', false, pastedPlainText)
		}
	}


	const initializeTextInput = React.useCallback( ()=> {
		if (!root) return	

		const INPUT = root.getElementById(TEXT_EDITOR_ID)

		if (INPUT instanceof Node) {
			Format.sanitizeInto(INPUT, text || '')
			Format.textContent(INPUT)
		}
	}, [root])



	// Every DOM change in the editor is checked against the allowlist, whoever made it.
	React.useEffect(()=>{
		const editor = textDisplayRef.current
		const observer = new MutationObserver((records) => {
			try {
				Format.sanitizeTree(editor)
			} catch {
				// Fail closed: drop what these changes added or set, keep the rest of the note, stay subscribed.
				for (const record of records) {
					try {
						for (const node of record.addedNodes) Format.detach(node)
						if (record.attributeName) Element.prototype.removeAttribute.call(record.target, record.attributeName)
					} catch {}
				}
			}
			// The stored value follows the DOM after every change, even when the change left the DOM clean.
			try { setText(Format.links(editor.innerHTML)) } catch {}
		})
		observer.observe(editor, { childList: true, subtree: true, attributes: true, characterData: true })
		return () => observer.disconnect()
	},[])


	React.useEffect(()=>{
		setRoot( shadowRootElement || document )
	},[shadowRootElement])


	React.useEffect(()=>{
		initializeTextInput()
	},[ initializeTextInput, root ])


	const css = linkStyles(links)

	return (
		<>
			{ css && <style>{css}</style> }
			<div
        		 id={TEXT_EDITOR_ID}
        		 ref={textDisplayRef}
        		 className={`
			 	 font-serif text-[17px] leading-[1.6] text-ink caret-vermilion selection:bg-vermilion-wash
				 w-full h-full max-h-[100vh] px-5 py-4  
				 rounded-none bg-transparent outline-none
			 `}
        		 contentEditable
			 suppressContentEditableWarning
        		 onInput={handleChange}
			 onPaste={handlePaste}
			 onKeyDown={handleKeyDown}
			 onKeyUp={handleKeyUp}
			 onClick={handleClick}
			 onDragOver={handleDragOver}
			 onDragStart={handleDragStart}
			 onDrop={handleDrop}
		  	/>
		</>
	);
}


//			const selection = document.getSelection()
//
//			if ( selection ) {
//				const node = selection.anchorNode
//				//const prevSibling = selection.anchorNode.previousSibling
//
//				if (node instanceof Text &&
//				 !(node instanceof Element)) {
//					console.log('Text Node focused.')
//
//					if (node.textContent.length > 0) {
//						const text = node.textContent
//						const offset = selection.focusOffset - 1
//
//						const alteredText = Array.from(text).filter( (char,id) => !(id === offset) ) 
//
//						node.textContent = alteredText.join('')
//
//						const restoredRange = document.createRange()
//						restoredRange.setStart(node, offset)
//						restoredRange.setEnd(node, offset)
//
//						selection.removeAllRanges()
//						selection.addRange(restoredRange)
//					} else {
//						//TODO: ignore for now we will work on it once finished w element handling
//						debugger
//						//event.target.remove(node)
//					}
//
//				} else if (node instanceof Element && 
//				 !(node instanceof Text)) {
//					console.log('Element Node focused.')
//					const prevNode = node.previousSibling
//					const offset = prevNode.textContent.length - 1
//					console.log('offset: ', offset)
//
//					event.target.removeChild(node)
//
//					const restoredRange = document.createRange()
//					restoredRange.setStart(prevNode, offset)
//					restoredRange.setEnd(prevNode, offset)
//
//					selection.removeAllRanges()
//					selection.addRange(restoredRange)
//				}
//			}
