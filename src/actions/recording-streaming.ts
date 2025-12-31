import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'

export function getRecordingStreamingActions(self: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	//Recording
	actions['start_recording'] = {
		name: 'Recording - Start',
		description: 'Starts recording the current program output',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StartRecord')
		},
	}
	actions['stop_recording'] = {
		name: 'Recording - Stop',
		description: 'Stops the current recording',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StopRecord')
		},
	}
	actions['pause_recording'] = {
		name: 'Recording - Pause',
		description: 'Pauses the current recording (requires a recording format that supports pausing)',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('PauseRecord')
		},
	}
	actions['resume_recording'] = {
		name: 'Recording - Resume',
		description: 'Resumes a paused recording',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('ResumeRecord')
		},
	}
	actions['ToggleRecordPause'] = {
		name: 'Recording - Toggle Pause',
		description: 'Toggles between paused and recording states',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('ToggleRecordPause')
		},
	}
	actions['toggle_recording'] = {
		name: 'Recording - Toggle',
		description: 'Toggles between recording and stopped states',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('ToggleRecord')
		},
	}
	actions['SplitRecordFile'] = {
		name: 'Recording - Split File',
		description:
			'Splits the current recording into a new file (requires Advanced output mode and file splitting enabled)',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SplitRecordFile')
		},
	}
	actions['CreateRecordChapter'] = {
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
			const chapterName = action.options.chapterName as string
			await self.obs.sendRequest('CreateRecordChapter', { chapterName: chapterName })
		},
	}
	//Streaming
	actions['start_streaming'] = {
		name: 'Stream - Start',
		description: 'Starts streaming to the currently configured service',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StartStream')
		},
	}
	actions['stop_streaming'] = {
		name: 'Stream - Stop',
		description: 'Stops the current stream',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StopStream')
		},
	}
	actions['StartStopStreaming'] = {
		name: 'Stream - Toggle',
		description: 'Toggles between streaming and off-air states',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('ToggleStream')
		},
	}
	actions['set_stream_settings'] = {
		name: 'Stream - Set Settings',
		options: [
			{
				type: 'dropdown',
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
			const streamType = action.options.streamType as string
			const streamServiceSettings: any = {}

			if (streamType === 'rtmp_custom') {
				streamServiceSettings.server = action.options.streamURL as string
				streamServiceSettings.key = action.options.streamKey as string
				streamServiceSettings.use_auth = action.options.useAuth as boolean
				if (streamServiceSettings.use_auth) {
					streamServiceSettings.username = action.options.username as string
					streamServiceSettings.password = action.options.password as string
				}
			} else if (streamType === 'rtmp_common') {
				streamServiceSettings.key = action.options.streamKey as string
			} else if (streamType === 'whip_custom') {
				streamServiceSettings.server = action.options.streamURL as string
				streamServiceSettings.service = 'WHIP'
				streamServiceSettings.bearer_token = action.options.bearerToken as string
			}

			await self.obs.sendRequest('SetStreamServiceSettings', {
				streamServiceType: streamType,
				streamServiceSettings: streamServiceSettings,
			})
			void self.obs.getStreamStatus()
		},
	}
	actions['SendStreamCaption'] = {
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
				const captionText = action.options.text as string
				await self.obs.sendRequest('SendStreamCaption', { captionText: captionText })
			}
		},
	}
	//Replay Buffer
	actions['start_replay_buffer'] = {
		name: 'Replay Buffer - Start',
		description: 'Starts the replay buffer output',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StartReplayBuffer')
		},
	}
	actions['stop_replay_buffer'] = {
		name: 'Replay Buffer - Stop',
		description: 'Stops the replay buffer output',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('StopReplayBuffer')
		},
	}
	actions['save_replay_buffer'] = {
		name: 'Replay Buffer - Save',
		description: 'Saves the current contents of the replay buffer to disk',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('SaveReplayBuffer')
		},
	}
	actions['ToggleReplayBuffer'] = {
		name: 'Replay Buffer - Toggle',
		description: 'Toggles the replay buffer output state',
		options: [],
		callback: async () => {
			await self.obs.sendRequest('ToggleReplayBuffer')
		},
	}

	return actions
}
