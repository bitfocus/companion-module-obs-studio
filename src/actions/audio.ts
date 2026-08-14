import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { clamp } from '../utils.js'
import { ObsAudioMonitorType } from '../types.js'
import {
	VOLUME_MIN_DB,
	VOLUME_MAX_DB,
	BALANCE_MIN,
	BALANCE_MAX,
	SYNC_OFFSET_MIN,
	SYNC_OFFSET_MAX,
} from '../constants.js'

export type AudioActionSchemas = {
	toggle_source_mute: { options: { source: string }; result: boolean | null }
	set_source_mute: { options: { source: string; mute: 'true' | 'false' } }
	set_volume: { options: { source: string; volume: number } }
	adjust_volume: { options: { source: string; volume: number } }
	adjust_volume_percent: { options: { source: string; volume: number } }
	fadeVolume: { options: { source: string; volume: number; duration: number } }
	set_audio_offset: { options: { source: string; offset: number } }
	adjust_audio_offset: { options: { source: string; amount: number } }
	set_audio_balance: { options: { source: string; balance: number } }
	adjust_audio_balance: { options: { source: string; amount: number } }
	set_audio_monitor: { options: { source: string; monitor: ObsAudioMonitorType } }
	set_audio_tracks: { options: { source: string; tracks: string[]; value: 'true' | 'false' | 'toggle' } }
}

