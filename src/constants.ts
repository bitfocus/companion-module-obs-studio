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

/**
 * OBS input kind identifiers.
 *
 * Text sources are matched by prefix rather than exact value because OBS ships several versioned
 * variants (`text_gdiplus_v2`, `text_gdiplus_v3`, `text_ft2_source_v2`, …) that behave alike.
 */
export const INPUT_KIND_PREFIX_TEXT = 'text_'
/** GDI+ is the Windows-only text renderer; it exposes styling properties the FreeType one does not. */
export const INPUT_KIND_PREFIX_TEXT_GDIPLUS = 'text_gdiplus'
export const INPUT_KIND_FFMPEG_SOURCE = 'ffmpeg_source'
export const INPUT_KIND_VLC_SOURCE = 'vlc_source'
export const INPUT_KIND_IMAGE_SOURCE = 'image_source'

/** True for the media source kinds that support playback control and media polling. */
export function isMediaInputKind(inputKind: string | undefined | null): boolean {
	return inputKind === INPUT_KIND_FFMPEG_SOURCE || inputKind === INPUT_KIND_VLC_SOURCE
}

/** OBS's built-in virtual camera output, which has its own state-changed event. */
export const VIRTUALCAM_OUTPUT_NAME = 'virtualcam_output'

/** Outputs OBS reports but that are not offered as targets: recording/replay writers. */
export function isSelectableOutput(outputName: string): boolean {
	return !outputName.includes('file_output') && !outputName.includes('ffmpeg_output')
}

/** True for any of the versioned text source kinds. */
export function isTextInputKind(inputKind: string | undefined | null): boolean {
	return !!inputKind?.startsWith(INPUT_KIND_PREFIX_TEXT)
}

/**
 * Stream congestion thresholds, matching the icon buckets OBS uses in its own status bar
 * (`excellent` at no congestion, then `good`, `mediocre` and `bad` thirds).
 */
export const CONGESTION_GOOD = 1 / 3
export const CONGESTION_MEDIOCRE = 2 / 3
