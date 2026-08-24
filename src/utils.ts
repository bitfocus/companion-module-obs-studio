import { combineRgb, createModuleLogger, type JsonObject } from '@companion-module/base'
import { OBSRecordingState, OBSStreamingState, OBSMediaStatus, ObsAudioMonitorType } from './types.js'
import { VOLUME_MIN_DB } from './constants.js'

const logger = createModuleLogger('Utils')

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max)
}

/** OBS's mixer maps its 0-100% fader onto decibels logarithmically, with 100% at 0 dB. */
export function dbToPercent(db: number): number {
	return Math.pow(10, db / 20) * 100
}

export function percentToDb(percent: number): number {
	return percent <= 0 ? VOLUME_MIN_DB : 20 * Math.log10(percent / 100)
}

/**
 * Renders a caught value for logging.
 *
 * `catch` bindings are `unknown`, and obs-websocket-js rejects with a mix of `Error`s and plain
 * objects carrying only `message`. Narrowing here keeps every call site free of `catch (e: any)`.
 */
export function describeError(error: unknown): string {
	if (error instanceof Error) return error.message
	if (typeof error === 'object' && error !== null && 'message' in error) {
		return String(error.message)
	}
	return String(error)
}

/**
 * Colors chosen to sit alongside the OBS UI: the neutral blue-grays of its panels, and its Qt
 * selection blue for anything OBS itself highlights (selected scene, active Studio Mode).
 */
export const Color = {
	Black: combineRgb(30, 33, 39), // OBS panel background
	White: combineRgb(225, 227, 230), // OBS body text
	Gray: combineRgb(72, 78, 88), // OBS disabled control
	Blue: combineRgb(42, 130, 218), // OBS selection accent
	Red: combineRgb(200, 0, 0),
	Orange: combineRgb(255, 102, 0),
	Yellow: combineRgb(212, 174, 0),
	Green: combineRgb(49, 163, 49), // OBS audio meter green
	Crimson: combineRgb(200, 0, 90),
}

/**
 * Resolves a `'true' | 'false' | 'toggle'` option against the current state. Toggling a state that
 * could not be read yields `false`, matching what OBS does with an unknown scene item.
 */
export function resolveVisibility(visible: string, current: boolean | undefined): boolean {
	if (visible !== 'toggle') return visible === 'true'
	return current === undefined ? false : !current
}

export function validName(name: string): string {
	// Generate a valid name for use as a variable ID
	try {
		return name.replace(/[^a-z0-9-_.]+/gi, '_')
	} catch (error) {
		logger.debug(`Unable to generate validName for ${name}: ${error} `)
		return name
	}
}

/** Narrow an untyped OBS settings value to a string, or `undefined` if it isn't one. */
export function asString(value: unknown): string | undefined {
	return typeof value === 'string' ? value : undefined
}

