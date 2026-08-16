import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'

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
		recording: {
			name: 'Recording',
			description: 'Controls the recording output',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Action',
					id: 'action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
						{ id: 'pause', label: 'Pause' },
						{ id: 'resume', label: 'Resume' },
						{ id: 'toggle_pause', label: 'Toggle Pause' },
						{ id: 'split', label: 'Split File' },
						{ id: 'chapter', label: 'Create Chapter' },
					],
				},
				{
					type: 'textinput',
					label: 'Chapter Name (Optional)',
					id: 'chapterName',
					default: '',
					useVariables: true,
					isVisibleExpression: `$(options:action) === 'chapter'`,
				},
			],
			hasResult: true,
			callback: async (action) => {
				switch (action.options.action) {
					case 'toggle': {
						const res = await self.obs.sendRequest('ToggleRecord')
						return res?.outputActive ?? null
					}
					case 'start':
						await self.obs.sendRequest('StartRecord')
						return true
					case 'stop':
						await self.obs.sendRequest('StopRecord')
						return false
					case 'pause':
						await self.obs.sendRequest('PauseRecord')
						return null
					case 'resume':
						await self.obs.sendRequest('ResumeRecord')
						return null
					case 'toggle_pause':
						await self.obs.sendRequest('ToggleRecordPause')
						return null
					case 'split':
						await self.obs.sendRequest('SplitRecordFile')
						return null
					case 'chapter':
						await self.obs.sendRequest('CreateRecordChapter', { chapterName: action.options.chapterName })
						return null
					default:
						return null
				}
			},
		},
		// Streaming
		streaming: {
			name: 'Stream',
			description: 'Controls the streaming output',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Action',
					id: 'action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
					],
				},
			],
			hasResult: true,
			callback: async (action) => {
				switch (action.options.action) {
					case 'toggle': {
						const res = await self.obs.sendRequest('ToggleStream')
						return res?.outputActive ?? null
					}
					case 'start':
						await self.obs.sendRequest('StartStream')
						return true
					case 'stop':
						await self.obs.sendRequest('StopStream')
						return false
					default:
						return null
				}
			},
		},
		SendStreamCaption: {
			name: 'Stream - Send Caption',
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
			name: 'Stream - Set Settings',
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
		replay_buffer: {
			name: 'Replay Buffer',
			description: 'Controls the replay buffer output',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Action',
					id: 'action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
						{ id: 'save', label: 'Save' },
					],
				},
			],
			hasResult: true,
			callback: async (action) => {
				switch (action.options.action) {
					case 'toggle': {
						const res = await self.obs.sendRequest('ToggleReplayBuffer')
						return res?.outputActive ?? null
					}
					case 'start':
						await self.obs.sendRequest('StartReplayBuffer')
						return true
					case 'stop':
						await self.obs.sendRequest('StopReplayBuffer')
						return false
					case 'save':
						await self.obs.sendRequest('SaveReplayBuffer')
						return null
					default:
						return null
				}
			},
		},
		// Outputs
		output: {
			name: 'Output',
			description: 'Controls a specific output (e.g., Virtual Cam, Decklink)',
			options: [
				{
					type: 'dropdown',
					disableAutoExpression: true,
					label: 'Action',
					id: 'action',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'start', label: 'Start' },
						{ id: 'stop', label: 'Stop' },
					],
				},
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.obsState.outputList,
				},
			],
			hasResult: true,
			callback: async (action) => {
				const outputName = action.options.output
				const isVirtualCam = outputName === 'virtualcam_output'

				switch (action.options.action) {
					case 'toggle': {
						const res = isVirtualCam
							? await self.obs.sendRequest('ToggleVirtualCam')
							: await self.obs.sendRequest('ToggleOutput', { outputName })
						return res?.outputActive ?? null
					}
					case 'start':
						if (isVirtualCam) {
							await self.obs.sendRequest('StartVirtualCam')
						} else {
							await self.obs.sendRequest('StartOutput', { outputName })
						}
						return true
					case 'stop':
						if (isVirtualCam) {
							await self.obs.sendRequest('StopVirtualCam')
						} else {
							await self.obs.sendRequest('StopOutput', { outputName })
						}
						return false
					default:
						return null
				}
			},
		},
	}
}
