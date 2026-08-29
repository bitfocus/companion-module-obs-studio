import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, styleCaution } from '../presets/style.js'
import { OBSMediaStatus } from '../types.js'
import { choiceDropdown } from '../actions/options.js'

export type MediaFeedbackSchemas = {
	media_playing: { type: 'boolean'; options: { source: string } }
	media_source_time_remaining: {
		type: 'boolean'
		options: {
			source: string
			rtThreshold: number
			onlyIfSourceIsOnProgram: boolean
			onlyIfSourceIsPlaying: boolean
			blinkingEnabled: boolean
		}
	}
	mediaProgress: { type: 'value'; options: { source: string } }
	mediaTimeRemaining: { type: 'value'; options: { source: string } }
}

export function getMediaFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<MediaFeedbackSchemas> {
	return {
		media_playing: {
			type: 'boolean',
			name: 'Media - Playing',
			description: 'If a specific media source is currently playing, change the style of the button',
			defaultStyle: styleActive(),
			options: [choiceDropdown(self, 'mediaSource', { id: 'source', label: 'Media Source' })],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return self.obsState.findSourceByName(sourceName)?.OBSMediaStatus === OBSMediaStatus.Playing
			},
		},

		media_source_time_remaining: {
			type: 'boolean',
			name: 'Media - Remaining Time',
			description: 'If remaining time of a media source is below a threshold, change the style of the button',
			defaultStyle: styleCaution(),
			options: [
				choiceDropdown(self, 'mediaSource', { id: 'source', label: 'Source name' }),
				{
					type: 'number',
					label: 'Remaining time threshold (in seconds)',
					id: 'rtThreshold',
					default: 20,
					min: 0,
					max: 3600, // Max is required by API
					clampValues: true,
				},
				{
					type: 'checkbox',
					label: 'Feedback only if source is on program',
					id: 'onlyIfSourceIsOnProgram',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Feedback only if source is playing',
					id: 'onlyIfSourceIsPlaying',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Blinking',
					id: 'blinkingEnabled',
					default: false,
				},
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (source) {
					const remainingTime = Math.round(((source.mediaDuration ?? 0) - (source.mediaCursor ?? 0)) / 1000)
					const status = source.OBSMediaStatus

					if (feedback.options.onlyIfSourceIsOnProgram && !source.active) {
						return false
					}

					if (feedback.options.onlyIfSourceIsPlaying && status !== OBSMediaStatus.Playing) {
						return false
					}

					if (status === OBSMediaStatus.Stopped) {
						return false
					}

					const threshold = feedback.options.rtThreshold
					if (remainingTime <= threshold) {
						if (feedback.options.blinkingEnabled && status === OBSMediaStatus.Playing) {
							return !!(Math.floor(Date.now() / 500) % 2)
						}
						return true
					}
				}
				return false
			},
		},

		mediaProgress: {
			type: 'value',
			name: 'Media - Playback Progress (%)',
			description: 'How far through a media source playback is, as a percentage, for use with a gauge',
			options: [choiceDropdown(self, 'mediaSource', { id: 'source', label: 'Media Source' })],
			callback: (feedback) => {
				const source = self.obsState.findSourceByName(feedback.options.source)
				const duration = source?.mediaDuration ?? 0
				if (duration <= 0) return 0
				const progress = ((source?.mediaCursor ?? 0) / duration) * 100
				return Math.min(100, Math.max(0, Math.round(progress)))
			},
		},

		mediaTimeRemaining: {
			type: 'value',
			name: 'Media - Remaining Time (seconds)',
			description: 'The remaining playback time of a media source, in seconds',
			options: [choiceDropdown(self, 'mediaSource', { id: 'source', label: 'Media Source' })],
			callback: (feedback) => {
				const source = self.obsState.findSourceByName(feedback.options.source)
				const remaining = (source?.mediaDuration ?? 0) - (source?.mediaCursor ?? 0)
				return remaining > 0 ? Math.round(remaining / 1000) : 0
			},
		},
	}
}
