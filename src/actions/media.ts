import { CompanionActionDefinitions, CompanionInputFieldDropdown, createModuleLogger } from '@companion-module/base'
import type { OBSRequestTypes } from 'obs-websocket-js'
import type OBSInstance from '../main.js'
import { OBSMediaStatus, OBSMediaInputAction, MEDIA_CONTROL_ACTIONS, type MediaControlAction } from '../types.js'
import * as utils from '../utils.js'
import { choiceDropdown, modeDropdown, modeNumber } from './options.js'

const logger = createModuleLogger('Actions/Media')

/**
 * Which media source(s) an action acts on. "Current media" used to be a single hidden value — the last
 * clip that ever started — which disagreed with the `current_media_*` variables and went stale. The target
 * is now the user's explicit choice, resolved against live state.
 */
export type MediaTargetMode = 'source' | 'newest' | 'all'

/** Options shared by every media action: the target mode, plus the source name when targeting one. */
type MediaTarget = {
	target: MediaTargetMode
	source: string
}

/** The target dropdown. `updateMediaLocalFile` omits `all`, since one file path cannot suit every clip. */
function targetDropdown(includeAll: boolean): CompanionInputFieldDropdown<'target'> {
	return {
		type: 'dropdown',
		disableAutoExpression: true,
		label: 'Target',
		id: 'target',
		default: 'source',
		choices: [
			{ id: 'source', label: 'Specific Source' },
			{ id: 'newest', label: 'Newest Playing Clip' },
			...(includeAll ? [{ id: 'all', label: 'All Playing Clips' }] : []),
		],
	}
}

/** The source dropdown, shown only when the action targets one named source. */
function targetSourceDropdown(self: OBSInstance) {
	return choiceDropdown(self, 'mediaSource', {
		id: 'source',
		label: 'Media Source',
		isVisibleExpression: `$(options:target) == 'source'`,
	})
}

/**
 * Resolves a target to the media source names to act on.
 *
 * `newest` and `all` consider clips that are playing or paused and active on program — the same membership
 * the `current_media_*` variables report, so what a button displays and what it acts on always agree.
 * Returns an empty list when nothing qualifies, rather than falling back to an empty source name.
 */
export function resolveMediaTargets(self: OBSInstance, options: MediaTarget): string[] {
	if (options.target === 'source') return [options.source]

	const playing = Array.from(self.states.sources.values())
		.filter(
			(source) =>
				source.active &&
				(source.OBSMediaStatus === OBSMediaStatus.Playing || source.OBSMediaStatus === OBSMediaStatus.Paused),
		)
		.sort((a, b) => (a.mediaStartedAt ?? 0) - (b.mediaStartedAt ?? 0))

	if (options.target === 'all') return playing.map((source) => source.sourceName)

	const newest = playing[playing.length - 1]
	return newest ? [newest.sourceName] : []
}

/** Sends one request per target, batching when the target resolves to several clips. */
async function sendForEachTarget<T extends keyof OBSRequestTypes>(
	self: OBSInstance,
	names: string[],
	requestType: T,
	build: (inputName: string) => OBSRequestTypes[T],
): Promise<void> {
	if (names.length === 0) {
		logger.warn('No media source is currently playing, so the action was skipped')
		return
	}

	if (names.length === 1) {
		await self.obs.sendRequest(requestType, build(names[0]))
		return
	}

	await self.obs.sendBatch(names.map((inputName) => ({ requestType, requestData: build(inputName) })))
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
				targetDropdown(true),
				targetSourceDropdown(self),
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
				// Toggle is resolved per clip: with several rolling, some may be paused and some playing.
				await sendForEachTarget(
					self,
					resolveMediaTargets(self, action.options),
					'TriggerMediaInputAction',
					(inputName) => ({
						inputName,
						mediaAction:
							action.options.action === 'toggle'
								? self.obsState.findSourceByName(inputName)?.OBSMediaStatus === OBSMediaStatus.Playing
									? OBSMediaInputAction.Pause
									: OBSMediaInputAction.Play
								: MEDIA_CONTROL_ACTIONS[action.options.action],
					}),
				)
			},
		},

		media_time: {
			name: 'Media - Set / Scrub Playback Time',
			description: 'Sets the playback cursor of a media source to a specific time, or moves it by an offset',
			options: [
				targetDropdown(true),
				targetSourceDropdown(self),
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
				const names = resolveMediaTargets(self, action.options)
				if (action.options.mode === 'set') {
					await sendForEachTarget(self, names, 'SetMediaInputCursor', (inputName) => ({
						inputName,
						mediaCursor: action.options.value,
					}))
				} else {
					await sendForEachTarget(self, names, 'OffsetMediaInputCursor', (inputName) => ({
						inputName,
						mediaCursorOffset: action.options.amount * 1000,
					}))
				}
			},
			learn: (action) => {
				const [mediaName] = resolveMediaTargets(self, action.options)
				const source = mediaName ? self.obsState.findSourceByName(mediaName) : undefined
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
				targetDropdown(false),
				targetSourceDropdown(self),
				{
					type: 'textinput',
					label: 'File Path',
					id: 'path',
					default: '',
					useVariables: true,
				},
			],
			callback: async (action) => {
				const [mediaName] = resolveMediaTargets(self, action.options)
				if (!mediaName) {
					logger.warn('No media source is currently playing, so the action was skipped')
					return
				}
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
				const [mediaName] = resolveMediaTargets(self, action.options)
				const input = mediaName ? self.obsState.findSourceByName(mediaName) : undefined
				const localFile = utils.asString(input?.settings?.local_file)
				if (localFile === undefined) return undefined
				return { path: localFile }
			},
		},
	}
}
