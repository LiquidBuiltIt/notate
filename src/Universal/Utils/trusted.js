// Web pages can make events (isTrusted is false) and can see events that leave our shadow root. One pattern for both.

const ACTING = ['click', 'dblclick', 'auxclick', 'contextmenu', 'mousedown', 'mouseup', 'pointerdown', 'pointermove', 'pointerup',
	'keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'change', 'paste', 'cut', 'copy', 'dragstart', 'dragover', 'drop']
const PRIVATE = ['keydown', 'keyup', 'keypress', 'beforeinput', 'input', 'paste', 'cut', 'copy']

// Run once on the shadow root. Events a page script made never reach our handlers, and what the user types never reaches the page.
export const guardShadowRoot = (shadow) => {
	ACTING.forEach((type) => shadow.addEventListener(type, (event) => { if (!event.isTrusted) event.stopPropagation() }, true))
	PRIVATE.forEach((type) => shadow.addEventListener(type, (event) => event.stopPropagation()))
}

// For handlers on `document`: a real event that started inside our own UI (`shadow.host` is in its path, whatever id the page gives its elements).
export const fromOurUI = (event, shadow) => event.isTrusted && event.composedPath().includes(shadow.host)
