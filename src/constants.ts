export const VOLUME_MIN_DB = -100
export const VOLUME_MAX_DB = 26
export const BALANCE_MIN = 0.0
export const BALANCE_MAX = 1.0
export const SYNC_OFFSET_MIN = -950
export const SYNC_OFFSET_MAX = 20000
export const DEFAULT_TIMECODE = '00:00:00'

// Interval between volume steps when fading a source.
export const FADE_STEP_MS = 50
// Protocol maximum for the Sleep request's sleepMillis field.
export const SLEEP_MAX_MS = 50000

export const POLL_INTERVALS = {
	RECONNECTION: 5000,
	STATS: 1000,
	MEDIA: 1000,
}
