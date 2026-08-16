import { CompanionActionDefinitions, createModuleLogger, type JsonObject, type JsonValue } from '@companion-module/base'
import type { OBSRequestTypes } from 'obs-websocket-js'
import type OBSInstance from '../main.js'
import * as utils from '../utils.js'

const logger = createModuleLogger('Actions/Custom')

/** OBS treats -1 as "open in a floating window" rather than on a numbered display. */
const PROJECTOR_WINDOW_MONITOR_INDEX = -1

/**
 * Projector types backed by `OpenVideoMixProjector`. The remaining types ('Source', 'Scene') open a
 * source projector instead and are handled separately, since they take a source name rather than a
 * mix type.
 */
const VIDEO_MIX_TYPE_BY_PROJECTOR_TYPE: Record<string, string | undefined> = {
	Multiview: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_MULTIVIEW',
	Preview: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW',
	StudioProgram: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM',
}

/**
 * Parse a user-supplied JSON option, warning and returning `undefined` when it is malformed.
 *
 * Callers treat `undefined` as "abort the action" — distinct from a valid but empty object.
 */
function parseJsonOption(rawValue: string, label: string): JsonObject | undefined {
	try {
		return JSON.parse(rawValue) as JsonObject
	} catch (e) {
		logger.warn(`${label} must be formatted as valid JSON. ${utils.describeError(e)}`)
		return undefined
	}
}

export type UiConfigCustomActionSchemas = {
	studio_mode: { options: { enabled: 'true' | 'false' | 'toggle' }; result: boolean }
	set_profile: { options: { profile: string } }
	set_scene_collection: { options: { scene_collection: string } }
	'trigger-hotkey': { options: { id: string } }
	'trigger-hotkey-sequence': {
		options: { keyId: string; keyShift: boolean; keyAlt: boolean; keyControl: boolean; keyCommand: boolean }
	}
	custom_command: { options: { command: string; arg: string }; result: JsonValue }
	vendorRequest: { options: { vendorName: string; requestType: string; requestData: string }; result: JsonValue }
	openInputPropertiesDialog: { options: { source: string } }
	openInputFiltersDialog: { options: { source: string } }
	openInputInteractDialog: { options: { source: string } }
	open_projector: {
		options: {
			type: 'Multiview' | 'Preview' | 'StudioProgram' | 'Source' | 'Scene'
			window: 'window' | 'fullscreen'
			display: string | number
			source: string
			scene: string
		}
	}
}

