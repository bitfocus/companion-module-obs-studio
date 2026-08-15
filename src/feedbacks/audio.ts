import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { Color, isMonitoringEnabled } from '../utils.js'

export type AudioFeedbackSchemas = {
	audio_muted: { type: 'boolean'; options: { source: string } }
	audio_monitor_type: { type: 'boolean'; options: { source: string } }
	audio_track: { type: 'boolean'; options: { source: string; track: string } }
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
			name: 'Audio - Monitoring',
			description: 'If audio monitoring is enabled for a source, change the style of the button',
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
			],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return isMonitoringEnabled(self.obsState.findSourceByName(sourceName)?.monitorType)
			},
		},

		audio_track: {
			type: 'boolean',
			name: 'Audio - Track Enabled',
			description: 'If a mixer output track of an audio source is enabled, change the style of the button',
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
					label: 'Track',
					id: 'track',
					default: '1',
					choices: [
						{ id: '1', label: 'Track 1' },
						{ id: '2', label: 'Track 2' },
						{ id: '3', label: 'Track 3' },
						{ id: '4', label: 'Track 4' },
						{ id: '5', label: 'Track 5' },
						{ id: '6', label: 'Track 6' },
					],
				},
			],
			callback: (feedback) => {
				const source = self.obsState.findSourceByName(feedback.options.source)
				return source?.inputAudioTracks?.[feedback.options.track] === true
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
