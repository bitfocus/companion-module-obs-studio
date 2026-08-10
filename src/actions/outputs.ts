import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'

export type OutputActionSchemas = {
	start_recording: { options: Record<string, never> }
	stop_recording: { options: Record<string, never> }
	pause_recording: { options: Record<string, never> }
	resume_recording: { options: Record<string, never> }
	ToggleRecordPause: { options: Record<string, never> }
	toggle_recording: { options: Record<string, never>; result: boolean | null }
	SplitRecordFile: { options: Record<string, never> }
	CreateRecordChapter: { options: { chapterName: string } }
	start_streaming: { options: Record<string, never> }
	stop_streaming: { options: Record<string, never> }
	StartStopStreaming: { options: Record<string, never>; result: boolean | null }
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
	SendStreamCaption: { options: { text: string } }
	start_replay_buffer: { options: Record<string, never> }
	stop_replay_buffer: { options: Record<string, never> }
	save_replay_buffer: { options: Record<string, never> }
	ToggleReplayBuffer: { options: Record<string, never>; result: boolean | null }
	start_output: { options: { output: string } }
	stop_output: { options: { output: string } }
	start_stop_output: { options: { output: string }; result: boolean | null }
}

export function getOutputActions(self: OBSInstance): CompanionActionDefinitions<OutputActionSchemas> {
	return {
		// Recording
		start_recording: {
			name: 'Recording - Start',
			description: 'Starts recording the current program output',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StartRecord')
			},
		},
		stop_recording: {
			name: 'Recording - Stop',
			description: 'Stops the current recording',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StopRecord')
			},
		},
		pause_recording: {
			name: 'Recording - Pause',
			description: 'Pauses the current recording (requires a recording format that supports pausing)',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('PauseRecord')
			},
		},
		resume_recording: {
			name: 'Recording - Resume',
			description: 'Resumes a paused recording',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('ResumeRecord')
			},
		},
		ToggleRecordPause: {
			name: 'Recording - Toggle Pause',
			description: 'Toggles between paused and recording states',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('ToggleRecordPause')
			},
		},
		toggle_recording: {
			name: 'Recording - Toggle',
			description: 'Toggles between recording and stopped states',
			options: [],
			hasResult: true,
			callback: async () => {
				const res = await self.obs.sendRequest('ToggleRecord')
				return res?.outputActive ?? null
			},
		},
		SplitRecordFile: {
			name: 'Recording - Split File',
			description:
				'Splits the current recording into a new file (requires Advanced output mode and file splitting enabled)',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('SplitRecordFile')
			},
		},
		CreateRecordChapter: {
			name: 'Recording - Create Chapter',
			description: 'Adds a chapter marker to the current recording (requires a format that supports chapters)',
			options: [
				{
					type: 'textinput',
					label: 'Chapter Name (Optional)',
					id: 'chapterName',
					default: '',
					useVariables: true,
				},
			],
			callback: async (action) => {
				const chapterName = action.options.chapterName
				await self.obs.sendRequest('CreateRecordChapter', { chapterName: chapterName })
			},
		},
		// Streaming
		start_streaming: {
			name: 'Stream - Start',
			description: 'Starts streaming to the currently configured service',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StartStream')
			},
		},
		stop_streaming: {
			name: 'Stream - Stop',
			description: 'Stops the current stream',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StopStream')
			},
		},
		StartStopStreaming: {
			name: 'Stream - Toggle',
			description: 'Toggles between streaming and off-air states',
			options: [],
			hasResult: true,
			callback: async () => {
				const res = await self.obs.sendRequest('ToggleStream')
				return res?.outputActive ?? null
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
					const captionText = action.options.text
					await self.obs.sendRequest('SendStreamCaption', { captionText: captionText })
				}
			},
		},
		// Replay Buffer
		start_replay_buffer: {
			name: 'Replay Buffer - Start',
			description: 'Starts the replay buffer output',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StartReplayBuffer')
			},
		},
		stop_replay_buffer: {
			name: 'Replay Buffer - Stop',
			description: 'Stops the replay buffer output',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('StopReplayBuffer')
			},
		},
		save_replay_buffer: {
			name: 'Replay Buffer - Save',
			description: 'Saves the current contents of the replay buffer to disk',
			options: [],
			callback: async () => {
				await self.obs.sendRequest('SaveReplayBuffer')
			},
		},
		ToggleReplayBuffer: {
			name: 'Replay Buffer - Toggle',
			description: 'Toggles the replay buffer output state',
			options: [],
			hasResult: true,
			callback: async () => {
				const res = await self.obs.sendRequest('ToggleReplayBuffer')
				return res?.outputActive ?? null
			},
		},
		// Outputs
		start_output: {
			name: 'Start Output',
			description: 'Starts a specific output (e.g., Virtual Cam, Decklink)',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.obsState.outputList,
				},
			],
			callback: async (action) => {
				if (action.options.output === 'virtualcam_output') {
					await self.obs.sendRequest('StartVirtualCam')
				} else {
					await self.obs.sendRequest('StartOutput', {
						outputName: action.options.output,
					})
				}
			},
		},
		stop_output: {
			name: 'Stop Output',
			description: 'Stops a specific output',
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.obsState.outputList,
				},
			],
			callback: async (action) => {
				if (action.options.output === 'virtualcam_output') {
					await self.obs.sendRequest('StopVirtualCam')
				} else {
					await self.obs.sendRequest('StopOutput', {
						outputName: action.options.output,
					})
				}
			},
		},
		start_stop_output: {
			name: 'Toggle Output',
			description: 'Toggles the state of a specific output',
			options: [
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
				if (action.options.output === 'virtualcam_output') {
					const res = await self.obs.sendRequest('ToggleVirtualCam')
					return res?.outputActive ?? null
				} else {
					const res = await self.obs.sendRequest('ToggleOutput', {
						outputName: action.options.output,
					})
					return res?.outputActive ?? null
				}
			},
		},
	}
}
