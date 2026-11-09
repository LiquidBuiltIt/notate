import React from 'react';
import * as Format from './InputFormatters.js'
import { TextInputContext, ShadowRootContext } from '../../TextEditor.jsx';
import GhostEditor from './firefox.jsx';


export const TEXT_EDITOR_ID = 'input-text-display'




export default function TextInput() {
	const [text, setText] = React.useContext(TextInputContext);
	const [shadowRootElement] = React.useContext(ShadowRootContext);

	const [ root, setRoot ] = React.useState(null)


	const textDisplayRef = React.useRef(null);


	const handleChange = (event) => {
		const target = event.target

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
            			const existingImg = root.getElementById(img.id);
            			if (existingImg) {
                			Format.imageAtCursor(existingImg, root, textDisplayRef, setText, target);
            			}
        		}
    		} else {
        		const files = event.dataTransfer.files;
        		if (files && files.length > 0) {
            			const file = files[0];
            			if (typeof file.type === 'string') {
                			const reader = new FileReader();
                			reader.onload = (e) => {
                    				const img = new Image();
                    				img.onload = () => {
                        				const naturalWidth = img.naturalWidth;
                        				const naturalHeight = img.naturalHeight;
                        				const imgElement = document.createElement('img');

                        				imgElement.src = e.target.result;
                        				imgElement.id = Format.uniqueId('img');
                        				imgElement.style.width = `${naturalWidth}px`;
                        				imgElement.style.height = `${naturalHeight}px`;
                        				imgElement.setAttribute('draggable', 'true');
                        				imgElement.setAttribute('data-natural-width', naturalWidth);
                        				imgElement.setAttribute('data-natural-height', naturalHeight);

                        				Format.imageAtCursor(
								imgElement, root, textDisplayRef, setText, target
							);
                    				};

                    				img.src = e.target.result;
                			}

                			reader.readAsDataURL(file);
            			}
        		}
    		}
	};


  	const handleKeyDown = (event) => {
      		if (event.key === 'Tab') {
      			event.preventDefault();
      			document.execCommand('insertText', true, '\t');
    		} else if (event.ctrlKey && event.key === 'z') {
      			event.preventDefault();
      			document.execCommand('undo', false, null);
    		} else if (event.ctrlKey && event.key === 'y') {
      			event.preventDefault();
 			document.execCommand('redo', false, null);
		} else {
			event.stopPropagation()
    		}

    		try { setText(Format.readClean(event.target)) } catch {}
	};

	const handlePaste = (event) => {
		event.preventDefault()
		const pastedPlainText = event.clipboardData.getData('text/plain')

		document.execCommand('insertText', false, pastedPlainText)
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


	return (
		<>
			<div
        		 id={TEXT_EDITOR_ID}
        		 ref={textDisplayRef}
        		 className={`
			 	 ${ root === shadowRootElement ? "text-black" : "text-white" }
				 w-full h-full max-h-[100vh] p-2  
				 rounded bg-inherit outline-none text-base
			 `}
        		 contentEditable
			 suppressContentEditableWarning
        		 onInput={handleChange}
			 onPaste={handlePaste}
			 onKeyDown={handleKeyDown}
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
