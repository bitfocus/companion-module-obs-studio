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
	}
}
