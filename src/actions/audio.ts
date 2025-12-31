import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import * as utils from '../utils.js'
import { ObsAudioMonitorType } from '../types.js'

export function getAudioActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['toggle_source_mute'] = {
		name: 'Audio - Toggle Source Mute',
		description: 'Toggles the mute state of a specific audio source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('ToggleInputMute', { inputUuid: action.options.source as string })
		},
	}
	actions['set_source_mute'] = {
		name: 'Audio - Set Mute',
		description: 'Sets the mute state of a specific audio source (deprecated, use audio actions instead)',
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
				label: 'Mute',
				id: 'mute',
				default: 'true',
				choices: [
					{ id: 'true', label: 'Mute' },
					{ id: 'false', label: 'Unmute' },
				],
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputMute', {
				inputUuid: action.options.source as string,
				inputMuted: action.options.mute === 'true',
			})
		},
	}
	actions['set_volume'] = {
		name: 'Audio - Set Source Volume',
		description: 'Sets the volume of a specific audio source in decibels',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26)',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputVolume', {
				inputUuid: action.options.source as string,
				inputVolumeDb: action.options.volume as number,
			})
		},
	}
	actions['adjust_volume'] = {
		name: 'Audio - Adjust Source Volume',
		description: 'Increases or decreases the volume of a specific audio source by a set amount of decibels',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Amount in dB',
				id: 'volume',
				default: 1,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const currentVolume = self.states.sources.get(sourceUuid)?.inputVolume
			let newVolume = (currentVolume !== undefined ? currentVolume : 0) + (action.options.volume as number)
			if (newVolume > 26) {
				newVolume = 26
			} else if (newVolume < -100) {
				newVolume = -100
			}

			await self.obs.sendRequest('SetInputVolume', { inputUuid: sourceUuid, inputVolumeDb: newVolume })
		},
	}
	actions['adjust_volume_percent'] = {
		name: 'Audio - Adjust Source Volume (Percentage)',
		description: 'Increases or decreases the volume of a specific audio source by a percentage of its range',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Amount in Percentage',
				id: 'volume',
				default: 5,
				min: -100,
				max: 100,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const currentVolume = self.states.sources.get(sourceUuid)?.inputVolume ?? -100

			const LOG_OFFSET_DB = 0
			const currentPercentage = Math.pow(10, (currentVolume - LOG_OFFSET_DB) / 20) * 100
			let newPercentage = currentPercentage + (action.options.volume as number)

			if (newPercentage > 100) {
				newPercentage = 100
			} else if (newPercentage < 0) {
				newPercentage = 0
			}

			let newDb = 20 * Math.log10(newPercentage / 100) + LOG_OFFSET_DB
			if (newDb < -100) {
				newDb = -100
			}

			await self.obs.sendRequest('SetInputVolume', { inputUuid: sourceUuid, inputVolumeDb: newDb })
		},
	}
	actions['fadeVolume'] = {
		name: 'Audio - Fade Source Volume',
		description: 'Fades the volume of a source to a target value over a specific duration',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Target Volume in dB',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
			{
				type: 'number',
				label: 'Fade Duration (in ms)',
				id: 'duration',
				default: 1000,
				min: 10,
				max: 60000,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const targetVolume = action.options.volume as number
			const duration = action.options.duration as number
			const source = self.states.sources.get(sourceUuid)

			if (source && !source.audioFadeActive) {
				const currentVolume = source.inputVolume ?? -100
				const frames = Math.floor(duration / 50)
				const volStep = (targetVolume - currentVolume) / frames
				const fadeBatch = []

				for (let i = 1; i <= frames; i++) {
					fadeBatch.push({
						requestType: 'SetInputVolume',
						requestData: {
							inputUuid: sourceUuid,
							inputVolumeDb: utils.roundNumber(self, currentVolume + volStep * i, 1),
						},
						sleep: 50,
					})
				}

				if (source) {
					source.audioFadeActive = true
				}
				await self.obs.sendBatch(fadeBatch)
				if (source) {
					source.audioFadeActive = false
				}
			}
		},
	}
	actions['set_audio_offset'] = {
		name: 'Audio - Set Source Audio Offset',
		description: 'Sets the audio sync offset for a specific source in milliseconds',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Offset in ms',
				id: 'offset',
				default: 0,
				min: -950,
				max: 20000,
				range: false,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputAudioSyncOffset', {
				inputUuid: action.options.source as string,
				inputAudioSyncOffset: action.options.offset as number,
			})
		},
	}
	actions['adjust_audio_offset'] = {
		name: 'Audio - Adjust Source Audio Offset',
		description: 'Increases or decreases the audio sync offset of a specific source by a set amount of milliseconds',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Amount in ms',
				id: 'amount',
				default: 50,
				min: -20000,
				max: 20000,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const currentOffset = self.states.sources.get(sourceUuid)?.inputAudioSyncOffset
			let newOffset = (currentOffset !== undefined ? currentOffset : 0) + (action.options.amount as number)
			if (newOffset > 20000) {
				newOffset = 20000
			} else if (newOffset < -950) {
				newOffset = -950
			}
			await self.obs.sendRequest('SetInputAudioSyncOffset', {
				inputUuid: sourceUuid,
				inputAudioSyncOffset: newOffset,
			})
		},
	}
	actions['set_audio_balance'] = {
		name: 'Audio - Set Source Audio Balance',
		description: 'Sets the audio balance for a specific source (0.0 for Left, 0.5 for Center, 1.0 for Right)',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Balance (0.0 to 1.0)',
				id: 'balance',
				default: 0.5,
				min: 0.0,
				max: 1.0,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			await self.obs.sendRequest('SetInputAudioBalance', {
				inputUuid: sourceUuid,
				inputAudioBalance: action.options.balance as number,
			})
		},
	}
	actions['adjust_audio_balance'] = {
		name: 'Audio - Adjust Source Audio Balance',
		description: 'Increases or decreases the audio balance of a specific source by a set percentage',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.audioSourceListDefault,
				choices: self.obsState.audioSourceList,
			},
			{
				type: 'number',
				label: 'Amount (percentage of range)',
				id: 'amount',
				default: 0.1,
				min: -1.0,
				max: 1.0,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = action.options.source as string
			const currentOffset = self.states.sources.get(sourceUuid)?.inputAudioBalance
			let newOffset = (currentOffset !== undefined ? currentOffset : 0.5) + (action.options.amount as number)
			if (newOffset > 1.0) {
				newOffset = 1.0
			} else if (newOffset < 0.0) {
				newOffset = 0.0
			}
			await self.obs.sendRequest('SetInputAudioBalance', {
				inputUuid: sourceUuid,
				inputAudioBalance: newOffset,
			})
		},
	}

	actions['set_audio_monitor'] = {
		name: 'Audio - Set Audio Monitor Type',
		description: 'Sets the audio monitoring type for a specific source',
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
		callback: async (action) => {
			const monitorType = action.options.monitor as ObsAudioMonitorType
			await self.obs.sendRequest('SetInputAudioMonitorType', {
				inputUuid: action.options.source as string,
				monitorType: monitorType,
			})
		},
	}

	return actions
}
