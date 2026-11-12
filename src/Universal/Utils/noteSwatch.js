// Stored notes keep v1 color classes (note.color.styles.card = "bg-yellow-200").
// The stored format never changes; this maps it to the Marginalia swatch for display.

// Full class strings, written out so Tailwind's scanner generates them.
const SWATCHES = {
	red:    { name: 'red',    bg: 'bg-swatch-red',    text: 'text-swatch-red',    border: 'border-swatch-red',    hex: '#C2412D' },
	yellow: { name: 'yellow', bg: 'bg-swatch-yellow', text: 'text-swatch-yellow', border: 'border-swatch-yellow', hex: '#D9A62E' },
	blue:   { name: 'blue',   bg: 'bg-swatch-blue',   text: 'text-swatch-blue',   border: 'border-swatch-blue',   hex: '#3A5BA0' },
	green:  { name: 'green',  bg: 'bg-swatch-green',  text: 'text-swatch-green',  border: 'border-swatch-green',  hex: '#4E7D5B' },
	orange: { name: 'orange', bg: 'bg-swatch-orange', text: 'text-swatch-orange', border: 'border-swatch-orange', hex: '#D9782D' },
	pink:   { name: 'pink',   bg: 'bg-swatch-pink',   text: 'text-swatch-pink',   border: 'border-swatch-pink',   hex: '#C9607E' },
	purple: { name: 'purple', bg: 'bg-swatch-purple', text: 'text-swatch-purple', border: 'border-swatch-purple', hex: '#6E4E8E' },
}

export const SWATCH_NAMES = Object.keys(SWATCHES)

export default function noteSwatch(color) {
	const name = typeof color === 'string'
		? color
		: /bg-([a-z]+)-\d+/.exec(color?.styles?.card ?? color?.card ?? '')?.[1]
	return SWATCHES[name] ?? SWATCHES.yellow
}
