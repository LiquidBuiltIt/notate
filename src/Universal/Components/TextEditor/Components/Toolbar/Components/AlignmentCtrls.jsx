import React from 'react';

export default function AlignmentCtrls() {
  const handleAlignmentClick = (alignment) => {
    document.execCommand('justifyLeft', false, null);
    document.execCommand(`justify${alignment.charAt(0).toUpperCase() + alignment.slice(1)}`, false, null);

  };

  return (
    <div id="alignment-controls" className="flex gap-[2px] pl-3 border-l border-paper-edge">
      <button
        aria-label="Align left"
        title="Align left"
        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
        onClick={() => handleAlignmentClick('left')}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><line x1="2" x2="14" y1="3" y2="3"/><line x1="2" x2="10" y1="6" y2="6"/><line x1="2" x2="14" y1="9" y2="9"/><line x1="2" x2="8" y1="12" y2="12"/></svg>
      </button>
      <button
        aria-label="Align center"
        title="Align center"
        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
        onClick={() => handleAlignmentClick('center')}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><line x1="2" x2="14" y1="3" y2="3"/><line x1="4" x2="12" y1="6" y2="6"/><line x1="2" x2="14" y1="9" y2="9"/><line x1="5" x2="11" y1="12" y2="12"/></svg>
      </button>
      <button
        aria-label="Align right"
        title="Align right"
        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
        onClick={() => handleAlignmentClick('right')}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><line x1="2" x2="14" y1="3" y2="3"/><line x1="6" x2="14" y1="6" y2="6"/><line x1="2" x2="14" y1="9" y2="9"/><line x1="8" x2="14" y1="12" y2="12"/></svg>
      </button>
      <button
        aria-label="Align justify"
        title="Align justify"
        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
        onClick={() => handleAlignmentClick('justify')}
      >
        <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true"><line x1="2" x2="14" y1="3" y2="3"/><line x1="2" x2="14" y1="6" y2="6"/><line x1="2" x2="14" y1="9" y2="9"/><line x1="2" x2="14" y1="12" y2="12"/></svg>
      </button>
    </div>
  );
}
