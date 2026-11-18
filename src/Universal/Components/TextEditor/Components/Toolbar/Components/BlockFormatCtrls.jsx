import React from 'react';
import { List, ListOrdered, ListChecks, Heading1, Heading2, Quote } from 'lucide-react';
import { ShadowRootContext } from '../../../TextEditor.jsx';
import { applyBlock } from '../../TextInput/blocks.js';

const BUTTONS = [
	{ id: 'bullet-list-btn', kind: 'ul', label: 'Bulleted list', Icon: List },
	{ id: 'numbered-list-btn', kind: 'ol', label: 'Numbered list', Icon: ListOrdered },
	{ id: 'checklist-btn', kind: 'check', label: 'Checklist', Icon: ListChecks },
	{ id: 'heading-1-btn', kind: 'h1', label: 'Heading', Icon: Heading1 },
	{ id: 'heading-2-btn', kind: 'h2', label: 'Subheading', Icon: Heading2 },
	{ id: 'quote-btn', kind: 'quote', label: 'Quote', Icon: Quote },
]

export default function BlockFormatCtrls() {
	const [shadowRootElement] = React.useContext(ShadowRootContext);

	return (
	<div id="block-format-controls"
	      className="flex gap-[2px]">
	      {BUTTONS.map(({ id, kind, label, Icon }) => (
	      <button
	        key={id}
	        id={id}
	        aria-label={label}
	        title={label}
	        className="focus-ink flex items-center justify-center size-7 rounded-none font-serif text-[17px] leading-none text-ink transition duration-150 ease-out hover:bg-paper-deep active:bg-ink active:text-paper"
	        onClick={() => applyBlock(shadowRootElement || document, kind)}
	      >
	        <Icon className="size-4" aria-hidden="true"/>
	      </button>
	      ))}
	</div>
	)
}
