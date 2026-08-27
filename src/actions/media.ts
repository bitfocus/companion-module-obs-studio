import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { OBSMediaStatus, OBSMediaInputAction, MEDIA_CONTROL_ACTIONS, type MediaControlAction } from '../types.js'
import * as utils from '../utils.js'
import { choiceDropdown, modeDropdown, modeNumber } from './options.js'

const logger = createModuleLogger('Actions/Media')

/** Options shared by every media action: either the active media source, or a named one. */
type MediaTarget = {
	useCurrentMedia: boolean
	source: string
}

export type MediaActionSchemas = {
	media_control: {
		options: MediaTarget & { action: 'toggle' | MediaControlAction }
	}
	media_time: { options: MediaTarget & { mode: 'set' | 'adjust'; value: number; amount: number } }
	updateMediaLocalFile: { options: MediaTarget & { path: string } }
}

export function getMediaActions(self: OBSInstance): CompanionActionDefinitions<MediaActionSchemas> {
	return {
		media_control: {
			name: 'Media - Playback Controls',
			description: 'Controls the playback of a media source',
			options: [
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Currently Playing',
					id: 'useCurrentMedia',
					default: false,
				},
				choiceDropdown(self, 'mediaSource', {
					id: 'source',
					label: 'Media Source',
					isVisibleExpression: `!$(options:useCurrentMedia)`,
				}),
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Action',
					id: 'action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle Play/Pause' },
						{ id: 'play', label: 'Play' },
						{ id: 'pause', label: 'Pause' },
						{ id: 'restart', label: 'Restart' },
						{ id: 'stop', label: 'Stop' },
						{ id: 'next', label: 'Next' },
						{ id: 'previous', label: 'Previous' },
					],
				},
			],
			callback: async (action) => {
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source

				const mediaAction =
					action.options.action === 'toggle'
						? self.obsState.findSourceByName(mediaName)?.OBSMediaStatus === OBSMediaStatus.Playing
							? OBSMediaInputAction.Pause
							: OBSMediaInputAction.Play
						: MEDIA_CONTROL_ACTIONS[action.options.action]

				await self.obs.sendRequest('TriggerMediaInputAction', {
					inputName: mediaName,
					mediaAction: mediaAction,
				})
			},
		},

		media_time: {
			name: 'Media - Set / Scrub Playback Time',
			description: 'Sets the playback cursor of a media source to a specific time, or moves it by an offset',
			options: [
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Currently Playing',
					id: 'useCurrentMedia',
					default: false,
				},
				choiceDropdown(self, 'mediaSource', {
					id: 'source',
					label: 'Media Source',
					isVisibleExpression: `!$(options:useCurrentMedia)`,
				}),
				modeDropdown([
					{ id: 'set', label: 'Set Time' },
					{ id: 'adjust', label: 'Scrub' },
				]),
				modeNumber('set', { label: 'Time (in ms)', id: 'value', default: 0, min: 0, max: 100 * 60 * 60 * 1000 }),
				modeNumber('adjust', {
					label: 'Scrub Amount (in seconds, can be negative)',
					id: 'amount',
					default: 1,
					min: -3600,
					max: 3600,
				}),
			],
			callback: async (action) => {
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source

				if (action.options.mode === 'set') {
					await self.obs.sendRequest('SetMediaInputCursor', {
						inputName: mediaName,
						mediaCursor: action.options.value,
					})
				} else {
					await self.obs.sendRequest('OffsetMediaInputCursor', {
						inputName: mediaName,
						mediaCursorOffset: action.options.amount * 1000,
					})
				}
			},
			learn: (action) => {
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const source = self.obsState.findSourceByName(mediaName)
				if (!source || source.mediaCursor === undefined) return undefined
				return {
					mode: 'set',
					value: source.mediaCursor,
				}
			},
		},

		updateMediaLocalFile: {
			name: 'Media - Set Source File',
			description: 'Changes the file associated with a media source',
			options: [
				{
					type: 'checkbox',
					disableAutoExpression: true,
					label: 'Currently Playing',
					id: 'useCurrentMedia',
					default: false,
				},
				choiceDropdown(self, 'mediaSource', {
					id: 'source',
					label: 'Media Source',
					isVisibleExpression: `!$(options:useCurrentMedia)`,
				}),
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
				} catch (e) {
					logger.error(`Set Media Source File Error: ${utils.describeError(e)}`)
				}
			},
			learn: (action) => {
				const mediaName = action.options.useCurrentMedia ? self.states.currentMedia : action.options.source
				const input = self.obsState.findSourceByName(mediaName)
				const localFile = utils.asString(input?.settings?.local_file)
				if (localFile === undefined) return undefined
				return { path: localFile }
			},
		},
	}
}
