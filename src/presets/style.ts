import type { CompanionButtonStyleProps } from '@companion-module/base'
import { Color } from '../utils.js'

// Re-export colors and style helpers.
export { Color }

/** Shared styling helpers to ensure consistent preset look and feel. */

// Semantic palette mapping OBS state to base colors.
export const Style = {
	idleBg: Color.Black,
	idleFg: Color.White,
	program: Color.Red, // Active in program
	preview: Color.Green, // In preview
	active: Color.Green, // Generic on/active
	warning: Color.Orange, // Paused/degraded
	alert: Color.Red, // Muted/error
	caution: Color.Yellow, // Threshold warning
} as const

// Numeric font sizes to avoid type drift.
export const SIZE = { default: 14, auto: 'auto' } as const

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

// Feedback style fragments applied when feedback is active.
type FeedbackStyle = { bgcolor: number; color: number }
export const styleProgram = (): FeedbackStyle => ({ bgcolor: Style.program, color: Color.White })
export const stylePreview = (): FeedbackStyle => ({ bgcolor: Style.preview, color: Color.White })
export const styleActive = (): FeedbackStyle => ({ bgcolor: Style.active, color: Color.White })
export const styleWarn = (): FeedbackStyle => ({ bgcolor: Style.warning, color: Color.White })
export const styleAlert = (): FeedbackStyle => ({ bgcolor: Style.alert, color: Color.White })
export const styleCaution = (): FeedbackStyle => ({ bgcolor: Style.caution, color: Color.White })
export const styleMuted = styleAlert