export function getUiConfigCustomActions(self: OBSInstance): CompanionActionDefinitions<UiConfigCustomActionSchemas> {
	return {
		// Studio Mode
		studio_mode: {
			name: 'Studio Mode',
			description: 'Enables or disables Studio Mode, which allows for previewing changes before they go live',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Studio Mode',
					id: 'enabled',
					default: 'toggle',
					choices: [
						{ id: 'true', label: 'Enabled' },
						{ id: 'false', label: 'Disabled' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
			hasResult: true,
			callback: async (action) => {
				const enabled =
					action.options.enabled === 'toggle' ? !self.states.studioMode : action.options.enabled === 'true'
				await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: enabled })
				return enabled
			},
		},

		// Profile + Scene Collection
		set_profile: {
			name: 'Set Profile',
			description: 'Switches the current OBS profile',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Profile',
					id: 'profile',
					default: self.obsState.profileChoicesDefault,
					choices: self.obsState.profileChoices,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('SetCurrentProfile', { profileName: action.options.profile })
			},
		},
		set_scene_collection: {
			name: 'Set Scene Collection',
			description: 'Switches the current OBS scene collection',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Scene Collection',
					id: 'scene_collection',
					default: self.obsState.sceneCollectionList?.[0] ? self.obsState.sceneCollectionList[0].id : '',
					choices: self.obsState.sceneCollectionList,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('SetCurrentSceneCollection', {
					sceneCollectionName: action.options.scene_collection,
				})
			},
		},

		// Hotkeys
		'trigger-hotkey': {
			name: 'Hotkey - Trigger by ID',
			description: 'Triggers a hotkey by its internal name in OBS',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Hotkey ID',
					id: 'id',
					default: self.states.hotkeyNames?.[0] ? self.states.hotkeyNames[0].id : '',
					choices: self.states.hotkeyNames,
				},
			],
			callback: async (action) => {
				const hotkey = action.options.id
				await self.obs.sendRequest('TriggerHotkeyByName', { hotkeyName: hotkey })
			},
		},
		'trigger-hotkey-sequence': {
			name: 'Hotkey - Trigger by Key Sequence',
			description: 'Triggers a hotkey by specifying the key and optional modifiers',
			options: [
				{
					type: 'textinput',
					label: 'Key ID (e.g. OBS_KEY_A)',
					id: 'keyId',
					default: 'OBS_KEY_NONE',
					useVariables: true,
				},
				{
					type: 'checkbox',
					label: 'Shift',
					id: 'keyShift',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Alt',
					id: 'keyAlt',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Control',
					id: 'keyControl',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Command',
					id: 'keyCommand',
					default: false,
					description: '(macOS only)',
				},
			],
			callback: async (action) => {
				const keyModifiers = {
					shift: action.options.keyShift,
					alt: action.options.keyAlt,
					control: action.options.keyControl,
					command: action.options.keyCommand,
				}

				await self.obs.sendRequest('TriggerHotkeyByKeySequence', {
					keyId: action.options.keyId,
					keyModifiers: keyModifiers,
				})
			},
		},

		// Custom + Vendor Commands
		custom_command: {
			name: 'Custom Command',
			description: 'Sends a custom raw request to OBS WebSocket',
			options: [
				{
					type: 'textinput',
					useVariables: true,
					label: 'Request Type',
					id: 'command',
					default: 'SetCurrentProgramScene',
				},
				{
					type: 'textinput',
					useVariables: true,
					label: 'Request Data (optional, JSON formatted)',
					id: 'arg',
					default: '{"sceneName": "Scene 1"}',
				},
			],
			hasResult: true,
			callback: async (action) => {
				const command = action.options.command.replace(/ /g, '')

				let requestData: JsonObject = {}
				if (action.options.arg) {
					const parsed = parseJsonOption(action.options.arg, 'Request data')
					if (parsed === undefined) return null
					requestData = parsed
				}

				// The request type is free text entered by the user, so it can't be checked statically.
				const res = await self.obs.sendCustomRequest(command as keyof OBSRequestTypes, requestData)
				return res ?? null
			},
		},

		vendorRequest: {
			name: 'Custom Vendor Request',
			description: 'Sends a request to a specific OBS vendor plugin',
			options: [
				{
					type: 'textinput',
					useVariables: true,
					label: 'vendorName',
					id: 'vendorName',
					default: '',
				},
				{
					type: 'textinput',
					useVariables: true,
					label: 'requestType',
					id: 'requestType',
					default: '',
				},
				{
					type: 'textinput',
					useVariables: true,
					label: 'requestData',
					id: 'requestData',
					default: '',
				},
			],
			callback: async (action) => {
				const vendorName = action.options.vendorName.replace(/ /g, '')
				const requestType = action.options.requestType.replace(/ /g, '')

				let requestData: JsonObject = {}
				if (action.options.requestData) {
					const parsed = parseJsonOption(action.options.requestData, 'Request data')
					if (parsed === undefined) return null
					requestData = parsed
				}

				const res = await self.obs.sendRequest('CallVendorRequest', { vendorName, requestType, requestData })
				return res?.responseData ?? null
			},
			hasResult: true,
		},

		// Open Windows
		openInputPropertiesDialog: {
			name: 'Open Window - Source Properties',
			description: 'Opens the properties dialog for a source within the OBS UI',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('OpenInputPropertiesDialog', { inputName: action.options.source })
			},
		},
		openInputFiltersDialog: {
			name: 'Open Window - Source Filters',
			description: 'Opens the filters dialog for a source within the OBS UI',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('OpenInputFiltersDialog', { inputName: action.options.source })
			},
		},
		openInputInteractDialog: {
			name: 'Open Window - Source Interact',
			description: 'Opens the interact dialog for a source (e.g., browser source) within the OBS UI',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
				},
			],
			callback: async (action) => {
				await self.obs.sendRequest('OpenInputInteractDialog', { inputName: action.options.source })
			},
		},

		open_projector: {
			name: 'Open Projector',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Projector Type',
					id: 'type',
					default: 'Multiview',
					choices: [
						{ id: 'Multiview', label: 'Multiview' },
						{ id: 'Preview', label: 'Preview' },
						{ id: 'StudioProgram', label: 'Program' },
						{ id: 'Source', label: 'Source' },
						{ id: 'Scene', label: 'Scene' },
					],
				},
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Window Type',
					id: 'window',
					default: 'window',
					choices: [
						{ id: 'window', label: 'Window' },
						{ id: 'fullscreen', label: 'Fullscreen' },
					],
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Display',
					id: 'display',
					default: 0,
					choices: self.states.monitors,
					isVisibleExpression: `$(options:window) === 'fullscreen'`,
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Source',
					id: 'source',
					default: self.obsState.sourceListDefault,
					choices: self.obsState.sourceChoices,
					isVisibleExpression: `$(options:type) === 'Source'`,
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Scene',
					id: 'scene',
					default: self.obsState.sceneListDefault,
					choices: self.obsState.sceneChoices,
					isVisibleExpression: `$(options:type) === 'Scene'`,
				},
			],
			callback: async (action) => {
				// The display dropdown allows custom values, so it can arrive as a string.
				const selectedDisplay = utils.asNumber(action.options.display) ?? Number(action.options.display)
				const monitorIndex =
					action.options.window === 'window' || !Number.isFinite(selectedDisplay)
						? PROJECTOR_WINDOW_MONITOR_INDEX
						: selectedDisplay

				const videoMixType = VIDEO_MIX_TYPE_BY_PROJECTOR_TYPE[action.options.type]
				if (videoMixType) {
					await self.obs.sendRequest('OpenVideoMixProjector', { videoMixType, monitorIndex })
					return
				}

				const sourceName =
					action.options.type === 'Source'
						? action.options.source
						: action.options.type === 'Scene'
							? action.options.scene
							: undefined
				if (sourceName === undefined) return

				await self.obs.sendRequest('OpenSourceProjector', { sourceName, monitorIndex })
			},
		},
	}
}
