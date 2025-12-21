import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import * as utils from '../utils.js'

export function getAudioActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['toggle_source_mute'] = {
		name: 'Toggle Source Mute',
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
			await self.obs.sendRequest('ToggleInputMute', { inputName: action.options.source as string })
		},
	}
	actions['set_volume'] = {
		name: 'Set Source Volume',
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
				inputName: action.options.source as string,
				inputVolumeDb: action.options.volume as number,
			})
		},
	}

	actions['adjust_volume'] = {
		name: 'Adjust Source Volume',
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
			const sourceName = action.options.source as string
			const currentVolume = self.states.sources.get(sourceName)?.inputVolume
			let newVolume = (currentVolume !== undefined ? currentVolume : 0) + (action.options.volume as number)
			if (newVolume > 26) {
				newVolume = 26
			} else if (newVolume < -100) {
				newVolume = -100
			}

			await self.obs.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newVolume })
		},
	}
	actions['adjust_volume_percent'] = {
		name: 'Adjust Source Volume (Percentage)',
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
				default: 1,
				min: -100,
				max: 100,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const currentVolume = self.states.sources.get(sourceName)?.inputVolume ?? -100

			const LOG_OFFSET_DB = 0 // Define LOG_OFFSET_DB or get it from somewhere if needed.
			// In original it was used: let currentPercentage = Math.pow(10, (currentVolume - LOG_OFFSET_DB) / 20) * 100
			// Let's assume LOG_OFFSET_DB is 0 for now as it wasn't defined in the snippet I saw.

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

			await self.obs.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newDb })
		},
	}
	actions['fadeVolume'] = {
		name: 'Fade Source Volume',
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
			const sourceName = action.options.source as string
			const targetVolume = action.options.volume as number
			const duration = action.options.duration as number
			const source = self.states.sources.get(sourceName)

			if (source && !source.audioFadeActive) {
				const currentVolume = source.inputVolume ?? -100
				const frames = Math.floor(duration / 50)
				const volStep = (targetVolume - currentVolume) / frames
				const fadeBatch = []

				for (let i = 1; i <= frames; i++) {
					fadeBatch.push({
						requestType: 'SetInputVolume',
						requestData: {
							inputName: sourceName,
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
		name: 'Set Source Audio Offset',
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
				inputName: action.options.source as string,
				inputAudioSyncOffset: action.options.offset as number,
			})
		},
	}

	actions['adjust_audio_offset'] = {
		name: 'Adjust Source Audio Offset',
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
				default: 1,
				min: -20000,
				max: 20000,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const currentOffset = self.states.sources.get(sourceName)?.inputAudioSyncOffset
			let newOffset = (currentOffset !== undefined ? currentOffset : 0) + (action.options.amount as number)
			if (newOffset > 20000) {
				newOffset = 20000
			} else if (newOffset < -950) {
				newOffset = -950
			}
			await self.obs.sendRequest('SetInputAudioSyncOffset', {
				inputName: sourceName,
				inputAudioSyncOffset: newOffset,
			})
		},
	}

	actions['set_audio_balance'] = {
		name: 'Set Source Audio Balance',
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
			const source = action.options.source as string
			await self.obs.sendRequest('SetInputAudioBalance', {
				inputName: source,
				inputAudioBalance: action.options.balance as number,
			})
		},
	}

	actions['adjust_audio_balance'] = {
		name: 'Adjust Source Audio Balance',
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
			const sourceName = action.options.source as string
			const currentOffset = self.states.sources.get(sourceName)?.inputAudioBalance
			let newOffset = (currentOffset !== undefined ? currentOffset : 0.5) + (action.options.amount as number)
			if (newOffset > 1.0) {
				newOffset = 1.0
			} else if (newOffset < 0.0) {
				newOffset = 0.0
			}
			await self.obs.sendRequest('SetInputAudioBalance', {
				inputName: sourceName,
				inputAudioBalance: newOffset,
			})
		},
	}

	actions['set_audio_monitor'] = {
		name: 'Set Audio Monitor Type',
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
		callback: async (action) => {
			let monitorType: any
			if (action.options.monitor === 'monitorAndOutput') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
			} else if (action.options.monitor === 'monitorOnly') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
			} else {
				monitorType = 'OBS_MONITORING_TYPE_NONE'
			}
			await self.obs.sendRequest('SetInputAudioMonitorType', {
				inputName: action.options.source,
				monitorType: monitorType,
			})
		},
	}

	return actions
}
