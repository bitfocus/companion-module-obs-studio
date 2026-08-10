import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { OBSMediaStatus, OBSMediaInputAction } from '../types.js'

const logger = createModuleLogger('Actions/Media')

/** Options shared by every media action: either the active media source, or a named one. */
type MediaTarget = {
	useCurrentMedia: boolean
	source: string
}

export type MediaActionSchemas = {
	play_pause_media: { options: MediaTarget & { playPause: 'toggle' | 'play' | 'pause' } }
	restart_media: { options: MediaTarget }
	stop_media: { options: MediaTarget }
	next_media: { options: MediaTarget }
	previous_media: { options: MediaTarget }
	set_media_time: { options: MediaTarget & { mediaTime: number } }
	scrub_media: { options: MediaTarget & { scrubAmount: number } }
	updateMediaLocalFile: { options: MediaTarget & { path: string } }
}

export function getMediaActions(self: OBSInstance): CompanionActionDefinitions<MediaActionSchemas> {
	return {
		play_pause_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const playPause = action.options.playPause
				let mediaAction: OBSMediaInputAction
				if (playPause === 'toggle') {
					mediaAction =
						self.obsState.findSourceByName(mediaName)?.OBSMediaStatus === OBSMediaStatus.Playing
							? OBSMediaInputAction.Pause
							: OBSMediaInputAction.Play
				} else {
					mediaAction = playPause === 'pause' ? OBSMediaInputAction.Pause : OBSMediaInputAction.Play
				}
				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: mediaAction,
				})
			},
		},
		restart_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: OBSMediaInputAction.Restart,
				})
			},
		},
		stop_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: OBSMediaInputAction.Stop,
				})
			},
		},
		next_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: OBSMediaInputAction.Next,
				})
			},
		},
		previous_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: OBSMediaInputAction.Previous,
				})
			},
		},

		set_media_time: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const mediaTime = action.options.mediaTime
				await self.obs.sendRequest('SetMediaInputCursor', {
					inputName: mediaName,
					mediaCursor: mediaTime,
				})
			},
			learn: (action) => {
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const source = self.obsState.findSourceByName(mediaName)
				if (!source || source.mediaCursor === undefined) return undefined
				return {
					mediaTime: source.mediaCursor,
				}
			},
		},

		scrub_media: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const scrubAmount = action.options.scrubAmount
				await self.obs.sendRequest('OffsetMediaInputCursor', {
					inputName: mediaName,
					mediaCursorOffset: scrubAmount * 1000,
				})
			},
		},

		updateMediaLocalFile: {
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const mediaFilePath = action.options.path
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
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const input = self.obsState.findSourceByName(mediaName)
				if (!input) return undefined
				return {
					path: input.settings?.local_file,
				}
			},
		},
	}
}
