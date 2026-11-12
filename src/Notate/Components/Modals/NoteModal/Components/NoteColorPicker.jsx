import React from 'react';
import { NoteColors } from './NoteColorProvider.js'
import noteSwatch from '@universal/Utils/noteSwatch.js'
import { NotateContext } from '@notate/Notate.jsx'
import NoteModal, { NoteModalContext } from '../NoteModal.jsx';



export default function NoteColorPicker() {
	const { NOTE_CONTEXT, REQUEST_CONTEXT } = React.useContext(NotateContext)
	
	const [ note, setNote ] = NOTE_CONTEXT

	const { COLOR_CONTEXT } = React.useContext(NoteModalContext)

	const [ colorIndex, setColorIndex ] = COLOR_CONTEXT 
	const [ selectedColor, setSelectedColor ] = React.useState(note?.color?.styles || NoteColors[colorIndex])


	const colors = Object.keys(NoteColors)


	const handleColorPickerClick = () => {
		const currentIndex = colors.indexOf(colorIndex)
		const nextIndex = (currentIndex + 1) % colors.length
		const result = colors[nextIndex]

		setColorIndex(result)
		setSelectedColor(NoteColors[result])
	}


	React.useEffect(()=>{
		note.color = {
			name: colorIndex,
			styles: selectedColor
		}
	},[selectedColor])





	const swatch = noteSwatch(colorIndex)

	return (
		<button id="note-color-picker"
		type="button"
		title="Change note colour"
		aria-label={`Note colour: ${swatch.name}. Click for the next colour.`}
		className="smallcaps focus-ink trans-ease shrink-0 flex items-center gap-3 pb-2 text-ink-soft cursor-pointer hover:text-ink"
		onClick={handleColorPickerClick}>
			<span id="color"
			className={ `block size-[14px] ${swatch.bg}` }></span>
			{swatch.name}
		</button>
	)
}
