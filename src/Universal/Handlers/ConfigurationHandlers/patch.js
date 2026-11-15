import _ from 'lodash';

// A patch is a nested object holding only what a writer changed.
// Plain objects merge, { $add: [...], $remove: [...] } adds to / removes from the stored array, anything else replaces.
const isArrayOp = (value) => _.isPlainObject(value) && ('$add' in value || '$remove' in value)

export function applyPatch(record, patch) {
	for (const [key, value] of Object.entries(patch)) {
		if (key === '__proto__') continue

		if (isArrayOp(value)) {
			const kept = (Array.isArray(record[key]) ? record[key] : []).filter(item => !(value.$remove ?? []).includes(item))
			record[key] = [...kept, ...(value.$add ?? []).filter(item => !kept.includes(item))]
		} else if (_.isPlainObject(value)) {
			if (!_.isPlainObject(record[key])) record[key] = {}
			applyPatch(record[key], value)
		} else {
			record[key] = value
		}
	}

	return record
}

// The patch that turns `before` into `after`. Keys missing from `after` are not removed.
export function diffPatch(before, after) {
	const patch = {}

	for (const [key, value] of Object.entries(after)) {
		const old = before?.[key]
		if (_.isEqual(old, value)) continue

		if (Array.isArray(old) && Array.isArray(value)) patch[key] = { $add: _.difference(value, old), $remove: _.difference(old, value) }
		else if (_.isPlainObject(old) && _.isPlainObject(value)) patch[key] = diffPatch(old, value)
		else patch[key] = value
	}

	return patch
}
