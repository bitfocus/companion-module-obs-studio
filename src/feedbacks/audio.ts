import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, styleAlert } from '../presets/style.js'
import { isMonitoringEnabled } from '../utils.js'
import { AUDIO_TRACK_CHOICES, choiceDropdown } from '../actions/options.js'

export type AudioFeedbackSchemas = {
	audio_muted: { type: 'boolean'; options: { source: string } }
	audio_monitor_type: { type: 'boolean'; options: { source: string } }
	audio_track: { type: 'boolean'; options: { source: string; track: string } }
	volume: { type: 'boolean'; options: { source: string; volume: number } }
	audioPeaking: { type: 'boolean'; options: { source: string; threshold: number } }
	audioPeakLevel: { type: 'value'; options: { source: string } }
	sourceVolume: { type: 'value'; options: { source: string } }
}

export function getAudioFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<AudioFeedbackSchemas> {
	return {
		audio_muted: {
			type: 'boolean',
			name: 'Audio - Muted',
			description: 'If an audio source is muted, change the style of the button',
			defaultStyle: styleAlert(),
			options: [choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source name' })],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return !!self.obsState.findSourceByName(sourceName)?.inputMuted
			},
		},

		audio_monitor_type: {
			type: 'boolean',
			name: 'Audio - Monitoring',
			description: 'If audio monitoring is enabled for a source, change the style of the button',
			defaultStyle: styleActive(),
			options: [choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source' })],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return isMonitoringEnabled(self.obsState.findSourceByName(sourceName)?.monitorType)
			},
		},

		audio_track: {
			type: 'boolean',
			name: 'Audio - Track Enabled',
			description: 'If a mixer output track of an audio source is enabled, change the style of the button',
			defaultStyle: styleActive(),
			options: [
				choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source' }),
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Track',
					id: 'track',
					default: '1',
					choices: AUDIO_TRACK_CHOICES,
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
			defaultStyle: styleActive(),
			options: [
				choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source name' }),
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
			defaultStyle: styleActive(),
			options: [
				choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source name' }),
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

		audioPeakLevel: {
			type: 'value',
			name: 'Audio - Peak Level (dB)',
			description: 'The current peak level of an audio source, in dB, for use with a gauge or local variable',
			options: [choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source name' })],
			callback: (feedback) => {
				self.obs.addMeterSubscriber(feedback.id)
				const sourceName = feedback.options.source
				return self.obsState.findSourceByName(sourceName)?.peak ?? -100
			},
			unsubscribe: (feedback) => self.obs.removeMeterSubscriber(feedback.id),
		},

		sourceVolume: {
			type: 'value',
			name: 'Audio - Volume (dB)',
			description: 'The current volume of an audio source, in dB, for use with a gauge or local variable',
			options: [choiceDropdown(self, 'audioSource', { id: 'source', label: 'Source name' })],
			callback: (feedback) => {
				const sourceName = feedback.options.source
				return self.obsState.findSourceByName(sourceName)?.inputVolume ?? -100
			},
		},
	}
}
