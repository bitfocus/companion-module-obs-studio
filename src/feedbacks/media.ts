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
			return self.states.mediaSources.get(feedback.options.source as string)?.mediaState == 'OBS_MEDIA_STATE_PLAYING'
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
			const sourceName = feedback.options.source as string
			const mediaSource = self.states.mediaSources.get(sourceName)
			if (mediaSource) {
				const remainingTime = Math.round((mediaSource.mediaDuration - mediaSource.mediaCursor) / 1000)
				const mediaState = mediaSource.mediaState

				if (feedback.options.onlyIfSourceIsOnProgram && !self.states.sources.get(sourceName)?.active) {
					return false
				}

				if (feedback.options.onlyIfSourceIsPlaying && mediaState !== 'OBS_MEDIA_STATE_PLAYING') {
					return false
				}

				if (mediaState === 'OBS_MEDIA_STATE_ENDED') {
					return false
				}

				const threshold = feedback.options.rtThreshold as number
				if (remainingTime <= threshold) {
					if (feedback.options.blinkingEnabled && mediaState === 'OBS_MEDIA_STATE_PLAYING') {
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
