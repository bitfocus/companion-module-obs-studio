import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getAudioFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorBlack = combineRgb(0, 0, 0)

	feedbacks['audio_muted'] = {
		type: 'boolean',
		name: 'Audio Muted',
		description: 'If an audio source is muted, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
		],
		callback: (feedback) => {
			return !!self.states.sources.get(feedback.options.source as string)?.inputMuted
		},
	}

	feedbacks['audio_monitor_type'] = {
		type: 'boolean',
		name: 'Audio Monitor Type',
		description: 'If the audio monitor type is matched, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'dropdown',
				label: 'Monitor',
				id: 'monitor',
				default: 'none',
				choices: [
					{ id: 'none', label: 'None' },
					{ id: 'monitorOnly', label: 'Monitor Only' },
					{ id: 'monitorAndOutput', label: 'Monitor and Output' },
				],
			},
		],
		callback: (feedback) => {
			let monitorType: any
			if (feedback.options.monitor === 'monitorAndOutput') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
			} else if (feedback.options.monitor === 'monitorOnly') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
			} else {
				monitorType = 'OBS_MONITORING_TYPE_NONE'
			}
			return self.states.sources.get(feedback.options.source as string)?.monitorType === monitorType
		},
	}

	feedbacks['volume'] = {
		type: 'boolean',
		name: 'Volume',
		description: 'If an audio source volume is matched, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26) ',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: (feedback) => {
			return self.states.sources.get(feedback.options.source as string)?.inputVolume == feedback.options.volume
		},
	}

	feedbacks['audioPeaking'] = {
		type: 'boolean',
		name: 'Audio Peaking',
		description: 'If audio is above a certain dB value, change the style of the button',
		defaultStyle: {
			color: ColorBlack,
			bgcolor: ColorRed,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Threshold (dB)',
				id: 'threshold',
				default: -20,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: (feedback) => {
			const source = self.states.sources.get(feedback.options.source as string)
			if (source?.peak && source.peak > (feedback.options.threshold as number)) {
				return true
			}
			return false
		},
	}

	return feedbacks
}
