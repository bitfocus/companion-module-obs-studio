import { opt } from '../utils.js'
import { CompanionActionDefinitions, createModuleLogger } from '@companion-module/base'
import type OBSInstance from '../main.js'

const logger = createModuleLogger('Actions/Custom')

export function getUiConfigCustomActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	//Studio Mode
	actions['enable_studio_mode'] = {
		name: 'Studio Mode - Enable',
		description: 'Enables Studio Mode, which allows for previewing changes before they go live',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: true })
		},
	}
	actions['disable_studio_mode'] = {
		name: 'Studio Mode - Disable',
		description: 'Disables Studio Mode, making all changes go directly to program',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: false })
		},
	}
	actions['toggle_studio_mode'] = {
		name: 'Studio Mode - Toggle',
		description: 'Toggles Studio Mode between on and off',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SetStudioModeEnabled', { studioModeEnabled: self.states.studioMode ? false : true })
		},
	}

	//Profile + Scene Collection
	actions['set_profile'] = {
		name: 'Set Profile',
		description: 'Switches the current OBS profile',
		options: [
			{
				type: 'dropdown',
				label: 'Profile',
				id: 'profile',
				default: self.obsState.profileChoicesDefault,
				choices: self.obsState.profileChoices,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetCurrentProfile', { profileName: opt<string>(action, 'profile') })
		},
	}
	actions['set_scene_collection'] = {
		name: 'Set Scene Collection',
		description: 'Switches the current OBS scene collection',
		options: [
			{
				type: 'dropdown',
				label: 'Scene Collection',
				id: 'scene_collection',
				default: self.obsState.sceneCollectionList?.[0] ? self.obsState.sceneCollectionList[0].id : '',
				choices: self.obsState.sceneCollectionList,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('SetCurrentSceneCollection', {
				sceneCollectionName: opt<string>(action, 'scene_collection'),
			})
		},
	}

	//Hotkeys
	actions['trigger-hotkey'] = {
		name: 'Hotkey - Trigger by ID',
		description: 'Triggers a hotkey by its internal name in OBS',
		options: [
			{
				type: 'dropdown',
				label: 'Hotkey ID',
				id: 'id',
				default: self.states.hotkeyNames?.[0] ? self.states.hotkeyNames[0].id : '',
				choices: self.states.hotkeyNames,
			},
		],
		callback: async (action) => {
			const hotkey = opt<string>(action, 'id')
			await self.obs.sendRequest('TriggerHotkeyByName', { hotkeyName: hotkey })
		},
	}
	actions['trigger-hotkey-sequence'] = {
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
				shift: opt<boolean>(action, 'keyShift'),
				alt: opt<boolean>(action, 'keyAlt'),
				control: opt<boolean>(action, 'keyControl'),
				command: opt<boolean>(action, 'keyCommand'),
			}

			await self.obs.sendRequest('TriggerHotkeyByKeySequence', {
				keyId: opt<string>(action, 'keyId'),
				keyModifiers: keyModifiers,
			})
		},
	}

	//Custom + Vendor Commands
	actions['custom_command'] = {
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
		callback: async (action) => {
			const command = opt<string>(action, 'command').replace(/ /g, '')
			let arg: any = ''

			if (opt<any>(action, 'arg')) {
				arg = opt<string>(action, 'arg')
				try {
					arg = JSON.parse(arg)
				} catch (e: any) {
					logger.warn(`Request data must be formatted as valid JSON. ${e.message}`)
					return
				}
			}

			try {
				const res = await self.obs.sendRequest(command as any, arg ? arg : {})
				logger.debug(`Custom Command Response: ${JSON.stringify(res)}`)
			} catch (e: any) {
				logger.warn(`Custom Command Error: ${e.message}`)
			}
		},
	}

	actions['vendorRequest'] = {
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
			const vendorName = opt<string>(action, 'vendorName').replace(/ /g, '')
			const requestType = opt<string>(action, 'requestType').replace(/ /g, '')
			let requestData: any = ''

			if (opt<any>(action, 'requestData')) {
				requestData = opt<string>(action, 'requestData')
				try {
					requestData = JSON.parse(requestData)
				} catch (e: any) {
					logger.warn(`Request data must be formatted as valid JSON. ${e.message}`)
					return
				}
			}
			const data = {
				vendorName: vendorName,
				requestType: requestType,
				requestData: requestData,
			}
			await self.obs.sendRequest('CallVendorRequest', data)
		},
	}

	//Open Windows
	actions['openInputPropertiesDialog'] = {
		name: 'Open Window - Source Properties',
		description: 'Opens the properties dialog for a source within the OBS UI',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('OpenInputPropertiesDialog', { inputUuid: opt<string>(action, 'source') })
		},
	}
	actions['openInputFiltersDialog'] = {
		name: 'Open Window - Source Filters',
		description: 'Opens the filters dialog for a source within the OBS UI',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('OpenInputFiltersDialog', { inputUuid: opt<string>(action, 'source') })
		},
	}
	actions['openInputInteractDialog'] = {
		name: 'Open Window - Source Interact',
		description: 'Opens the interact dialog for a source (e.g., browser source) within the OBS UI',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
			},
		],
		callback: async (action) => {
			await self.obs.sendRequest('OpenInputInteractDialog', { inputUuid: opt<string>(action, 'source') })
		},
	}

	actions['open_projector'] = {
		name: 'Open Projector',
		options: [
			{
				type: 'dropdown',
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
				label: 'Display',
				id: 'display',
				default: 0,
				choices: self.states.monitors,
				isVisibleExpression: `$(options:window) === 'fullscreen'`,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.obsState.sourceListDefault,
				choices: self.obsState.sourceChoices,
				isVisibleExpression: `$(options:type) === 'Source'`,
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.obsState.sceneListDefault,
				choices: self.obsState.sceneChoices,
				isVisibleExpression: `$(options:type) === 'Scene'`,
			},
		],
		callback: async (action) => {
			const monitor = opt<any>(action, 'window') === 'window' ? -1 : opt<number>(action, 'display')
			let requestType
			let requestData
			if (opt<any>(action, 'type') === 'Multiview') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_MULTIVIEW',
					monitorIndex: monitor,
				}
			} else if (opt<any>(action, 'type') === 'Preview') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW',
					monitorIndex: monitor,
				}
			} else if (opt<any>(action, 'type') === 'StudioProgram') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM',
					monitorIndex: monitor,
				}
			} else if (opt<any>(action, 'type') === 'Source') {
				requestType = 'OpenSourceProjector'
				requestData = {
					sourceUuid: opt<any>(action, 'source'),
					monitorIndex: monitor,
				}
			} else if (opt<any>(action, 'type') === 'Scene') {
				requestType = 'OpenSourceProjector'
				requestData = {
					sourceUuid: opt<any>(action, 'scene'),
					monitorIndex: monitor,
				}
			} else {
				return
			}
			await self.obs.sendRequest(requestType as any, requestData as any)
		},
	}

	return actions
}