export function getAudioActions(self: OBSInstance): CompanionActionDefinitions<AudioActionSchemas> {
	return {
		toggle_source_mute: {
			name: 'Audio - Toggle Source Mute',
			description: 'Toggles the mute state of a specific audio source',
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
			hasResult: true,
			callback: async (action) => {
				const res = await self.obs.sendRequest('ToggleInputMute', { inputName: action.options.source })
				return res?.inputMuted ?? null
			},
		},
		set_source_mute: {
			name: 'Audio - Set Mute',
			description: 'Sets the mute state of a specific audio source (deprecated, use audio actions instead)',
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
					inputName: action.options.source,
					inputMuted: action.options.mute === 'true',
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					mute: source.inputMuted ? 'true' : 'false',
				}
			},
		},
		set_volume: {
			name: 'Audio - Set Source Volume',
			description: 'Sets the volume of a specific audio source in decibels',
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
					type: 'number',
					label: 'Volume in dB (-100 to 26)',
					id: 'volume',
					default: 0,
					min: VOLUME_MIN_DB,
					max: VOLUME_MAX_DB,
					clampValues: true,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('SetInputVolume', {
					inputName: action.options.source,
					inputVolumeDb: action.options.volume,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					volume: source.inputVolume,
				}
			},
		},
		adjust_volume: {
			name: 'Audio - Adjust Source Volume',
			description: 'Increases or decreases the volume of a specific audio source by a set amount of decibels',
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
					type: 'number',
					label: 'Amount in dB',
					id: 'volume',
					default: 1,
					min: VOLUME_MIN_DB,
					max: VOLUME_MAX_DB,
					clampValues: true,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentVolume = self.obsState.findSourceByName(sourceName)?.inputVolume
				const newVolume = clamp(
					(currentVolume !== undefined ? currentVolume : 0) + action.options.volume,
					VOLUME_MIN_DB,
					VOLUME_MAX_DB,
				)

				await self.obs.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newVolume })
			},
		},
		adjust_volume_percent: {
			name: 'Audio - Adjust Source Volume (Percentage)',
			description: 'Increases or decreases the volume of a specific audio source by a percentage of its range',
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
					type: 'number',
					label: 'Amount in Percentage',
					id: 'volume',
					default: 5,
					min: -100,
					max: 100,
					clampValues: true,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentVolume = self.obsState.findSourceByName(sourceName)?.inputVolume ?? -100

				const LOG_OFFSET_DB = 0
				const currentPercentage = Math.pow(10, (currentVolume - LOG_OFFSET_DB) / 20) * 100
				let newPercentage = currentPercentage + action.options.volume

				newPercentage = clamp(newPercentage, 0, 100)

				let newDb = 20 * Math.log10(newPercentage / 100) + LOG_OFFSET_DB
				newDb = clamp(newDb, VOLUME_MIN_DB, VOLUME_MAX_DB)

				await self.obs.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newDb })
			},
		},
		fadeVolume: {
			name: 'Audio - Fade Source Volume',
			description: 'Fades the volume of a source to a target value over a specific duration',
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
					type: 'number',
					label: 'Target Volume in dB',
					id: 'volume',
					default: 0,
					min: VOLUME_MIN_DB,
					max: VOLUME_MAX_DB,
					clampValues: true,
				},
				{
					type: 'number',
					label: 'Fade Duration (in ms)',
					id: 'duration',
					default: 1000,
					min: 10,
					max: 5000,
					clampValues: true,
				},
			],
			callback: async (action) => {
				await self.obs.fadeSourceVolume(action.options.source, action.options.volume, action.options.duration)
			},
		},
		set_audio_offset: {
			name: 'Audio - Set Source Audio Offset',
			description: 'Sets the audio sync offset for a specific source in milliseconds',
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
					type: 'number',
					label: 'Offset in ms',
					id: 'offset',
					default: 0,
					min: SYNC_OFFSET_MIN,
					max: SYNC_OFFSET_MAX,
					clampValues: true,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('SetInputAudioSyncOffset', {
					inputName: action.options.source,
					inputAudioSyncOffset: action.options.offset,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					offset: source.inputAudioSyncOffset,
				}
			},
		},
		adjust_audio_offset: {
			name: 'Audio - Adjust Source Audio Offset',
			description: 'Increases or decreases the audio sync offset of a specific source by a set amount of milliseconds',
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
					type: 'number',
					label: 'Amount in ms',
					id: 'amount',
					default: 50,
					min: -20000,
					max: SYNC_OFFSET_MAX,
					clampValues: true,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentOffset = self.obsState.findSourceByName(sourceName)?.inputAudioSyncOffset
				const newOffset = clamp(
					(currentOffset !== undefined ? currentOffset : 0) + action.options.amount,
					SYNC_OFFSET_MIN,
					SYNC_OFFSET_MAX,
				)
				await self.obs.sendRequest('SetInputAudioSyncOffset', {
					inputName: sourceName,
					inputAudioSyncOffset: newOffset,
				})
			},
		},
		set_audio_balance: {
			name: 'Audio - Set Source Audio Balance',
			description: 'Sets the audio balance for a specific source (0.0 for Left, 0.5 for Center, 1.0 for Right)',
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
					type: 'number',
					label: 'Balance (0.0 to 1.0)',
					id: 'balance',
					default: 0.5,
					min: BALANCE_MIN,
					max: BALANCE_MAX,
					clampValues: true,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				await self.obs.sendRequest('SetInputAudioBalance', {
					inputName: sourceName,
					inputAudioBalance: action.options.balance,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					balance: source.inputAudioBalance,
				}
			},
		},
		adjust_audio_balance: {
			name: 'Audio - Adjust Source Audio Balance',
			description: 'Increases or decreases the audio balance of a specific source by a set percentage',
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
					type: 'number',
					label: 'Amount (percentage of range)',
					id: 'amount',
					default: 0.1,
					min: -1.0,
					max: BALANCE_MAX,
					clampValues: true,
				},
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentOffset = self.obsState.findSourceByName(sourceName)?.inputAudioBalance
				const newOffset = clamp(
					(currentOffset !== undefined ? currentOffset : 0.5) + action.options.amount,
					BALANCE_MIN,
					BALANCE_MAX,
				)
				await self.obs.sendRequest('SetInputAudioBalance', {
					inputName: sourceName,
					inputAudioBalance: newOffset,
				})
			},
		},

		set_audio_monitor: {
			name: 'Audio - Set Audio Monitor Type',
			description: 'Sets the audio monitoring type for a specific source',
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
			callback: async (action) => {
				const monitorType = action.options.monitor
				await self.obs.sendRequest('SetInputAudioMonitorType', {
					inputName: action.options.source,
					monitorType: monitorType,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					monitor: source.monitorType,
				}
			},
		},

		set_audio_tracks: {
			name: 'Audio - Set Audio Tracks',
			description: 'Sets or toggles the mixer output tracks of a specific audio source',
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
					type: 'multidropdown',
					label: 'Tracks',
					id: 'tracks',
					tooltip: 'Leave empty to affect all tracks',
					default: [],
					choices: [
						{ id: '1', label: 'Track 1' },
						{ id: '2', label: 'Track 2' },
						{ id: '3', label: 'Track 3' },
						{ id: '4', label: 'Track 4' },
						{ id: '5', label: 'Track 5' },
						{ id: '6', label: 'Track 6' },
					],
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Enabled',
					id: 'value',
					default: 'toggle',
					choices: [
						{ id: 'true', label: 'True' },
						{ id: 'false', label: 'False' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (action) => {
				const currentTracks = self.obsState.findSourceByName(action.options.source)?.inputAudioTracks
				if (!currentTracks) return

				const selected = action.options.tracks.length > 0 ? action.options.tracks : Object.keys(currentTracks)
				const inputAudioTracks: Record<string, boolean> = {}
				for (const track of selected) {
					if (!(track in currentTracks)) continue
					inputAudioTracks[track] =
						action.options.value === 'toggle' ? currentTracks[track] !== true : action.options.value === 'true'
				}
				if (Object.keys(inputAudioTracks).length === 0) return

				await self.obs.sendRequest('SetInputAudioTracks', {
					inputName: action.options.source,
					inputAudioTracks: inputAudioTracks,
				})
			},
		},
	}
}
