import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { OBSMediaStatus, OBSMediaInputAction } from '../types.js'

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
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
			{
				type: 'dropdown',
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
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			let playPause = action.options.playPause as string
			if (playPause === 'toggle') {
				playPause =
					self.states.sources.get(mediaUuid)?.OBSMediaStatus === OBSMediaStatus.Playing
						? OBSMediaInputAction.Pause
						: OBSMediaInputAction.Play
			} else {
				playPause = playPause === 'pause' ? OBSMediaInputAction.Pause : OBSMediaInputAction.Play
			}
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputUuid: mediaUuid,
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
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputUuid: mediaUuid,
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
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputUuid: mediaUuid,
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
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputUuid: mediaUuid,
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
				label: 'Media Source',
				id: 'source',
				default: self.obsState.mediaSourceListDefault,
				choices: self.obsState.mediaSourceList,
				isVisibleExpression: `!$(options:useCurrentMedia)`,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			await self.obs.sendRequest('TriggerMediaInputAction', {
				inputUuid: mediaUuid,
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
				range: false,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			const mediaTime = action.options.mediaTime as number
			await self.obs.sendRequest('SetMediaInputCursor', {
				inputUuid: mediaUuid,
				mediaCursor: mediaTime,
			})
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
				range: false,
			},
		],
		callback: async (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			const scrubAmount = action.options.scrubAmount as number
			await self.obs.sendRequest('OffsetMediaInputCursor', {
				inputUuid: mediaUuid,
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
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			const mediaFilePath = action.options.path as string
			try {
				const input = await self.obs.sendRequest('GetInputSettings', {
					inputUuid: mediaUuid,
				})
				if (input?.inputSettings?.local_file !== undefined) {
					await self.obs.sendRequest('SetInputSettings', {
						inputUuid: mediaUuid,
						inputSettings: {
							local_file: mediaFilePath,
						},
					})
				}
			} catch (e: any) {
				self.log('error', `Set Media Source File Error: ${e.message}`)
			}
		},
		learn: (action) => {
			const mediaUuid = action.options.useCurrentMedia ? self.states.currentMedia : (action.options.source as string)
			const input = self.obsState.state?.sources.get(mediaUuid)
			if (!input) return undefined
			return {
				...action.options,
				path: input.settings?.local_file,
			}
		},
	}

	return actions
}
