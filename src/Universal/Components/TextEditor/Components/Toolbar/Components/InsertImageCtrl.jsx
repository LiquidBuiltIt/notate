import React from 'react';
import { Image } from 'lucide-react';
import { pickImage } from '../../TextInput/images.js';

export default function InsertImageCtrl() {
	return (
	<div id="insert-image-controls"
	      className="flex gap-[2px]">
	      <button
	        id="insert-image-btn"
	        aria-label="Insert image"
	        title="Insert image"
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={pickImage}
	      >
	        <Image className="size-4" aria-hidden="true"/>
	      </button>
	</div>
	)
}
