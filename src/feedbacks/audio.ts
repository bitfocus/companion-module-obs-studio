import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { ObsAudioMonitorType } from '../types.js'
import { Color } from '../utils.js'

export type AudioFeedbackSchemas = {
	audio_muted: { type: 'boolean'; options: { source: string } }
	audio_monitor_type: { type: 'boolean'; options: { source: string; monitor: ObsAudioMonitorType } }
	volume: { type: 'boolean'; options: { source: string; volume: number } }
	audioPeaking: { type: 'boolean'; options: { source: string; threshold: number } }
	audioMeter: { type: 'advanced'; options: { source: string; threshold: number } }
}

export function getAudioFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<AudioFeedbackSchemas> {
	return {
		audio_muted: {
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
					allowCustom: true,
					label: 'Source name',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return !!self.obsState.findSourceByName(sourceName)?.inputMuted
			},
		},

		audio_monitor_type: {
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
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
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
				const sourceName = feedback.options.source
				const monitorType = feedback.options.monitor
				return self.obsState.findSourceByName(sourceName)?.monitorType === monitorType
			},
		},

		volume: {
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
					allowCustom: true,
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
					clampValues: true,
				},
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return self.obsState.findSourceByName(sourceName)?.inputVolume === feedback.options.volume
			},
		},

		audioPeaking: {
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
					allowCustom: true,
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
					clampValues: true,
				},
			],
			callback: (feedback) => {
				// Tell the API to subscribe to volume-meters while this feedback exists.
				self.obs.addMeterSubscriber(feedback.id)
				const sourceName = feedback.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (source?.peak && source.peak > feedback.options.threshold) {
					return true
				}
				return false
			},
			unsubscribe: (feedback) => self.obs.removeMeterSubscriber(feedback.id),
		},

		audioMeter: {
			type: 'advanced',
			name: 'Audio - Meter',
			description: 'Change the style of the button to show colors based on peak values, similar to the OBS audio meter',
			affectedProperties: ['bgcolor'],
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source name',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
				{
					type: 'number',
					label: 'Threshold (dB)',
					tooltip:
						'Minimum value (between -100dB and -21dB) for the feedback to turn green. Color defaults to black for values below this.',
					id: 'threshold',
					default: -60,
					min: -100,
					max: -21,
					clampValues: true,
				},
			],
			callback: (feedback) => {
				self.obs.addMeterSubscriber(feedback.id)
				const sourceName = feedback.options.source
				const peak = self.obsState.findSourceByName(sourceName)?.peak ?? -100
				const threshold = feedback.options.threshold ?? -60
				if (peak > -9) {
					return { bgcolor: Color.Red }
				} else if (peak > -20) {
					return { bgcolor: Color.Orange }
				} else if (peak > threshold) {
					return { bgcolor: Color.Green }
				} else {
					return { bgcolor: Color.Black }
				}
			},
			unsubscribe: (feedback) => self.obs.removeMeterSubscriber(feedback.id),
		},
	}
}
