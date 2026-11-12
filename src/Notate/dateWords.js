// The date written out for the masthead: "Wednesday," / "the eleventh of" / "November".
const ORDINALS = ['', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth',
	'eleventh', 'twelfth', 'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth',
	'twentieth', 'twenty-first', 'twenty-second', 'twenty-third', 'twenty-fourth', 'twenty-fifth', 'twenty-sixth',
	'twenty-seventh', 'twenty-eighth', 'twenty-ninth', 'thirtieth', 'thirty-first']

export const ordinalWord = (day) => ORDINALS[day]

export function mastheadParts(date = new Date()) {
	return {
		weekday: date.toLocaleDateString('en-US', { weekday: 'long' }),
		day: `the ${ordinalWord(date.getDate())} of`,
		month: date.toLocaleDateString('en-US', { month: 'long' }),
		year: String(date.getFullYear()),
	}
}
