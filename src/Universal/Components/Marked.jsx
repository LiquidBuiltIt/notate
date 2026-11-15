import React from 'react';

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Text with the search words marked in the vermilion wash. No tokens, no marks.
export default function Marked({ text = '', tokens = [] }) {
	if (!tokens.length || !text) return text

	const pattern = new RegExp(`(${tokens.map(escapeRegExp).join('|')})`, 'gi')

	return text.split(pattern).map((part, i) => i % 2
		? <mark key={i} className="bg-vermilion-wash text-inherit px-px shadow-[inset_0_-2px_0_#E0451F]">{part}</mark>
		: part
	)
}
