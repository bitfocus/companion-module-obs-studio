import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { ObsAudioMonitorType } from '../types.js'
import { opt, Color } from '../utils.js'

export function getAudioFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['audio_muted'] = {
		type: 'boolean',
		name: 'Audio - Muted',
		description: 'If an audio source is muted, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
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
			const sourceUuid = opt<string>(feedback, 'source')
			return !!self.states.sources.get(sourceUuid)?.inputMuted
		},
	}

	feedbacks['audio_monitor_type'] = {
		type: 'boolean',
		name: 'Audio - Monitor Type',
		description: 'If the audio monitor type is matched, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
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
			const sourceUuid = opt<string>(feedback, 'source')
			const monitorType = opt<ObsAudioMonitorType>(feedback, 'monitor')
			return self.states.sources.get(sourceUuid)?.monitorType === monitorType
		},
	}

	feedbacks['volume'] = {
		type: 'boolean',
		name: 'Audio - Volume',
		description: 'If an audio source volume is matched, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
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
			const sourceUuid = opt<string>(feedback, 'source')
			return self.states.sources.get(sourceUuid)?.inputVolume === opt<any>(feedback, 'volume')
		},
	}

	feedbacks['audioPeaking'] = {
		type: 'boolean',
		name: 'Audio - Peaking',
		description: 'If audio is above a certain dB value, change the style of the button',
		defaultStyle: {
			color: Color.Black,
			bgcolor: Color.Red,
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
			const sourceUuid = opt<string>(feedback, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (source?.peak && source.peak > opt<number>(feedback, 'threshold')) {
				return true
			}
			return false
		},
	}

	return feedbacks
}
