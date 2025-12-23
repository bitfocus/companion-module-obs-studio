import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { ObsAudioMonitorType } from '../types.js'

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
			const sourceUuid = feedback.options.source as string
			return !!self.states.sources.get(sourceUuid)?.inputMuted
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
				default: ObsAudioMonitorType.None,
				choices: [
					{ id: ObsAudioMonitorType.None, label: 'Off' },
					{ id: ObsAudioMonitorType.MonitorOnly, label: 'Monitor Only' },
					{ id: ObsAudioMonitorType.MonitorAndOutput, label: 'Monitor / Output' },
				],
			},
		],
		callback: (feedback) => {
			const sourceUuid = feedback.options.source as string
			const monitorType = feedback.options.monitor as ObsAudioMonitorType
			return self.states.sources.get(sourceUuid)?.monitorType === monitorType
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
			const sourceUuid = feedback.options.source as string
			return self.states.sources.get(sourceUuid)?.inputVolume == feedback.options.volume
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
			const sourceUuid = feedback.options.source as string
			const source = self.states.sources.get(sourceUuid)
			if (source?.peak && source.peak > (feedback.options.threshold as number)) {
				return true
			}
			return false
		},
	}

	return feedbacks
}