/** Narrow an untyped OBS settings value to a finite number, or `undefined` if it isn't one. */
export function asNumber(value: unknown): number | undefined {
	return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

/**
 * Strip a file path down to its bare name, dropping directories and any extension.
 *
 * OBS reports paths in the host OS's separator style, so both `/` and `\` are handled.
 */
export function extractFileName(path: unknown): string {
	const pathString = asString(path)
	if (!pathString) return ''
	return pathString.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
}

/**
 * Read the display text of a text source.
 *
 * Text sources either carry their text inline or point at a file, and the key naming differs
 * between the GDI+ and FreeType renderers — hence the pairs of fallbacks.
 */
export function readTextSourceValue(settings: JsonObject | undefined): string {
	if (!settings) return ''
	if (settings.from_file || settings.read_from_file) {
		const filePath = asString(settings.text_file) ?? asString(settings.file) ?? ''
		return `Text from file: ${filePath}`
	}
	return asString(settings.text) ?? ''
}

/**
 * Read the current media file name of an ffmpeg or VLC source.
 *
 * VLC sources expose a playlist; ffmpeg sources expose a single `local_file`. The first playlist
 * entry is used until cue position determination is supported.
 */
export function readMediaFileName(settings: JsonObject | undefined): string {
	if (!settings) return ''
	const playlist = settings.playlist
	if (Array.isArray(playlist)) {
		const firstEntry = playlist[0] as { value?: unknown } | undefined
		return extractFileName(firstEntry?.value)
	}
	return extractFileName(settings.local_file)
}

export function splitTimecode(timecode: string): { hh: string; mm: string; ss: string } {
	// Splits an "hh:mm:ss" timecode into padded parts.
	const parts = timecode.split(':')
	return {
		hh: parts[0] ?? '00',
		mm: parts[1] ?? '00',
		ss: parts[2] ?? '00',
	}
}

export function formatTimecode(data: number): string {
	// Converts milliseconds into a readable time format (hh:mm:ss).
	try {
		const totalSeconds = Math.floor(data / 1000)
		const hours = Math.floor(totalSeconds / 3600)
		const minutes = Math.floor((totalSeconds % 3600) / 60)
		const seconds = totalSeconds % 60
		return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
	} catch (error) {
		logger.debug(`Error formatting timecode: ${error} `)
		return '00:00:00'
	}
}

export function roundNumber(number: number, decimalPlaces: number): number {
	// Rounds a number to a specified number of decimal places.
	try {
		const multiplier = Math.pow(10, decimalPlaces ?? 0)
		return Math.round(number * multiplier) / multiplier
	} catch (error) {
		logger.debug(`Error rounding number ${number}: ${error} `)
		return typeof number === 'number' ? number : 0
	}
}

export function rgbaToObsColor(rgbaString: string): number {
	// Parse rgba(r, g, b, a) to 32-bit integer for OBS: (A << 24) | (B << 16) | (G << 8) | R.
	const match = rgbaString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
	if (!match) {
		// Try to parse as integer or return 0 if format is unexpected.
		const parsed = parseInt(rgbaString, 10)
		return isNaN(parsed) ? 0 : parsed
	}

	const r = parseInt(match[1], 10)
	const g = parseInt(match[2], 10)
	const b = parseInt(match[3], 10)
	const a = match[4] ? Math.round(parseFloat(match[4]) * 255) : 255

	return ((a << 24) | (b << 16) | (g << 8) | r) >>> 0
}

export function obsColorToRgba(obsColor: number): string {
	// Convert 32-bit OBS integer color to rgba(r, g, b, a) string.
	const a = ((obsColor >> 24) & 0xff) / 255
	const b = (obsColor >> 16) & 0xff
	const g = (obsColor >> 8) & 0xff
	const r = obsColor & 0xff

	return `rgba(${r}, ${g}, ${b}, ${a})`
}

export function getOBSRecordingStateLabel(state: OBSRecordingState): string {
	switch (state) {
		case OBSRecordingState.Recording:
			return 'Recording'
		case OBSRecordingState.Paused:
			return 'Paused'
		case OBSRecordingState.Stopped:
			return 'Stopped'
		case OBSRecordingState.Starting:
			return 'Starting'
		case OBSRecordingState.Stopping:
			return 'Stopping'
		default:
			return 'Unknown'
	}
}

export function getOBSStreamingStateLabel(state: OBSStreamingState): string {
	switch (state) {
		case OBSStreamingState.Streaming:
		case OBSStreamingState.Reconnected:
			return 'Live'
		case OBSStreamingState.Starting:
			return 'Starting'
		case OBSStreamingState.Stopping:
			return 'Stopping'
		case OBSStreamingState.Reconnecting:
			return 'Reconnecting'
		default:
			return 'Off-Air'
	}
}

export function getOBSMediaStatusLabel(status: OBSMediaStatus | undefined): string {
	switch (status) {
		case OBSMediaStatus.Playing:
			return 'Playing'
		case OBSMediaStatus.Paused:
			return 'Paused'
		case OBSMediaStatus.Stopped:
			return 'Stopped'
		case OBSMediaStatus.Ended:
			return 'Ended'
		case OBSMediaStatus.Buffering:
			return 'Buffering'
		case OBSMediaStatus.Error:
			return 'Error'
		default:
			return 'Stopped'
	}
}

export function getMonitorTypeLabel(type: ObsAudioMonitorType | string | undefined): string {
	switch (type) {
		case ObsAudioMonitorType.MonitorAndOutput:
			return 'Monitor / Output'
		case ObsAudioMonitorType.MonitorOnly:
			return 'Monitor Only'
		default:
			return 'Off'
	}
}

/**
 * OBS 32.1+ dropped "Monitor Only" from its UI and made muting independent of monitoring, so monitoring is
 * an on/off state. The legacy monitor-only type is still reported by OBS and counts as enabled.
 */
export function isMonitoringEnabled(type: ObsAudioMonitorType | string | undefined): boolean {
	return type !== undefined && type !== (ObsAudioMonitorType.None as string)
}

/** Converts a GetInputAudioTracks-style `{"1": true, "2": false, ...}` map to the sorted list of enabled track numbers. */
export function activeAudioTracks(tracks: Record<string, unknown> | undefined): number[] {
	if (!tracks) return []
	return Object.entries(tracks)
		.filter(([, enabled]) => enabled === true)
		.map(([track]) => Number(track))
		.filter((track) => Number.isInteger(track))
		.sort((a, b) => a - b)
}
