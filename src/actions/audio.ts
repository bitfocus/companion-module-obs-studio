import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { clamp, dbToPercent, isMonitoringEnabled, percentToDb } from '../utils.js'
import { ObsAudioMonitorType } from '../types.js'
import { modeDropdown, modeNumber, resolveSetAdjust } from './options.js'
import {
	VOLUME_MIN_DB,
	VOLUME_MAX_DB,
	BALANCE_MIN,
	BALANCE_MAX,
	SYNC_OFFSET_MIN,
	SYNC_OFFSET_MAX,
} from '../constants.js'

export type AudioActionSchemas = {
	mute: { options: { source: string; mute: 'true' | 'false' | 'toggle' }; result: boolean | null }
	volume: {
		options: {
			source: string
			mode: 'set' | 'adjust'
			unit: 'db' | 'percent'
			value: number
			amount: number
			duration: number
		}
	}
	audio_offset: { options: { source: string; mode: 'set' | 'adjust'; value: number; amount: number } }
	audio_balance: { options: { source: string; mode: 'set' | 'adjust'; value: number; amount: number } }
	set_audio_monitor: { options: { source: string; monitor: 'true' | 'false' | 'toggle' } }
	set_audio_tracks: { options: { source: string; tracks: string[]; value: 'true' | 'false' | 'toggle' } }
}

export function getAudioActions(self: OBSInstance): CompanionActionDefinitions<AudioActionSchemas> {
	return {
		mute: {
			name: 'Audio - Mute',
			description: 'Mutes, unmutes, or toggles the mute state of a specific audio source',
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
					default: 'toggle',
					choices: [
						{ id: 'true', label: 'Mute' },
						{ id: 'false', label: 'Unmute' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			hasResult: true,
			callback: async (action) => {
				if (action.options.mute === 'toggle') {
					const res = await self.obs.sendRequest('ToggleInputMute', { inputName: action.options.source })
					return res?.inputMuted ?? null
				}

				const muted = action.options.mute === 'true'
				await self.obs.sendRequest('SetInputMute', { inputName: action.options.source, inputMuted: muted })
				return muted
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
		volume: {
			name: 'Audio - Source Volume',
			description: 'Sets, fades, or adjusts the volume of a specific audio source',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
				modeDropdown(),
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Unit',
					id: 'unit',
					default: 'db',
					choices: [
						{ id: 'db', label: 'Decibels' },
						{ id: 'percent', label: 'Percentage' },
					],
				},
				modeNumber('set', { label: 'Target Volume', id: 'value', default: 0, min: VOLUME_MIN_DB, max: 100 }),
				modeNumber('set', {
					label: 'Fade Duration (in ms, 0 for instant)',
					id: 'duration',
					default: 0,
					min: 0,
					max: 5000,
				}),
				modeNumber('adjust', { label: 'Adjustment Amount', id: 'amount', default: 1, min: -100, max: 100 }),
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const usePercent = action.options.unit === 'percent'
				const currentDb = self.obsState.findSourceByName(sourceName)?.inputVolume

				let newDb: number
				if (action.options.mode === 'set') {
					newDb = usePercent ? percentToDb(action.options.value) : action.options.value
				} else if (usePercent) {
					const currentPercent = dbToPercent(currentDb ?? VOLUME_MIN_DB)
					newDb = percentToDb(clamp(currentPercent + action.options.amount, 0, 100))
				} else {
					newDb = (currentDb ?? 0) + action.options.amount
				}
				newDb = clamp(newDb, VOLUME_MIN_DB, VOLUME_MAX_DB)

				if (action.options.mode === 'set' && action.options.duration > 0) {
					await self.obs.fadeSourceVolume(sourceName, newDb, action.options.duration)
				} else {
					await self.obs.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newDb })
				}
			},
			learn: (action) => {
				const source = self.obsState.findSourceByName(action.options.source)
				if (!source || source.inputVolume === undefined) return undefined
				return {
					mode: 'set',
					value: action.options.unit === 'percent' ? dbToPercent(source.inputVolume) : source.inputVolume,
				}
			},
		},
		audio_offset: {
			name: 'Audio - Source Audio Offset',
			description: 'Sets or adjusts the audio sync offset for a specific source in milliseconds',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
				modeDropdown(),
				modeNumber('set', {
					label: 'Offset in ms',
					id: 'value',
					default: 0,
					min: SYNC_OFFSET_MIN,
					max: SYNC_OFFSET_MAX,
				}),
				modeNumber('adjust', {
					label: 'Amount in ms',
					id: 'amount',
					default: 50,
					min: SYNC_OFFSET_MIN,
					max: SYNC_OFFSET_MAX,
				}),
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentOffset = self.obsState.findSourceByName(sourceName)?.inputAudioSyncOffset ?? 0
				const newOffset = resolveSetAdjust(action.options, currentOffset, SYNC_OFFSET_MIN, SYNC_OFFSET_MAX)

				await self.obs.sendRequest('SetInputAudioSyncOffset', {
					inputName: sourceName,
					inputAudioSyncOffset: newOffset,
				})
			},
			learn: (action) => {
				const source = self.obsState.findSourceByName(action.options.source)
				if (!source) return undefined
				return {
					mode: 'set',
					value: source.inputAudioSyncOffset,
				}
			},
		},
		audio_balance: {
			name: 'Audio - Source Audio Balance',
			description:
				'Sets or adjusts the audio balance for a specific source (0.0 for Left, 0.5 for Center, 1.0 for Right)',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.audioSourceListDefault,
					choices: self.obsState.audioSourceList,
				},
				modeDropdown(),
				modeNumber('set', {
					label: 'Balance (0.0 to 1.0)',
					id: 'value',
					default: 0.5,
					min: BALANCE_MIN,
					max: BALANCE_MAX,
				}),
				modeNumber('adjust', {
					label: 'Amount (percentage of range)',
					id: 'amount',
					default: 0.1,
					min: -1.0,
					max: BALANCE_MAX,
				}),
			],
			callback: async (action) => {
				const sourceName = action.options.source
				const currentBalance = self.obsState.findSourceByName(sourceName)?.inputAudioBalance ?? 0.5
				const newBalance = resolveSetAdjust(action.options, currentBalance, BALANCE_MIN, BALANCE_MAX)

				await self.obs.sendRequest('SetInputAudioBalance', {
					inputName: sourceName,
					inputAudioBalance: newBalance,
				})
			},
			learn: (action) => {
				const source = self.obsState.findSourceByName(action.options.source)
				if (!source) return undefined
				return {
					mode: 'set',
					value: source.inputAudioBalance,
				}
			},
		},

		set_audio_monitor: {
			name: 'Audio - Set Audio Monitoring',
			description: 'Enables, disables, or toggles audio monitoring for a specific source',
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
					label: 'Monitoring',
					id: 'monitor',
					default: 'toggle',
					choices: [
						{ id: 'true', label: 'Enabled' },
						{ id: 'false', label: 'Disabled' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			callback: async (action) => {
				const enabled =
					action.options.monitor === 'toggle'
						? !isMonitoringEnabled(self.obsState.findSourceByName(action.options.source)?.monitorType)
						: action.options.monitor === 'true'

				await self.obs.sendRequest('SetInputAudioMonitorType', {
					inputName: action.options.source,
					monitorType: enabled ? ObsAudioMonitorType.MonitorAndOutput : ObsAudioMonitorType.None,
				})
			},
			learn: (action) => {
				const sourceName = action.options.source
				const source = self.obsState.findSourceByName(sourceName)
				if (!source) return undefined
				return {
					monitor: isMonitoringEnabled(source.monitorType) ? 'true' : 'false',
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
