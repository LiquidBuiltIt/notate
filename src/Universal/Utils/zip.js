// A store-only (method 0) ZIP writer: CRC32, UTF-8 names (flag bit 11), no compression, no ZIP64.
const TABLE = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
export const crc32 = (bytes) => { let c = -1; for (const b of bytes) c = TABLE[(c ^ b) & 255] ^ (c >>> 8); return ~c >>> 0 }

// files: [{ name, data }] with data a string or Uint8Array. Returns a Blob.
export function zip(files, date = new Date()) {
	const enc = new TextEncoder()
	const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1)
	const day = ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
	const parts = [], central = []
	let offset = 0
	const header = (size, fields) => { const v = new DataView(new ArrayBuffer(size)); fields.forEach(([at, bytes, val]) => bytes === 4 ? v.setUint32(at, val, true) : v.setUint16(at, val, true)); return new Uint8Array(v.buffer) }
	if (files.length > 0xFFFF) throw new Error('too many files for a zip')
	for (const f of files) {
		const name = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data
		const crc = crc32(data)
		const common = [[6, 2, 0x0800], [8, 2, 0], [10, 2, time], [12, 2, day], [14, 4, crc], [18, 4, data.length], [22, 4, data.length], [26, 2, name.length]]
		parts.push(header(30, [[0, 4, 0x04034b50], [4, 2, 20], ...common]), name, data)
		central.push(header(46, [[0, 4, 0x02014b50], [4, 2, 20], [6, 2, 20], ...common.map(([at, n, v]) => [at + 2, n, v]), [42, 4, offset]]), name)
		offset += 30 + name.length + data.length
		if (offset > 0xFFFFFFFF) throw new Error('files too large for a zip')
	}
	const size = central.reduce((n, p) => n + p.length, 0)
	return new Blob([...parts, ...central, header(22, [[0, 4, 0x06054b50], [8, 2, files.length], [10, 2, files.length], [12, 4, size], [16, 4, offset]])], { type: 'application/octet-stream' })
}
