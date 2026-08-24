import type { CompanionButtonStyleProps } from '@companion-module/base'
import { Color } from '../utils.js'

// Re-export colors and style helpers.
export { Color }

/**
 * Shared styling helpers to ensure consistent preset look and feel.
 *
 * Text conventions, applied consistently across every preset file. The guiding rule is that a button
 * should read as an extension of the OBS window, so wording mirrors OBS's own labels:
 * - Control presets (steps contain an action) use Title Case, verb + noun, one phrase per line, and
 *   reuse OBS's exact label where it has one: `Start\nRecording`, `Studio Mode`, `Split\nFile`.
 * - Status presets (empty steps) use a Title Case label with a trailing colon, value on the next
 *   line: `Disk Space:\n$(obs:free_disk_space)`.
 * - Units always accompany their value, inline, never on a line of their own.
 */

// Semantic palette mapping OBS state to base colors. Each state has its own color, so that two
// different states are never indistinguishable on a button.
export const Style = {
	idleBg: Color.Black,
	idleFg: Color.White,
	program: Color.Red, // Active in program
	preview: Color.Green, // In preview
	active: Color.Blue, // Generic on/active
	warning: Color.Orange, // Paused/degraded
	alert: Color.Crimson, // Muted/error
	caution: Color.Yellow, // Threshold warning
	disabled: Color.Gray, // Not applicable/no signal
} as const

// Numeric font sizes to avoid type drift.
export const SIZE = { default: 14 } as const

/** Base button style (white-on-black with hidden top bar). */
export function baseStyle(over: Partial<CompanionButtonStyleProps> = {}): CompanionButtonStyleProps {
	return {
		text: '',
		size: SIZE.default,
		color: Style.idleFg,
		bgcolor: Style.idleBg,
		show_topbar: false,
		...over,
	}
}

// Feedback style fragments applied when feedback is active. Each carries the foreground that reads
// against its own background, rather than assuming white.
type FeedbackStyle = { bgcolor: number; color: number }
export const styleProgram = (): FeedbackStyle => ({ bgcolor: Style.program, color: Style.idleFg })
export const stylePreview = (): FeedbackStyle => ({ bgcolor: Style.preview, color: Style.idleFg })
export const styleActive = (): FeedbackStyle => ({ bgcolor: Style.active, color: Style.idleFg })
export const styleWarn = (): FeedbackStyle => ({ bgcolor: Style.warning, color: Style.idleFg })
export const styleAlert = (): FeedbackStyle => ({ bgcolor: Style.alert, color: Style.idleFg })
export const styleCaution = (): FeedbackStyle => ({ bgcolor: Style.caution, color: Style.idleBg })
export const styleDisabled = (): FeedbackStyle => ({ bgcolor: Style.disabled, color: Style.idleFg })

/** Slug used for preset and preset-group ids derived from an OBS source/output name. */
export function presetSlug(name: string): string {
	return name.replace(/[^a-zA-Z0-9]+/g, '_')
}
