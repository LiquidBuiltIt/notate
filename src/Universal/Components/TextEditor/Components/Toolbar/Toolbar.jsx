import React from 'react';
import FontStylingCtrls from './Components/FontStylingCtrls.jsx';
import BlockFormatCtrls from './Components/BlockFormatCtrls.jsx';
import InsertImageCtrl from './Components/InsertImageCtrl.jsx';
import FontSizeCtrls from './Components/FontSizeCtrls.jsx';
import UndoRedoCtrls from './Components/UndoRedoCtrls.jsx';
import AlignmentCtrls from './Components/AlignmentCtrls.jsx';


export default function Toolbar({ControllerComponents}) {


  return (
    <div id="toolbar" className="flex flex-wrap items-center px-2 py-[6px] gap-x-3 gap-y-1 border-b border-ink font-serif text-ink"
	 // Keep the editor's selection when a toolbar button is pressed (the font size select still opens).
	 onMouseDown={(e) => { if (e.target instanceof Element && e.target.closest('button')) e.preventDefault() }}>
	  <div id="default-toolbar-items"
	  	className="flex flex-1 basis-0 min-w-0 flex-wrap gap-x-2 gap-y-1 items-center">
		  <FontStylingCtrls/>
		  <FontSizeCtrls/>
		  <BlockFormatCtrls/>
		  <InsertImageCtrl/>
		  <AlignmentCtrls/>
		  <UndoRedoCtrls/>
	  </div>
	  <div id="custom-toolbar-items"
	  	className="flex items-center gap-3">
		  {ControllerComponents}
	  </div>
    </div>
  );
}
