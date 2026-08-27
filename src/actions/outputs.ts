import {
	type CompanionActionDefinition,
	type CompanionActionDefinitions,
	type DropdownChoice,
	type SomeCompanionActionInputField,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import { VIRTUALCAM_OUTPUT_NAME } from '../constants.js'
import { choiceDropdown } from './options.js'

function isVirtualCam(outputName: string): boolean {
	return outputName === VIRTUALCAM_OUTPUT_NAME
}

/**
 * Every output family (recording, streaming, replay buffer, individual outputs) is one action with
 * a leading dropdown, and they all share the same toggle/start/stop shape and result convention:
 * toggle reports the state OBS came back with, start/stop report the state they asked for, and
 * anything else reports nothing.
 */
function outputControlAction<TOptions extends { action: string }>(config: {
	name: string
	description: string
	toggle: (options: TOptions) => Promise<{ outputActive?: boolean } | undefined>
	start: (options: TOptions) => Promise<unknown>
	stop: (options: TOptions) => Promise<unknown>
	/** Choices beyond toggle/start/stop, along with any option fields they need. */
	extraChoices?: DropdownChoice[]
	extraOptions?: SomeCompanionActionInputField<Extract<keyof TOptions, string>>[]
	/** Runs for the extra choices; toggle/start/stop never reach it. */
	handleExtra?: (options: TOptions) => Promise<unknown>
}): CompanionActionDefinition<{ options: TOptions; result: boolean | null }> {
	return {
		name: config.name,
		description: config.description,
		options: [
			{
				type: 'dropdown',
				disableAutoExpression: true,
				label: 'Action',
				id: 'action' as Extract<keyof TOptions, string>,
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: 'Toggle' },
					{ id: 'start', label: 'Start' },
					{ id: 'stop', label: 'Stop' },
					...(config.extraChoices ?? []),
				],
			},
			...(config.extraOptions ?? []),
		],
		hasResult: true,
		callback: async (action) => {
			switch (action.options.action) {
				case 'toggle': {
					const res = await config.toggle(action.options)
					return res?.outputActive ?? null
				}
				case 'start':
					await config.start(action.options)
					return true
				case 'stop':
					await config.stop(action.options)
					return false
				default:
					await config.handleExtra?.(action.options)
					return null
			}
		},
	}
}

export type OutputActionSchemas = {
	recording: {
		options: {
			action: 'toggle' | 'start' | 'stop' | 'pause' | 'resume' | 'toggle_pause' | 'split' | 'chapter'
			chapterName: string
		}
		result: boolean | null
	}
	streaming: {
		options: { action: 'toggle' | 'start' | 'stop' }
		result: boolean | null
	}
	SendStreamCaption: { options: { text: string } }
	replay_buffer: {
		options: { action: 'toggle' | 'start' | 'stop' | 'save' }
		result: boolean | null
	}
	output: {
		options: { action: 'toggle' | 'start' | 'stop'; output: string }
		result: boolean | null
	}
	set_stream_settings: {
		options: {
			streamType: 'rtmp_custom' | 'rtmp_common' | 'whip_custom'
			streamURL: string
			streamKey: string
			useAuth: boolean
			username: string
			password: string
			bearerToken: string
		}
	}
}

