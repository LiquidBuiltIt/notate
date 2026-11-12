import React from 'react';

export default function FontStylingCtrls() {
  const handleFormatClick = (formatName) => {
    document.execCommand(formatName, false, null);
  };

	return (
	<div id="font-styling-controls"
	      className="flex gap-[2px]">
	      <button
	        id="bold-btn"
	        aria-label="Bold"
	        title="Bold"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={() => handleFormatClick('bold')}
	      >
	        <span aria-hidden="true" className="font-bold">B</span></button>
	      <button
	        id="italic-btn"
	        aria-label="Italic"
	        title="Italic"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={() => handleFormatClick('italic')}
	      >
	       <span aria-hidden="true" className="italic">I</span></button>
	      <button
	        id="underline-btn"
	        aria-label="Underline"
	        title="Underline"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={() => handleFormatClick('underline')}
	      >
	       <span aria-hidden="true" className="underline underline-offset-2">U</span></button>
	      <button
	        id="strikethrough-btn"
	        aria-label="Strikethrough"
	        title="Strikethrough"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={() => handleFormatClick('strikeThrough')}
	      >
	        <span aria-hidden="true" className="line-through">S</span></button>
	</div>
	)
}
