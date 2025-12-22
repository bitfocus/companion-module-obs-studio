import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getMediaFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorBlack = combineRgb(0, 0, 0)

	feedbacks['media_playing'] = {
		type: 'boolean',
		name: 'Media Playing',
		description: 'If a media source is playing, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceList?.[0] ? self.obsState.mediaSourceList[0].id : '',
				choices: self.obsState.mediaSourceList,
			},
		],
		callback: (feedback) => {
			const sourceUuid = feedback.options.source as string
			return self.states.sources.get(sourceUuid)?.mediaStatus == 'OBS_MEDIA_STATE_PLAYING'
		},
	}

	feedbacks['media_source_time_remaining'] = {
		type: 'boolean',
		name: 'Media Source Remaining Time',
		description: 'If remaining time of a media source is below a threshold, change the style of the button',
		defaultStyle: {
			color: ColorBlack,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.obsState.mediaSourceList?.[0] ? self.obsState.mediaSourceList[0].id : '',
				choices: self.obsState.mediaSourceList,
			},
			{
				type: 'number',
				label: 'Remaining time threshold (in seconds)',
				id: 'rtThreshold',
				default: 20,
				min: 0,
				max: 3600, //max is required by api
				range: false,
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
			const sourceUuid = feedback.options.source as string
			const source = self.states.sources.get(sourceUuid)
			if (source) {
				const remainingTime = Math.round(((source.mediaDuration ?? 0) - (source.mediaCursor ?? 0)) / 1000)
				const mediaStatus = source.mediaStatus

				if (feedback.options.onlyIfSourceIsOnProgram && !source.active) {
					return false
				}

				if (feedback.options.onlyIfSourceIsPlaying && mediaStatus !== 'OBS_MEDIA_STATE_PLAYING') {
					return false
				}

				if (mediaStatus === 'OBS_MEDIA_STATE_ENDED') {
					return false
				}

				const threshold = feedback.options.rtThreshold as number
				if (remainingTime <= threshold) {
					if (feedback.options.blinkingEnabled && mediaStatus === 'OBS_MEDIA_STATE_PLAYING') {
						return !!(Math.floor(Date.now() / 500) % 2)
					}
					return true
				}
			}
			return false
		},
	}

	return feedbacks
}
