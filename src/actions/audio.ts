import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { clamp, opt } from '../utils.js'
import * as utils from '../utils.js'
import { ObsAudioMonitorType } from '../types.js'
import {
	VOLUME_MIN_DB,
	VOLUME_MAX_DB,
	BALANCE_MIN,
	BALANCE_MAX,
	SYNC_OFFSET_MIN,
	SYNC_OFFSET_MAX,
} from '../constants.js'

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
			await self.obs.sendRequest('ToggleInputMute', { inputUuid: opt<string>(action, 'source') })
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
				inputUuid: opt<string>(action, 'source'),
				inputMuted: opt<any>(action, 'mute') === 'true',
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (!source) return undefined
			return {
				mute: source.inputMuted ? 'true' : 'false',
			}
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
				min: VOLUME_MIN_DB,
				max: VOLUME_MAX_DB,
				range: false,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputVolume', {
				inputUuid: opt<string>(action, 'source'),
				inputVolumeDb: opt<number>(action, 'volume'),
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (!source) return undefined
			return {
				volume: source.inputVolume,
			}
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
				min: VOLUME_MIN_DB,
				max: VOLUME_MAX_DB,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const currentVolume = self.states.sources.get(sourceUuid)?.inputVolume
			const newVolume = clamp(
				(currentVolume !== undefined ? currentVolume : 0) + opt<number>(action, 'volume'),
				VOLUME_MIN_DB,
				VOLUME_MAX_DB,
			)

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
				min: VOLUME_MIN_DB,
				max: 100,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const currentVolume = self.states.sources.get(sourceUuid)?.inputVolume ?? -100

			const LOG_OFFSET_DB = 0
			const currentPercentage = Math.pow(10, (currentVolume - LOG_OFFSET_DB) / 20) * 100
			let newPercentage = currentPercentage + opt<number>(action, 'volume')

			newPercentage = clamp(newPercentage, 0, 100)

			let newDb = 20 * Math.log10(newPercentage / 100) + LOG_OFFSET_DB
			newDb = clamp(newDb, VOLUME_MIN_DB, VOLUME_MAX_DB)

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
				min: VOLUME_MIN_DB,
				max: VOLUME_MAX_DB,
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
			const sourceUuid = opt<string>(action, 'source')
			const targetVolume = opt<number>(action, 'volume')
			const duration = opt<number>(action, 'duration')
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
							inputVolumeDb: utils.roundNumber(currentVolume + volStep * i, 1),
						},
						sleep: 50,
					})
				}

				source.audioFadeActive = true
				try {
					await self.obs.sendBatch(fadeBatch)
				} finally {
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
				min: SYNC_OFFSET_MIN,
				max: SYNC_OFFSET_MAX,
				range: false,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetInputAudioSyncOffset', {
				inputUuid: opt<string>(action, 'source'),
				inputAudioSyncOffset: opt<number>(action, 'offset'),
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (!source) return undefined
			return {
				offset: source.inputAudioSyncOffset,
			}
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
				max: SYNC_OFFSET_MAX,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const currentOffset = self.states.sources.get(sourceUuid)?.inputAudioSyncOffset
			const newOffset = clamp(
				(currentOffset !== undefined ? currentOffset : 0) + opt<number>(action, 'amount'),
				SYNC_OFFSET_MIN,
				SYNC_OFFSET_MAX,
			)
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
				min: BALANCE_MIN,
				max: BALANCE_MAX,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			await self.obs.sendRequest('SetInputAudioBalance', {
				inputUuid: sourceUuid,
				inputAudioBalance: opt<number>(action, 'balance'),
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (!source) return undefined
			return {
				balance: source.inputAudioBalance,
			}
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
				max: BALANCE_MAX,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const currentOffset = self.states.sources.get(sourceUuid)?.inputAudioBalance
			const newOffset = clamp(
				(currentOffset !== undefined ? currentOffset : 0.5) + opt<number>(action, 'amount'),
				BALANCE_MIN,
				BALANCE_MAX,
			)
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
			const monitorType = opt<ObsAudioMonitorType>(action, 'monitor')
			await self.obs.sendRequest('SetInputAudioMonitorType', {
				inputUuid: opt<string>(action, 'source'),
				monitorType: monitorType,
			})
		},
		learn: (action) => {
			const sourceUuid = opt<string>(action, 'source')
			const source = self.states.sources.get(sourceUuid)
			if (!source) return undefined
			return {
				monitor: source.monitorType,
			}
		},
	}

	return actions
}
