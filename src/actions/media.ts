import { opt } from '../utils.js'
import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { OBSMediaStatus, OBSMediaInputAction } from '../types.js'

const logger = createModuleLogger('Actions/Media')

export function getMediaActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['play_pause_media'] = {
		name: 'Media - Play / Pause',
		description: 'Plays, pauses, or toggles the playback state of a media source',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
			{
				type: 'dropdown',
				disableAutoExpression: true,
				label: 'Action',
				id: 'playPause',
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: 'Toggle Play/Pause' },
					{ id: 'play', label: 'Play' },
					{ id: 'pause', label: 'Pause' },
				],
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			let playPause = opt<string>(action, 'playPause')
			if (playPause === 'toggle') {
				playPause =
					self.obsState.findSourceByName(mediaName)?.OBSMediaStatus === OBSMediaStatus.Playing
						? OBSMediaInputAction.Pause
						: OBSMediaInputAction.Play
			} else {
				playPause = playPause === 'pause' ? OBSMediaInputAction.Pause : OBSMediaInputAction.Play
			}
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputName: mediaName,
				mediaAction: playPause,
			})
		},
	}
	actions['restart_media'] = {
		name: 'Media - Restart',
		description: 'Restarts playback of a media source from the beginning',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputName: mediaName,
				mediaAction: OBSMediaInputAction.Restart,
			})
		},
	}
	actions['stop_media'] = {
		name: 'Media - Stop',
		description: 'Stops playback of a media source',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputName: mediaName,
				mediaAction: OBSMediaInputAction.Stop,
			})
		},
	}
	actions['next_media'] = {
		name: 'Media - Next',
		description: 'Skips to the next item in a media source playlist (if supported)',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputName: mediaName,
				mediaAction: OBSMediaInputAction.Next,
			})
		},
	}
	actions['previous_media'] = {
		name: 'Media - Previous',
		description: 'Skips to the previous item in a media source playlist (if supported)',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputName: mediaName,
				mediaAction: OBSMediaInputAction.Previous,
			})
		},
	}

	actions['set_media_time'] = {
		name: 'Media - Set Time',
		description: 'Sets the playback cursor of a media source to a specific time',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
			{
				type: 'number',
				label: 'Time (in ms)',
				id: 'mediaTime',
				default: 0,
				min: 0,
				max: 100 * 60 * 60 * 1000,
				clampValues: true,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			const mediaTime = opt<number>(action, 'mediaTime')
			await self.obs.sendRequest('SetMediaInputCursor', {
				inputName: mediaName,
				mediaCursor: mediaTime,
			})
		},
		learn: (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			const source = self.obsState.findSourceByName(mediaName)
			if (!source || source.mediaCursor === undefined) return undefined
			return {
				mediaTime: source.mediaCursor,
			}
		},
	}

	actions['scrub_media'] = {
		name: 'Media - Scrub',
		description: 'Moves the playback cursor of a media source by a specific offset',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
			{
				type: 'number',
				label: 'Scrub Amount (in seconds, can be negative)',
				id: 'scrubAmount',
				default: 1,
				min: -3600,
				max: 3600,
				clampValues: true,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			const scrubAmount = opt<number>(action, 'scrubAmount')
			await self.obs.sendRequest('OffsetMediaInputCursor', {
				inputName: mediaName,
				mediaCursorOffset: scrubAmount * 1000,
			})
		},
	}

	actions['updateMediaLocalFile'] = {
		name: 'Media - Set Source File',
		description: 'Changes the file associated with a media source',
		options: [
			{
				type: 'checkbox',
				label: 'Currently Playing',
				id: 'useCurrentMedia',
				default: false,
			},
			{
				type: 'dropdown',
				allowCustom: true,
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
			{
				type: 'textinput',
				label: 'File Path',
				id: 'path',
				default: '',
				useVariables: true,
			},
		],
		callback: async (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			const mediaFilePath = opt<string>(action, 'path')
			try {
				const input = await self.obs.sendRequest('GetInputSettings', {
					inputName: mediaName,
				})
				if (input?.inputSettings?.local_file !== undefined) {
					await self.obs.sendRequest('SetInputSettings', {
						inputName: mediaName,
						inputSettings: {
							local_file: mediaFilePath,
						},
					})
				}
			} catch (e: any) {
				logger.error(`Set Media Source File Error: ${e.message}`)
			}
		},
		learn: (action) => {
			const mediaName = opt<any>(action, 'useCurrentMedia') ? self.states.currentMedia : opt<string>(action, 'source')
			const input = self.obsState.findSourceByName(mediaName)
			if (!input) return undefined
			return {
				path: input.settings?.local_file,
			}
		},
	}

	return actions
}