export function getOutputActions(self: OBSInstance): CompanionActionDefinitions<OutputActionSchemas> {
	return {
		// Recording
		recording: outputControlAction({
			name: 'Recording - Controls',
			description: 'Controls the recording output',
			toggle: async () => self.obs.sendRequest('ToggleRecord'),
			start: async () => self.obs.sendRequest('StartRecord'),
			stop: async () => self.obs.sendRequest('StopRecord'),
			extraChoices: [
				{ id: 'pause', label: 'Pause' },
				{ id: 'resume', label: 'Resume' },
				{ id: 'toggle_pause', label: 'Toggle Pause' },
				{ id: 'split', label: 'Split File' },
				{ id: 'chapter', label: 'Create Chapter' },
			],
			extraOptions: [
				{
					type: 'textinput',
					label: 'Chapter Name (Optional)',
					id: 'chapterName',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:action) === 'chapter'`,
				},
			],
			handleExtra: async (options) => {
				switch (options.action) {
					case 'pause':
						return self.obs.sendRequest('PauseRecord')
					case 'resume':
						return self.obs.sendRequest('ResumeRecord')
					case 'toggle_pause':
						return self.obs.sendRequest('ToggleRecordPause')
					case 'split':
						return self.obs.sendRequest('SplitRecordFile')
					case 'chapter':
						return self.obs.sendRequest('CreateRecordChapter', { chapterName: options.chapterName })
				}
			},
		}),
		// Streaming
		streaming: outputControlAction({
			name: 'Streaming - Controls',
			description: 'Controls the streaming output',
			toggle: async () => self.obs.sendRequest('ToggleStream'),
			start: async () => self.obs.sendRequest('StartStream'),
			stop: async () => self.obs.sendRequest('StopStream'),
		}),
		SendStreamCaption: {
			name: 'Streaming - Send Caption',
			options: [
				{
					type: 'textinput',
					label: 'Caption Text',
					id: 'text',
					default: '',
					useVariables: true,
				},
			],
			callback: async (action) => {
				if (self.states.streaming) {
					await self.obs.sendRequest('SendStreamCaption', { captionText: action.options.text })
				}
			},
		},
		set_stream_settings: {
			name: 'Streaming - Set Stream Settings',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Stream Type',
					id: 'streamType',
					default: 'rtmp_custom',
					choices: [
						{ id: 'rtmp_custom', label: 'Custom RTMP' },
						{ id: 'rtmp_common', label: 'Common RTMP' },
						{ id: 'whip_custom', label: 'Custom WHIP' },
					],
				},
				{
					type: 'textinput',
					label: 'Stream URL',
					id: 'streamURL',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:streamType) !== 'rtmp_common'`,
				},
				{
					type: 'textinput',
					label: 'Stream Key',
					id: 'streamKey',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:streamType) !== 'whip_custom'`,
				},
				{
					type: 'checkbox',
					label: 'Use Authentication',
					id: 'useAuth',
					default: false,
					isVisibleExpression: `$(options:streamType) === 'rtmp_custom'`,
				},
				{
					type: 'textinput',
					label: 'Username',
					id: 'username',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:streamType) === 'rtmp_custom' && $(options:useAuth) === true`,
				},
				{
					type: 'textinput',
					label: 'Password',
					id: 'password',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:streamType) === 'rtmp_custom' && $(options:useAuth) === true`,
				},
				{
					type: 'textinput',
					label: 'Bearer Token',
					id: 'bearerToken',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:streamType) === 'whip_custom'`,
				},
			],
			callback: async (action) => {
				const streamType = action.options.streamType
				const streamServiceSettings: Record<string, unknown> = {}

				if (streamType === 'rtmp_custom') {
					streamServiceSettings.server = action.options.streamURL
					streamServiceSettings.key = action.options.streamKey
					streamServiceSettings.use_auth = action.options.useAuth
					if (streamServiceSettings.use_auth) {
						streamServiceSettings.username = action.options.username
						streamServiceSettings.password = action.options.password
					}
				} else if (streamType === 'rtmp_common') {
					streamServiceSettings.key = action.options.streamKey
				} else if (streamType === 'whip_custom') {
					streamServiceSettings.server = action.options.streamURL
					streamServiceSettings.service = 'WHIP'
					streamServiceSettings.bearer_token = action.options.bearerToken
				}

				await self.obs.sendRequest('SetStreamServiceSettings', {
					streamServiceType: streamType,
					streamServiceSettings: streamServiceSettings as Record<string, string>,
				})
				void self.obs.getStreamStatus()
				void self.obs.getStreamServiceSettings()
			},
		},
		// Replay Buffer
		replay_buffer: outputControlAction({
			name: 'Replay Buffer - Controls',
			description: 'Controls the replay buffer output',
			toggle: async () => self.obs.sendRequest('ToggleReplayBuffer'),
			start: async () => self.obs.sendRequest('StartReplayBuffer'),
			stop: async () => self.obs.sendRequest('StopReplayBuffer'),
			extraChoices: [{ id: 'save', label: 'Save' }],
			handleExtra: async () => self.obs.sendRequest('SaveReplayBuffer'),
		}),
		// Outputs
		output: outputControlAction({
			name: 'Output - Controls',
			description: 'Controls a specific output (e.g., Virtual Cam, Decklink)',
			// The virtual camera has its own requests and takes no output name.
			toggle: async ({ output }) =>
				isVirtualCam(output)
					? self.obs.sendRequest('ToggleVirtualCam')
					: self.obs.sendRequest('ToggleOutput', { outputName: output }),
			start: async ({ output }) =>
				isVirtualCam(output)
					? self.obs.sendRequest('StartVirtualCam')
					: self.obs.sendRequest('StartOutput', { outputName: output }),
			stop: async ({ output }) =>
				isVirtualCam(output)
					? self.obs.sendRequest('StopVirtualCam')
					: self.obs.sendRequest('StopOutput', { outputName: output }),
			extraOptions: [choiceDropdown(self, 'output', { id: 'output', label: 'Output' })],
		}),
	}
}
