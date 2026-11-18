// A note's origin is "hostname/pathname". A note belongs to a site when the host matches exactly, never as a substring.
export const originHost = (origin) => String(origin ?? '').split('/')[0]
export const isSiteNote = (note, hostname) => originHost(note?.origin) === hostname
