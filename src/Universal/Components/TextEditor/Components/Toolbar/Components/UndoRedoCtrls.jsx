import React from 'react';
import UndoIcon from '../../../Assets/Toolbar/undo-icon.svg';
import RedoIcon from '../../../Assets/Toolbar/redo-icon.svg';

export default function UndoRedoCtrls() {
  const handleUndoClick = () => {
    document.execCommand('undo', false, null);
  };

  const handleRedoClick = () => {
    document.execCommand('redo', false, null);
  };	

	return (
	<div id="undo-redo-controls"
	     className="flex gap-[2px] pl-3 border-l border-paper-edge">
	      <button
	        id="undo-btn"
	        aria-label="Undo"
	        title="Undo"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={handleUndoClick}
	      >
	       <UndoIcon className="size-4 stroke-current" aria-hidden="true"/> 
	      </button>
	      <button
	        id="redo-btn"
	        aria-label="Redo"
	        title="Redo"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={handleRedoClick}
	      >
	        <RedoIcon className="size-4 stroke-current" aria-hidden="true"/>
	      </button>	
	</div>
	)
}
