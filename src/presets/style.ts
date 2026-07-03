import type { CompanionButtonStyleProps } from '@companion-module/base'
import { Color } from '../utils.js'

// Re-export so preset files import colors + style helpers from one place.
export { Color }

/**
 * Shared styling for all presets. Every preset file builds its button style and
 * feedback styles through these helpers so the look stays consistent: no top bar,
 * one palette, numeric font sizes, and a single multiline convention (`\n`).
 */

// Semantic palette: maps an OBS state to one of the module's base colors.
export const Style = {
	idleBg: Color.Black,
	idleFg: Color.White,
	program: Color.Red, // on-air / active in program
	preview: Color.Green, // in preview
	active: Color.Green, // generic "on" (output active, transition active, unmuted, playing)
	warning: Color.Orange, // paused / degraded
	alert: Color.Red, // muted / error / low disk
	caution: Color.Yellow, // threshold warning
} as const

// Numeric font sizes only — avoids the historical `'14'` (string) vs `14` (number) drift.
export const SIZE = { default: 14, auto: 'auto' } as const

/**
 * Base button style. Always white-on-black with the top bar hidden; callers override
 * `text` (and occasionally `size`) via `over`.
 */
export function baseStyle(over: Partial<CompanionButtonStyleProps> = {}): CompanionButtonStyleProps {
	return {
		text: '',
		size: SIZE.auto,
		color: Style.idleFg,
		bgcolor: Style.idleBg,
		show_topbar: false,
		...over,
	}
}

// Feedback style fragments — the style applied to a button while a feedback is active.
type FeedbackStyle = { bgcolor: number; color: number }
export const styleProgram = (): FeedbackStyle => ({ bgcolor: Style.program, color: Color.White })
export const stylePreview = (): FeedbackStyle => ({ bgcolor: Style.preview, color: Color.White })
export const styleActive = (): FeedbackStyle => ({ bgcolor: Style.active, color: Color.White })
export const styleWarn = (): FeedbackStyle => ({ bgcolor: Style.warning, color: Color.White })
export const styleAlert = (): FeedbackStyle => ({ bgcolor: Style.alert, color: Color.White })
export const styleCaution = (): FeedbackStyle => ({ bgcolor: Style.caution, color: Color.White })
export const styleMuted = styleAlert
