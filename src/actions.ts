import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'
import hotkeys from './hotkeys.js'

export function getActions(this: OBSInstance): CompanionActionDefinitions {
	const actions: CompanionActionDefinitions = {}

	actions['enable_studio_mode'] = {
		name: 'Enable Studio Mode',
		options: [],
		callback: async () => {
			await this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: true })
		},
	}
	actions['disable_studio_mode'] = {
		name: 'Disable Studio Mode',
		options: [],
		callback: async () => {
			await this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: false })
		},
	}
	actions['toggle_studio_mode'] = {
		name: 'Toggle Studio Mode',
		options: [],
		callback: async () => {
			await this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: this.states.studioMode ? false : true })
		},
	}
	actions['start_recording'] = {
		name: 'Start Recording',
		options: [],
		callback: async () => {
			await this.sendRequest('StartRecord')
		},
	}
	actions['stop_recording'] = {
		name: 'Stop Recording',
		options: [],
		callback: async () => {
			await this.sendRequest('StopRecord')
		},
	}
	actions['pause_recording'] = {
		name: 'Pause Recording',
		options: [],
		callback: async () => {
			await this.sendRequest('PauseRecord')
		},
	}
	actions['resume_recording'] = {
		name: 'Resume Recording',
		options: [],
		callback: async () => {
			await this.sendRequest('ResumeRecord')
		},
	}
	actions['ToggleRecordPause'] = {
		name: 'Toggle Recording Pause',
		options: [],
		callback: async () => {
			await this.sendRequest('ToggleRecordPause')
		},
	}
	actions['SplitRecordFile'] = {
		name: 'Split Recording',
		description: 'Requires using the Advanced output mode, and enabling file splitting in the Records settings',
		options: [],
		callback: async () => {
			await this.sendRequest('SplitRecordFile')
		},
	}
	actions['CreateRecordChapter'] = {
		name: 'Create Record Chapter',
		description: 'Requires using the Hybrid MP4 encoder',
		options: [
			{
				type: 'textinput',
				useVariables: true,
				label: 'Chapter Name',
				id: 'chapterName',
				default: '',
			},
		],
		callback: async (action) => {
			const chapterName = action.options.chapterName as string
			await this.sendRequest('CreateRecordChapter', { chapterName: chapterName })
		},
	}
	actions['start_streaming'] = {
		name: 'Start Streaming',
		options: [],
		callback: async () => {
			await this.sendRequest('StartStream')
		},
	}
	actions['stop_streaming'] = {
		name: 'Stop Streaming',
		options: [],
		callback: async () => {
			await this.sendRequest('StopStream')
		},
	}
	actions['StartStopStreaming'] = {
		name: 'Toggle Streaming',
		options: [],
		callback: async () => {
			await this.sendRequest('ToggleStream')
		},
	}
	actions['start_replay_buffer'] = {
		name: 'Start Replay Buffer',
		options: [],
		callback: async () => {
			await this.sendRequest('StartReplayBuffer')
		},
	}
	actions['stop_replay_buffer'] = {
		name: 'Stop Replay Buffer',
		options: [],
		callback: async () => {
			await this.sendRequest('StopReplayBuffer')
		},
	}
	actions['save_replay_buffer'] = {
		name: 'Save Replay Buffer',
		options: [],
		callback: async () => {
			await this.sendRequest('SaveReplayBuffer')
		},
	}
	actions['ToggleReplayBuffer'] = {
		name: 'Toggle Replay Buffer',
		options: [],
		callback: async () => {
			await this.sendRequest('ToggleReplayBuffer')
		},
	}
	actions['set_scene'] = {
		name: 'Set Program Scene',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoicesCustomScene,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				isVisible: (options) => options.scene === 'customSceneName',
			},
		],
		callback: async (action) => {
			if (action.options.scene === 'custom') {
				const scene = action.options.customSceneName as string
				await this.sendRequest('SetCurrentProgramScene', { sceneName: scene })
			} else {
				await this.sendRequest('SetCurrentProgramScene', { sceneName: action.options.scene })
			}
		},
	}
	actions['preview_scene'] = {
		name: 'Set Preview Scene',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoicesCustomScene,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				isVisible: (options) => options.scene === 'customSceneName',
			},
			{
				type: 'checkbox',
				label: 'Revert to preview scene after transition',
				id: 'revert',
				default: false,
			},
			{
				type: 'number',
				label: 'Revert Transition Duration (in ms)',
				id: 'transition_time',
				default: 500,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
				isVisible: (options) => options.revert === true,
			},
		],
		callback: async (action) => {
			if (action.options.scene === 'custom') {
				const scene = action.options.customSceneName as string
				await this.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			} else {
				await this.sendRequest('SetCurrentPreviewScene', { sceneName: action.options.scene })
			}

			if (action.options.revert && this.states.programScene !== undefined) {
				const revertTransitionDuration = action.options.transition_time as number
				setTimeout(
					() => {
						void this.sendRequest('SetCurrentPreviewScene', { sceneName: this.states.programScene })
					},
					(revertTransitionDuration ?? 0) + 50,
				)
			}
		},
	}
	actions['smart_switcher'] = {
		name: 'Smart Scene Switcher',
		description: 'Previews selected scene or, if scene is already in preview, transitions the scene to program',
		options: [
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: this.sceneListDefault,
				choices: this.sceneChoicesCustomScene,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom Scene Name',
				id: 'customSceneName',
				default: '',
				isVisible: (options) => options.scene === 'customSceneName',
			},
		],
		callback: async (action) => {
			let scene = action.options.scene as string
			if (action.options.scene === 'custom') {
				scene = action.options.customSceneName as string
			} else if (action.options.scene === 'program') {
				scene = this.states.programScene ?? ''
			}

			if (this.states.previewScene == scene && this.states.programScene != scene) {
				await this.sendRequest('TriggerStudioModeTransition')
			} else {
				await this.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			}
		},
	}
	actions['previewPreviousScene'] = {
		name: 'Preview Previous Scene',
		options: [],
		callback: async () => {
			if (this.states.previewSceneIndex !== undefined) {
				const previewSceneIndex = this.states.previewSceneIndex
				const previousIndex = previewSceneIndex + 1 // Assuming higher index means "previous" in the list order
				const previousScene = this.states.scenes.find((s: any) => s.sceneIndex === previousIndex)
				if (previousScene) {
					await this.sendRequest('SetCurrentPreviewScene', { sceneName: previousScene.sceneName })
				} else {
					this.log('debug', 'No previous scene found or already at the end of the list.')
				}
			} else {
				this.log('warn', 'Preview scene index is not available.')
			}
		},
	}
	actions['previewNextScene'] = {
		name: 'Preview Next Scene',
		options: [],
		callback: async () => {
			if (this.states.previewSceneIndex !== undefined) {
				const previewSceneIndex = this.states.previewSceneIndex
				const nextIndex = previewSceneIndex - 1 // Assuming lower index means "next" in the list order
				const nextScene = this.states.scenes.find((s: any) => s.sceneIndex === nextIndex)
				if (nextScene) {
					await this.sendRequest('SetCurrentPreviewScene', { sceneName: nextScene.sceneName })
				} else {
					this.log('debug', 'No next scene found or already at the beginning of the list.')
				}
			} else {
				this.log('warn', 'Preview scene index is not available.')
			}
		},
	}
	actions['do_transition'] = {
		name: 'Transition',
		description: 'Transitions preview to program in Studio Mode',
		options: [],
		callback: async () => {
			if (this.states.studioMode) {
				await this.sendRequest('TriggerStudioModeTransition')
			} else {
				this.log(
					'warn',
					'The Transition action requires OBS to be in Studio Mode. Try switching to Studio Mode, or using the Change Scene action instead',
				)
				return
			}
		},
	}
	actions['quick_transition'] = {
		name: 'Quick Transition',
		description: 'Performs the selected transition and then returns to the default transition',
		options: [
			{
				type: 'dropdown',
				label: 'Transition',
				id: 'transition',
				default: this.transitionList?.[0] ? this.transitionList[0].id : '',
				choices: this.transitionList,
			},
			{
				type: 'checkbox',
				label: 'Custom Duration',
				id: 'customDuration',
				default: false,
			},
			{
				type: 'number',
				label: 'Duration (in ms)',
				id: 'transition_time',
				default: 500,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
				isVisible: (options) => options.customDuration === true,
			},
		],
		callback: async (action) => {
			if (action.options.transition == 'Default' && !action.options.customDuration) {
				await this.sendRequest('TriggerStudioModeTransition')
			} else {
				const revertTransition = this.states.currentTransition ?? 'Cut'
				const revertTransitionDuration =
					(this.states.transitionDuration ?? 0) > 0 ? (this.states.transitionDuration as number) : 500
				let transitionWaitTime: number
				let transitionDuration: number

				if (action.options.transition == 'Cut') {
					transitionWaitTime = 100
				} else if (action.options.transition != 'Cut' && action.options.customDuration) {
					transitionWaitTime =
						(action.options.transition_time as number) > 50
							? (action.options.transition_time as number) + 100
							: revertTransitionDuration + 100
				} else {
					transitionWaitTime = revertTransitionDuration + 100
				}

				if (action.options.customDuration) {
					transitionDuration =
						action.options.transition_time != null
							? (action.options.transition_time as number)
							: revertTransitionDuration
				} else {
					transitionDuration = revertTransitionDuration
				}

				if (!this.states.transitionActive) {
					this.states.transitionActive = true
					await this.sendBatch([
						{
							requestType: 'SetCurrentSceneTransition',
							requestData: { transitionName: action.options.transition as string },
						},
						{
							requestType: 'SetCurrentSceneTransitionDuration',
							requestData: { transitionDuration: transitionDuration },
						},
						{
							requestType: 'TriggerStudioModeTransition',
						},
						{
							requestType: 'Sleep',
							requestData: { sleepMillis: transitionWaitTime },
						},
						{
							requestType: 'SetCurrentSceneTransition',
							requestData: { transitionName: revertTransition },
						},
						{
							requestType: 'SetCurrentSceneTransitionDuration',
							requestData: { transitionDuration: revertTransitionDuration },
						},
					])
					this.states.transitionActive = false
				} else {
					return
				}
			}
		},
	}
	actions['set_transition'] = {
		name: 'Set Transition Type',
		options: [
			{
				type: 'dropdown',
				label: 'Transitions',
				id: 'transitions',
				default: this.transitionList?.[0] ? this.transitionList[0].id : '',
				choices: this.transitionList,
				allowCustom: true,
			},
		],
		callback: async (action) => {
			const transition = action.options.transitions as string
			await this.sendRequest('SetCurrentSceneTransition', { transitionName: transition })
		},
	}
	actions['adjustTransitionType'] = {
		name: 'Adjust Transition Type',
		options: [
			{
				type: 'dropdown',
				label: 'Adjust',
				id: 'adjust',
				choices: [
					{ id: 'next', label: 'Next' },
					{ id: 'previous', label: 'Previous' },
				],
				default: 'next',
			},
		],
		callback: async (action) => {
			const currentTransitionIndex = this.transitionList.findIndex((item) => item.id === this.states.currentTransition)
			if (action.options.adjust === 'next') {
				const nextTransition = this.transitionList[currentTransitionIndex + 1]?.id ?? this.transitionList[0].id
				await this.sendRequest('SetCurrentSceneTransition', { transitionName: nextTransition })
			} else if (action.options.adjust === 'previous') {
				const previousTransition =
					this.transitionList[currentTransitionIndex - 1]?.id ?? this.transitionList[this.transitionList.length - 1].id
				await this.sendRequest('SetCurrentSceneTransition', { transitionName: previousTransition })
			}
		},
	}
	actions['set_transition_duration'] = {
		name: 'Set Transition Duration',
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				tooltip: 'Must be between 50 and 20000ms',
				id: 'duration',
				default: 500,
				min: 50,
				max: 20000, //max is required by api
				range: false,
				isVisible: (options) => !options.useVariable,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Transition time variable (in ms)',
				id: 'variableValue',
				default: '500',
				isVisible: (options) => options.useVariable === true,
			},
			{
				type: 'checkbox',
				label: 'Use Variable',
				id: 'useVariable',
				default: false,
			},
		],
		callback: async (action) => {
			let duration: number | null = null
			if (action.options.useVariable) {
				duration = parseInt(action.options.variableValue as string)
				if (duration >= 50 && duration <= 20000) {
					//Pass duration as is
				} else {
					this.log('warn', 'Transition duration must be between 50 and 20000ms')
					return
				}
			} else {
				duration = action.options.duration as number
			}
			if (duration !== null) {
				await this.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
			}
		},
	}
	actions['adjustTransitionDuration'] = {
		name: 'Adjust Transition Duration',
		options: [
			{
				type: 'number',
				label: 'Adjustment amount +/- (in ms)',
				id: 'duration',
				default: 500,
				min: -20000,
				max: 20000,
				range: false,
			},
		],
		callback: async (action) => {
			if (this.states.transitionDuration !== undefined) {
				let duration: number | null = null
				duration = this.states.transitionDuration + (action.options.duration as number)
				if (duration >= 50 && duration <= 20000) {
					//Pass duration as is
				} else if (duration < 50) {
					duration = 50
				} else if (duration > 20000) {
					duration = 20000
				} else {
					duration = this.states.transitionDuration
				}
				if (duration !== null) {
					await this.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: duration })
				}
			} else {
				this.log('warn', 'Unable to adjust transition duration')
				return
			}
		},
	}
	actions['set_stream_settings'] = {
		name: 'Set Stream Settings',
		options: [
			{
				type: 'dropdown',
				label: 'Stream Type',
				id: 'streamType',
				choices: [
					{ id: 'rtmp_common', label: 'Preset Service' },
					{ id: 'rtmp_custom', label: 'Custom RTMP' },
					{ id: 'whip_custom', label: 'Custom WHIP' },
				],
				default: 'rtmp_custom',
			},
			{
				type: 'dropdown',
				label: 'Service',
				id: 'service',
				choices: [
					{ id: 'Twitter', label: 'Twitter' },
					{ id: 'Restream.io', label: 'Restream.io' },
					{ id: 'YouTube - RTMPS', label: 'YouTube - RTMPS' },
					{ id: 'Twitch', label: 'Twitch' },
					{ id: 'Facebook Live', label: 'Facebook Live' },
					{ id: 'Custom', label: 'Custom' },
				],
				default: 'Twitch',
				isVisibleExpression: `$(options: streamType) === 'rtmp_common'`,
			},
			{
				type: 'textinput',
				label: 'Service Name',
				id: 'serviceName',
				default: 'Twitch',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'rtmp_common' && $(options: service) === 'Custom'`,
			},
			{
				type: 'textinput',
				label: 'Stream URL',
				id: 'streamURL',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'rtmp_custom' || $(options: streamType) === 'whip_custom'`,
			},
			{
				type: 'textinput',
				label: 'Stream Key',
				id: 'streamKey',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'rtmp_common' || $(options: streamType) === 'rtmp_custom'`,
			},
			{
				type: 'checkbox',
				label: 'Use Authentication',
				id: 'streamAuth',
				default: false,
				isVisibleExpression: `$(options: streamType) === 'rtmp_custom'`,
			},
			{
				type: 'textinput',
				label: 'User Name (Optional)',
				id: 'streamUserName',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'rtmp_custom' && $(options: streamAuth)`,
			},
			{
				type: 'textinput',
				label: 'Password (Optional)',
				id: 'streamPassword',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'rtmp_custom' && $(options: streamAuth)`,
			},
			{
				type: 'textinput',
				id: 'bearerToken',
				label: 'Bearer Token (Optional)',
				default: '',
				useVariables: true,
				isVisibleExpression: `$(options: streamType) === 'whip_custom'`,
			},
		],
		callback: async (action) => {
			const streamServiceSettings: Record<string, any> = {}
			const streamType = action.options.streamType as string

			if (streamType === 'rtmp_common') {
				streamServiceSettings.key = action.options.streamKey as string
				streamServiceSettings.service =
					action.options.service === 'Custom'
						? (action.options.serviceName as string)
						: (action.options.service as string)
			} else if (streamType === 'rtmp_custom') {
				streamServiceSettings.server = action.options.streamURL as string
				streamServiceSettings.key = action.options.streamKey as string
				streamServiceSettings.use_auth = action.options.streamAuth as boolean
				streamServiceSettings.username = action.options.streamUserName as string
				streamServiceSettings.password = action.options.streamPassword as string
			} else if (streamType === 'whip_custom') {
				streamServiceSettings.server = action.options.streamURL as string
				streamServiceSettings.service = 'WHIP'
				streamServiceSettings.bearer_token = action.options.bearerToken as string
			}

			await this.sendRequest('SetStreamServiceSettings', {
				streamServiceType: streamType,
				streamServiceSettings: streamServiceSettings,
			})
			void this.getStreamStatus()
		},
	}
	actions['SendStreamCaption'] = {
		name: 'Send Stream Caption',
		options: [
			{
				type: 'textinput',
				useVariables: true,
				label: 'Caption Text',
				id: 'text',
				default: '',
			},
		],
		callback: async (action) => {
			if (this.states.streaming) {
				const captionText = action.options.text as string
				await this.sendRequest('SendStreamCaption', { captionText: captionText })
			}
		},
	}
	actions['StartStopRecording'] = {
		name: 'Toggle Recording',
		options: [],
		callback: async () => {
			await this.sendRequest('ToggleRecord')
		},
	}
	actions['set_source_mute'] = {
		name: 'Set Source Mute',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'dropdown',
				label: 'Mute',
				id: 'mute',
				default: 'true',
				choices: [
					{ id: 'false', label: 'False' },
					{ id: 'true', label: 'True' },
				],
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetInputMute', {
				inputName: action.options.source as string,
				inputMuted: action.options.mute == 'true' ? true : false,
			})
		},
	}
	actions['toggle_source_mute'] = {
		name: 'Toggle Source Mute',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
		],
		callback: async (action) => {
			await this.sendRequest('ToggleInputMute', { inputName: action.options.source as string })
		},
	}
	actions['set_volume'] = {
		name: 'Set Source Volume',
		description: 'Sets the volume of a source to a specific value',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26) ',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetInputVolume', {
				inputName: action.options.source as string,
				inputVolumeDb: action.options.volume as number,
			})
		},
	}
	actions['setSceneItemIndex'] = {
		name: 'Set Scene Item Index',
		description: 'Sets the index of a scene item in a scene',
		options: [
			{
				type: 'dropdown',
				label: 'Scene (optional, defaults to current scene)',
				id: 'scene',
				default: 'Current Scene',
				choices: this.sceneChoicesProgramPreview,
				allowCustom: true,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
				allowCustom: true,
			},
			{
				type: 'number',
				label: 'Position Index',
				id: 'pos',
				default: 0,
				min: 0,
				max: 26,
				range: false,
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetSceneItemIndex', {
				sceneName: action.options.scene as string,
				sceneItemId: action.options.source as number,
				sceneItemIndex: action.options.pos as number,
			})
		},
	}
	actions['adjust_volume'] = {
		name: 'Adjust Source Volume (dB)',
		description: 'Adjusts the volume of a source by a specific increment',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Volume adjustment amount in dB',
				id: 'volume',
				default: 0,
				min: -100,
				max: 100,
				range: false,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const currentVolume = this.sources[sourceName]?.inputVolume ?? 0
			let newVolume = currentVolume + (action.options.volume as number)
			if (newVolume > 26) {
				newVolume = 26
			} else if (newVolume < -100) {
				newVolume = -100
			}

			await this.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newVolume })
		},
	}
	actions['adjust_volume_percent'] = {
		name: 'Adjust Source Volume (Percentage)',
		description: 'Adjusts the volume of a source based on a percentage of the OBS volume slider',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Percent Adjustment',
				id: 'percent',
				default: 0,
				min: -100,
				max: 100,
				range: true,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			//Standard offset values (aka how the OBS code determines slider percentage)
			const LOG_RANGE_DB = 96.0
			const LOG_OFFSET_DB = 6.0
			const LOG_OFFSET_VAL = -0.77815125038364363
			const LOG_RANGE_VAL = Number('-2.00860017176191756')

			//Calculate current "percent" of volume slider in OBS
			const dB = this.sources[sourceName]?.inputVolume ?? 0
			let currentPercent = 0.0
			if (dB >= 0.0) {
				currentPercent = 100.0
			} else if (dB <= -96.0) {
				currentPercent = 0.0
			} else {
				currentPercent = ((-Math.log10(-dB + 6.0) - LOG_RANGE_VAL) / (LOG_OFFSET_VAL - LOG_RANGE_VAL)) * 100.0
			}

			//Calculate new "percent" of volume slider
			const percentAdjustment = Math.abs(action.options.percent as number)

			let newPercent: number
			if ((action.options.percent as number) > 0) {
				newPercent = currentPercent + percentAdjustment
			} else {
				newPercent = currentPercent - percentAdjustment
			}
			newPercent = newPercent / 100
			let newDb: number
			if (newPercent >= 1.0) {
				newDb = 0.0
			} else if (newPercent <= 0.0) {
				newDb = -100.0
			} else {
				newDb =
					-(LOG_RANGE_DB + LOG_OFFSET_DB) * Math.pow((LOG_RANGE_DB + LOG_OFFSET_DB) / LOG_OFFSET_DB, -newPercent) +
					LOG_OFFSET_DB
			}

			await this.sendRequest('SetInputVolume', { inputName: sourceName, inputVolumeDb: newDb })
		},
	}
	actions['fadeVolume'] = {
		name: 'Fade Source Volume',
		description: 'Fades the volume of a source to a specific value over a specific duration',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Target Volume (dB)',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
			},
			{
				type: 'number',
				label: 'Fade Duration (milliseconds)',
				id: 'duration',
				default: 500,
				range: false,
				min: 50,
				max: 5000,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const currentVolume = this.sources[sourceName]?.inputVolume ?? 0
			const targetVolume = action.options.volume as number
			const fadeDuration = action.options.duration as number
			const fadeSteps = 25
			const fadeInterval = fadeDuration / fadeSteps

			const fadeBatch = []
			for (let i = 0; i < fadeSteps + 1; i++) {
				const newVolume = currentVolume + (targetVolume - currentVolume) * (i / fadeSteps)
				fadeBatch.push(
					{
						requestType: 'SetInputVolume',
						requestData: { inputName: sourceName, inputVolumeDb: newVolume },
					},
					{
						requestType: 'Sleep',
						requestData: { sleepMillis: fadeInterval },
					},
				)
			}

			if (this.sources[sourceName]?.audioFadeActive) {
				return
			} else {
				if (this.sources[sourceName]) {
					this.sources[sourceName].audioFadeActive = true
				}
				await this.sendBatch(fadeBatch)
				if (this.sources[sourceName]) {
					this.sources[sourceName].audioFadeActive = false
				}
			}
		},
	}
	actions['setSyncOffset'] = {
		name: 'Set Audio Sync Offset',
		description: 'Sets the sync offset of an audio source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Sync Offset in ms (-950 to 20000)',
				id: 'offset',
				default: 0,
				min: -950,
				max: 20000,
				range: false,
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetInputAudioSyncOffset', {
				inputName: action.options.source as string,
				inputAudioSyncOffset: action.options.offset as number,
			})
		},
	}
	actions['adjustSyncOffset'] = {
		name: 'Adjust Audio Sync Offset',
		description: 'Adjusts the sync offset of an audio source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'textinput',
				label: 'Adjustment amount (+ / - ms)',
				id: 'offset',
				default: '1',
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const current = this.sources[sourceName]?.inputAudioSyncOffset ?? 0
			const offset = parseInt(action.options.offset as string)
			let newOffset = current + offset
			if (newOffset > 20000) {
				newOffset = 20000
			} else if (newOffset < -950) {
				newOffset = -950
			}
			await this.sendRequest('SetInputAudioSyncOffset', {
				inputName: sourceName,
				inputAudioSyncOffset: newOffset,
			})
		},
	}
	actions['setAudioBalance'] = {
		name: 'Set Audio Balance',
		description: 'Sets the balance of an audio source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'number',
				label: 'Balance (Left 0.0 to 1.0 Right)',
				id: 'balance',
				default: 0.5,
				min: 0.0,
				max: 1.0,
				range: false,
			},
		],
		callback: async (action) => {
			const source = action.options.source as string
			await this.sendRequest('SetInputAudioBalance', {
				inputName: source,
				inputAudioBalance: action.options.balance as number,
			})
		},
	}
	actions['adjustAudioBalance'] = {
		name: 'Adjust Audio Balance',
		description: 'Adjust the balance of an audio source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'textinput',
				label: 'Adjustment amount (+ / -)',
				id: 'offset',
				default: '0.1',
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			const current = this.sources[sourceName]?.inputAudioBalance ?? 0
			const offset = parseFloat(action.options.offset as string)
			let newOffset = current + offset
			if (newOffset > 1.0) {
				newOffset = 1.0
			} else if (newOffset < 0.0) {
				newOffset = 0.0
			}
			await this.sendRequest('SetInputAudioBalance', {
				inputName: sourceName,
				inputAudioBalance: newOffset,
			})
		},
	}
	actions['toggle_scene_item'] = {
		name: 'Set Source Visibility',
		description: 'Set or toggle the visibility of a source within a scene',
		options: [
			{
				type: 'dropdown',
				label: 'Scene (optional, defaults to current scene)',
				id: 'scene',
				default: 'Current Scene',
				choices: this.sceneChoicesProgramPreview,
				allowCustom: true,
			},
			{
				type: 'checkbox',
				label: 'All Sources',
				id: 'all',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
				allowCustom: true,
				isVisible: (options) => options.all === false,
			},
			{
				type: 'dropdown',
				label: 'Visible',
				id: 'visible',
				default: 'toggle',
				choices: [
					{ id: 'false', label: 'False' },
					{ id: 'true', label: 'True' },
					{ id: 'toggle', label: 'Toggle' },
				],
			},
		],
		callback: async (action) => {
			const sourceScene = action.options.scene as string
			const sourceName = action.options.source as string
			let enabled = true
			const requests: any[] = []

			let sceneName = sourceScene
			// special scene names
			if (sceneName === 'Current Scene') {
				sceneName = this.states.programScene ?? ''
			} else if (sceneName === 'Preview Scene') {
				sceneName = this.states.previewScene ?? ''
			}

			if (this.sources[sourceName]?.groupedSource) {
				const group = this.sources[sourceName]?.groupName
				if (group) {
					const source = this.groups[group]?.find((item) => item.sourceName === sourceName)
					if (source) {
						if (action.options.visible === 'toggle') {
							enabled = !source.sceneItemEnabled
						} else {
							enabled = action.options.visible == 'true' ? true : false
						}
						await this.sendRequest('SetSceneItemEnabled', {
							sceneName: source.groupName,
							sceneItemId: source.sceneItemId,
							sceneItemEnabled: enabled,
						})
					}
				}
			}
			const targetScene = this.sceneItems[sceneName]
			if (targetScene) {
				targetScene.forEach((source) => {
					if (action.options.all || source.sourceName === sourceName) {
						if (action.options.visible === 'toggle') {
							enabled = !source.sceneItemEnabled
						} else {
							enabled = action.options.visible == 'true' ? true : false
						}
						requests.push({
							requestType: 'SetSceneItemEnabled',
							requestData: {
								sceneName: sceneName,
								sceneItemId: source.sceneItemId,
								sceneItemEnabled: enabled,
							},
						})

						if (source.isGroup && action.options.all) {
							if (this.groups[source.sourceName]) {
								for (const groupItem of this.groups[source.sourceName]) {
									let groupEnabled: boolean
									if (action.options.visible === 'toggle') {
										groupEnabled = !this.sources[groupItem.sourceName]?.sceneItemEnabled
									} else {
										groupEnabled = action.options.visible == 'true' ? true : false
									}
									requests.push({
										requestType: 'SetSceneItemEnabled',
										requestData: {
											sceneName: source.sourceName,
											sceneItemId: groupItem.sceneItemId,
											sceneItemEnabled: groupEnabled,
										},
									})
								}
							}
						}
					}
				})
				await this.sendBatch(requests)
			} else {
				return
			}
		},
	}
	actions['setText'] = {
		name: 'Set Source Text',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.textSourceList?.[0] ? this.textSourceList[0].id : 'None',
				choices: this.textSourceList,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Text',
				id: 'text',
			},
		],
		callback: async (action) => {
			let newText = action.options.text as string
			if (typeof newText === 'string') {
				newText = newText.replace(/\\n/g, '\n')
			}
			await this.sendRequest('SetInputSettings', {
				inputName: action.options.source as string,
				inputSettings: { text: newText },
			})
		},
	}
	actions['setTextProperties'] = {
		name: 'Set Text Properties',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.textSourceList?.[0] ? this.textSourceList[0].id : 'None',
				choices: this.textSourceList,
			},
			{
				type: 'multidropdown',
				label: 'Properties',
				id: 'props',
				default: [],
				choices: [
					{ id: 'fontSize', label: 'Font Size' },
					{ id: 'fontFace', label: 'Font Face' },
					{ id: 'fontStyle', label: 'Font Style' },
					{ id: 'text', label: 'Text' },
					{ id: 'textTransform', label: 'Text Transform' },
					{ id: 'color1', label: 'Color 1' },
					{ id: 'color2', label: 'Color 2 / Gradient Color' },
					{ id: 'gradient', label: 'Gradient' },
					{ id: 'backgroundColor', label: 'Background Color' },
					{ id: 'backgroundOpacity', label: 'Background Opacity' },
					{ id: 'outline', label: 'Outline' },
					{ id: 'outlineSize', label: 'Outline Size' },
					{ id: 'outlineThickness', label: 'Outline Thickness' },
					{ id: 'outlineColor', label: 'Outline Color' },
					{ id: 'dropShadow', label: 'Drop Shadow' },
					{ id: 'alignment', label: 'Alignment' },
					{ id: 'verticalAlignment', label: 'Vertical Alignment' },
					{ id: 'extents', label: 'Use Custom Text Extents' },
					{ id: 'extentsWidth', label: 'Text Extents Width' },
					{ id: 'extentsHeight', label: 'Text Extents Height' },
					{ id: 'wrap', label: 'Wrap' },
					{ id: 'vertical', label: 'Vertical' },
				],
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Text',
				id: 'text',
				isVisibleExpression: `arrayIncludes($(options: props), 'text')`,
			},
			{
				type: 'dropdown',
				label: 'Text Transform',
				id: 'textTransform',
				default: 0,
				choices: [
					{ id: 0, label: 'None' },
					{ id: 1, label: 'Uppercase' },
					{ id: 2, label: 'Lowercase' },
					{ id: 3, label: 'Start Case' },
				],
				isVisibleExpression: `arrayIncludes($(options: props), 'textTransform')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Font Size',
				id: 'fontSize',
				isVisibleExpression: `arrayIncludes($(options: props), 'fontSize')`,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Font Face',
				id: 'fontFace',
				isVisibleExpression: `arrayIncludes($(options: props), 'fontFace')`,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Font Style',
				id: 'fontStyle',
				isVisibleExpression: `arrayIncludes($(options: props), 'fontStyle')`,
			},
			{
				type: 'colorpicker',
				label: 'Color 1',
				id: 'color1',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options: props), 'color1')`,
			},
			{
				type: 'colorpicker',
				label: 'Color 2 / Gradient Color',
				id: 'color2',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options: props), 'color2')`,
			},
			{
				type: 'checkbox',
				label: 'Gradient',
				id: 'gradient',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'gradient')`,
			},
			{
				type: 'checkbox',
				label: 'Outline',
				id: 'outline',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'outline')`,
			},
			{
				type: 'textinput',
				label: 'Outline Size',
				id: 'outlineSize',
				default: '1',
				isVisibleExpression: `arrayIncludes($(options: props), 'outlineSize')`,
				description: 'GDI+ Text Sources Only',
				useVariables: true,
			},
			{
				type: 'textinput',
				label: 'Outline Thickness',
				id: 'outlineThickness',
				default: '1',
				isVisibleExpression: `arrayIncludes($(options: props), 'outlineThickness')`,
				description: 'FreeType Text Sources Only',
				useVariables: true,
			},
			{
				type: 'colorpicker',
				label: 'Outline Color',
				id: 'outlineColor',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options: props), 'outlineColor')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'colorpicker',
				label: 'Background Color',
				id: 'backgroundColor',
				default: '#000000',
				enableAlpha: true,
				returnType: 'string',
				isVisibleExpression: `arrayIncludes($(options: props), 'backgroundColor')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Background Opacity',
				id: 'backgroundOpacity',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options: props), 'backgroundOpacity')`,
				description: 'GDI+ Text Sources Only',
				useVariables: true,
			},
			{
				type: 'checkbox',
				label: 'Drop Shadow',
				id: 'dropShadow',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'dropShadow')`,
				description: 'FreeType Text Sources Only',
			},
			{
				type: 'checkbox',
				label: 'Wrap',
				id: 'wrap',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'wrap')`,
			},
			{
				type: 'dropdown',
				label: 'Alignment',
				id: 'alignment',
				default: 'left',
				choices: [
					{ id: 'left', label: 'Left' },
					{ id: 'center', label: 'Center' },
					{ id: 'right', label: 'Right' },
				],
				description: 'GDI+ Text Sources Only',
				isVisibleExpression: `arrayIncludes($(options: props), 'alignment')`,
			},
			{
				type: 'dropdown',
				label: 'Vertical Alignment',
				id: 'verticalAlignment',
				default: 'top',
				choices: [
					{ id: 'top', label: 'Top' },
					{ id: 'center', label: 'Center' },
					{ id: 'bottom', label: 'Bottom' },
				],
				description: 'GDI+ Text Sources Only',
				isVisibleExpression: `arrayIncludes($(options: props), 'verticalAlignment')`,
			},
			{
				type: 'checkbox',
				label: 'Vertical',
				id: 'vertical',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'vertical')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Text Extents',
				id: 'extents',
				default: false,
				isVisibleExpression: `arrayIncludes($(options: props), 'extents')`,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Text Extents Width',
				id: 'extentsWidth',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options: props), 'extentsWidth')`,
				useVariables: true,
				description: 'GDI+ Text Sources Only',
			},
			{
				type: 'textinput',
				label: 'Text Extents Height',
				id: 'extentsHeight',
				default: '100',
				isVisibleExpression: `arrayIncludes($(options: props), 'extentsHeight')`,
				useVariables: true,
				description: 'GDI+ Text Sources Only',
			},
		],
		callback: async (action) => {
			const source = action.options.source as string
			const props = (action.options.props as string[]) || []
			const existingSettings = { ...(this.sources[source]?.settings || {}) }

			// Start with all existing settings, then overlay changes
			const inputSettings: Record<string, any> = { ...existingSettings }
			// Always copy font if it exists, as object, even if not changing
			const existingFont = existingSettings.font ? { ...existingSettings.font } : {}
			const kind = this.sources[source]?.inputKind || ''
			for (const prop of props) {
				if (prop === 'text') {
					let val = action.options.text as string
					// Unescape \n for newlines
					if (typeof val === 'string') {
						val = val.replace(/\\n/g, '\n')
					}
					inputSettings.text = val
				}
				if (prop === 'textTransform' && kind.includes('text_gdiplus')) {
					inputSettings.transform = action.options.textTransform
				}
				if (prop === 'fontSize') {
					const size = action.options.fontSize as string
					const sizeNumber = parseInt(size)
					if (!isNaN(sizeNumber)) {
						existingFont.size = sizeNumber
					}
				}
				if (prop === 'fontFace') {
					const face = action.options.fontFace as string
					if (face) {
						existingFont.face = face
					}
				}
				if (prop === 'fontStyle') {
					const style = action.options.fontStyle as string
					if (style) {
						existingFont.style = style
					}
				}
				if (prop === 'color1') {
					const colorValue = this.rgbaToObsColor(action.options.color1 as string)
					if (kind.includes('text_gdiplus')) {
						inputSettings.color = colorValue
					} else {
						inputSettings.color1 = colorValue
					}
				}
				if (prop === 'color2') {
					const colorValue = this.rgbaToObsColor(action.options.color2 as string)
					if (kind.includes('text_gdiplus')) {
						inputSettings.gradient_color = colorValue
					} else {
						inputSettings.color2 = colorValue
					}
				}
				if (prop === 'outline' && (kind.includes('text_gdiplus') || kind.includes('text_ft2_source'))) {
					inputSettings.outline = action.options.outline
				}
				if (prop === 'outlineSize' && kind.includes('text_gdiplus')) {
					const outlineSize = action.options.outlineSize as string
					const size = parseInt(outlineSize)
					if (!isNaN(size)) {
						inputSettings.outline_size = size
					}
				}
				if (prop === 'outlineThickness' && kind.includes('text_ft2_source')) {
					const outlineThickness = action.options.outlineThickness as string
					const size = parseInt(outlineThickness)
					if (!isNaN(size)) {
						inputSettings.outline_thickness = size
					}
				}
				if (prop === 'outlineColor' && kind.includes('text_gdiplus')) {
					const colorValue = this.rgbaToObsColor(action.options.outlineColor as string)
					inputSettings.outline_color = colorValue
				}
				if (prop === 'backgroundColor' && kind.includes('text_gdiplus')) {
					const colorValue = this.rgbaToObsColor(action.options.backgroundColor as string)
					inputSettings.bk_color = colorValue
				}
				if (prop === 'backgroundOpacity' && kind.includes('text_gdiplus')) {
					const backgroundOpacity = action.options.backgroundOpacity as string
					const opacity = parseInt(backgroundOpacity)
					if (!isNaN(opacity)) {
						inputSettings.bk_opacity = opacity
					}
				}
				if (prop === 'gradient') {
					inputSettings.gradient = action.options.gradient
				}

				if (prop === 'dropShadow') {
					inputSettings.drop_shadow = action.options.dropShadow
				}
				if (prop === 'wrap') {
					if (kind.includes('text_gdiplus')) {
						inputSettings.extents_wrap = action.options.wrap
					} else {
						inputSettings.word_wrap = action.options.wrap
					}
				}
				if (prop === 'alignment' && kind.includes('text_gdiplus')) {
					inputSettings.align = action.options.alignment
				}
				if (prop === 'verticalAlignment' && kind.includes('text_gdiplus')) {
					inputSettings.valign = action.options.verticalAlignment
				}
				if (prop === 'extents' && kind.includes('text_gdiplus')) {
					inputSettings.extents = action.options.extents
				}
				if (prop === 'extentsWidth' && kind.includes('text_gdiplus')) {
					const extentsWidth = action.options.extentsWidth as string
					const width = parseInt(extentsWidth)
					if (!isNaN(width)) {
						inputSettings.extents_cx = width
					}
				}
				if (prop === 'extentsHeight' && kind.includes('text_gdiplus')) {
					const extentsHeight = action.options.extentsHeight as string
					const height = parseInt(extentsHeight)
					if (!isNaN(height)) {
						inputSettings.extents_cy = height
					}
				}
				if (prop === 'vertical' && kind.includes('text_gdiplus')) {
					inputSettings.vertical = action.options.vertical
				}
			}

			// If editing any font property, always send font object including existing settings
			if (
				props.some((prop) => ['fontSize', 'fontFace', 'fontStyle'].includes(prop)) &&
				Object.keys(existingFont).length > 0
			) {
				inputSettings.font = existingFont
			}
			await this.sendRequest('SetInputSettings', {
				inputName: source,
				inputSettings: inputSettings,
			})
		},
	}
	actions['resetCaptureDevice'] = {
		name: 'Reset Video Capture Device',
		description: 'Deactivates and Reactivates a Video Capture Source to reset it',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			if (this.sources[action.options.source as string]?.inputKind) {
				await this.sendRequest('SetInputSettings', {
					inputName: action.options.source as string,
					inputSettings: {},
				})
			} else {
				this.log('warn', 'The selected source is not an input.')
				return
			}
		},
	}
	actions['trigger-hotkey'] = {
		name: 'Trigger Hotkey by ID',
		options: [
			{
				type: 'dropdown',
				label: 'Hotkey ID',
				id: 'id',
				default: 'OBSBasic.StartRecording',
				choices: this.hotkeyNames,
				allowCustom: true,
			},
		],
		callback: async (action) => {
			const hotkey = action.options.id as string
			await this.sendRequest('TriggerHotkeyByName', { hotkeyName: hotkey })
		},
	}
	actions['trigger-hotkey-sequence'] = {
		name: 'Trigger Hotkey by Key',
		options: [
			{
				type: 'dropdown',
				label: 'Key',
				id: 'keyId',
				default: 'OBS_KEY_A',
				choices: hotkeys,
			},
			{
				type: 'checkbox',
				label: 'Shift',
				id: 'keyShift',
				default: false,
			},
			{
				type: 'checkbox',
				label: 'Alt / Option',
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
				label: 'Command (Mac)',
				id: 'keyCommand',
				default: false,
			},
		],
		callback: async (action) => {
			const keyModifiers = {
				shift: action.options.keyShift,
				alt: action.options.keyAlt,
				control: action.options.keyControl,
				command: action.options.keyCommand,
			}

			await this.sendRequest('TriggerHotkeyByKeySequence', {
				keyId: action.options.keyId,
				keyModifiers: keyModifiers,
			})
		},
	}
	actions['set_profile'] = {
		name: 'Set Profile',
		options: [
			{
				type: 'dropdown',
				label: 'Profile',
				id: 'profile',
				default: this.profileChoicesDefault,
				choices: this.profileChoices,
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetCurrentProfile', { profileName: action.options.profile })
		},
	}
	actions['set_scene_collection'] = {
		name: 'Set Scene Collection',
		options: [
			{
				type: 'dropdown',
				label: 'Scene Collection',
				id: 'scene_collection',
				default: this.sceneCollectionList?.[0] ? this.sceneCollectionList[0].id : '',
				choices: this.sceneCollectionList,
			},
		],
		callback: async (action) => {
			await this.sendRequest('SetCurrentSceneCollection', { sceneCollectionName: action.options.scene_collection })
		},
	}
	actions['start_output'] = {
		name: 'Start Output',
		options: [
			{
				type: 'dropdown',
				label: 'Output',
				id: 'output',
				default: 'virtualcam_output',
				choices: this.outputList,
			},
		],
		callback: async (action) => {
			if (action.options.output === 'virtualcam_output') {
				await this.sendRequest('StartVirtualCam')
			} else {
				await this.sendRequest('StartOutput', {
					outputName: action.options.output,
				})
			}
		},
	}
	actions['stop_output'] = {
		name: 'Stop Output',
		options: [
			{
				type: 'dropdown',
				label: 'Output',
				id: 'output',
				default: 'virtualcam_output',
				choices: this.outputList,
			},
		],
		callback: async (action) => {
			if (action.options.output === 'virtualcam_output') {
				await this.sendRequest('StopVirtualCam')
			} else {
				await this.sendRequest('StopOutput', {
					outputName: action.options.output,
				})
			}
		},
	}
	actions['start_stop_output'] = {
		name: 'Toggle Output',
		options: [
			{
				type: 'dropdown',
				label: 'Output',
				id: 'output',
				default: 'virtualcam_output',
				choices: this.outputList,
			},
		],
		callback: async (action) => {
			if (action.options.output === 'virtualcam_output') {
				await this.sendRequest('ToggleVirtualCam')
			} else {
				await this.sendRequest('ToggleOutput', {
					outputName: action.options.output,
				})
			}
		},
	}
	actions['refresh_browser_source'] = {
		name: 'Refresh Browser Source',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			const sourceName = action.options.source as string
			if (this.sources[sourceName]?.inputKind == 'browser_source') {
				await this.sendRequest('PressInputPropertiesButton', {
					inputName: sourceName,
					propertyName: 'refreshnocache',
				})
			} else {
				this.log('warn', 'The selected source is not a browser source')
				return
			}
		},
	}
	actions['set_audio_monitor'] = {
		name: 'Set Audio Monitor',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.audioSourceListDefault,
				choices: this.audioSourceList,
			},
			{
				type: 'dropdown',
				label: 'Monitor',
				id: 'monitor',
				default: 'none',
				choices: [
					{ id: 'none', label: 'Monitor Off' },
					{ id: 'monitorOnly', label: 'Monitor Only' },
					{ id: 'monitorAndOutput', label: 'Monitor and Output' },
				],
			},
		],
		callback: async (action) => {
			let monitorType
			if (action.options.monitor === 'monitorAndOutput') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
			} else if (action.options.monitor === 'monitorOnly') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
			} else {
				monitorType = 'OBS_MONITORING_TYPE_NONE'
			}
			await this.sendRequest('SetInputAudioMonitorType', { inputName: action.options.source, monitorType: monitorType })
		},
	}
	actions['take_screenshot'] = {
		name: 'Take Screenshot',
		options: [
			{
				type: 'dropdown',
				label: 'Format',
				id: 'format',
				default: 'png',
				choices: this.imageFormats,
			},
			{
				type: 'number',
				label: 'Compression Quality (1-100, 0 is automatic)',
				id: 'compression',
				default: 0,
				min: 0,
				max: 100,
				range: false,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: 'programScene',
				choices: [
					{ id: 'programScene', label: 'Current Scene' },
					{ id: 'custom', label: 'Custom' },
				],
			},
			{
				type: 'dropdown',
				label: 'Custom Source / Scene',
				id: 'custom',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
				isVisible: (options) => options.source === 'custom',
			},
			{
				type: 'checkbox',
				label: 'Use Custom Path / Filename',
				default: false,
				id: 'customName',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom File Path',
				tooltip: 'Optional, leave blank to use the recording path',
				id: 'path',
				isVisible: (options) => options.customName === true,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Custom File Name',
				default: 'Screenshot_$(internal:date_iso)_$(internal:time_hms)',
				tooltip: 'Optional, leave blank to use the format "YYYY-MM-DD_SourceName_HH-MM-SS"',
				id: 'fileName',
				isVisible: (options) => options.customName === true,
			},
		],
		callback: async (action) => {
			//Get date for default filename
			const date = new Date().toISOString()
			const day = date.slice(0, 10)
			const time = date.slice(11, 19).replace(/:/g, '-')

			const sourceName = action.options.source === 'programScene' ? this.states.programScene : action.options.custom
			const fileName =
				action.options.customName && action.options.fileName
					? (action.options.fileName as string).replace(/:/g, '-')
					: `${day}_${sourceName}_${time} `
			const fileLocation =
				action.options.customName && action.options.path ? (action.options.path as string) : this.states.recordDirectory
			const filePath = `${fileLocation}/${fileName}.${action.options.format}`

			const quality = action.options.compression == 0 ? -1 : action.options.compression

			await this.sendRequest('SaveSourceScreenshot', {
				sourceName: sourceName,
				imageFormat: action.options.format,
				imageFilePath: filePath,
				imageCompressionQuality: quality,
			})
		},
	}
	actions['toggle_filter'] = {
		name: 'Set Filter Visibility',
		options: [
			{
				type: 'dropdown',
				label: 'Source / Scene',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
				allowCustom: true,
			},
			{
				type: 'checkbox',
				label: 'All Filters',
				id: 'all',
				default: false,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: this.filterListDefault,
				choices: this.filterList,
				allowCustom: true,
				isVisible: (options) => options.all === false,
			},
			{
				type: 'dropdown',
				label: 'Visibility',
				id: 'visible',
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: 'Toggle' },
					{ id: 'true', label: 'On' },
					{ id: 'false', label: 'Off' },
				],
			},
		],
		callback: async (action) => {
			const source = action.options.source as string
			const filterName = action.options.filter as string

			const sourceFilterList = this.sourceFilters[source]
			if (action.options.all) {
				const requests: any[] = []
				sourceFilterList.forEach((filter) => {
					const name = filter.filterName
					let filterVisibility
					if (action.options.visible !== 'toggle') {
						filterVisibility = action.options.visible === 'true' ? true : false
					} else if (action.options.visible === 'toggle') {
						filterVisibility = !filter.filterEnabled
					}
					requests.push({
						requestType: 'SetSourceFilterEnabled',
						requestData: { sourceName: source, filterName: name, filterEnabled: filterVisibility },
					})
				})

				await this.sendBatch(requests)
			} else {
				let filterVisibility
				if (action.options.visible !== 'toggle') {
					filterVisibility = action.options.visible === 'true' ? true : false
				} else if (action.options.visible === 'toggle') {
					if (sourceFilterList) {
						const filter = sourceFilterList.find((item) => item.filterName === filterName)
						if (filter) {
							filterVisibility = !filter.filterEnabled
						}
					}
				}

				await this.sendRequest('SetSourceFilterEnabled', {
					sourceName: source,
					filterName: filterName,
					filterEnabled: filterVisibility,
				})
			}
		},
	}
	actions['setFilterSettings'] = {
		name: 'Set Filter Settings',
		options: [
			{
				type: 'dropdown',
				label: 'Source / Scene',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: this.filterListDefault,
				choices: this.filterList,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Filter Settings',
				id: 'settings',
				default: '{"left": 100, "top": 0, "right": 100, "bottom": 0}',
				tooltip: 'Must be a JSON object with the settings for the filter',
			},
		],
		callback: async (action) => {
			try {
				const settings = action.options.settings as string
				const settingsJSON = JSON.parse(settings)
				await this.sendRequest('SetSourceFilterSettings', {
					sourceName: action.options.source,
					filterName: action.options.filter,
					filterSettings: settingsJSON,
				})
			} catch (e: any) {
				this.log('warn', `Error parsing JSON for Set Filter Settings (${e.message})`)
				return
			}
		},
	}
	actions['play_pause_media'] = {
		name: 'Play / Pause Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
			{
				type: 'dropdown',
				label: 'Action',
				id: 'playPause',
				default: 'toggle',
				choices: [
					{ id: 'toggle', label: 'Toggle' },
					{ id: 'false', label: 'Play' },
					{ id: 'true', label: 'Pause' },
				],
			},
		],
		callback: async (action) => {
			let playPause = action.options.playPause
			const media =
				action.options.source === 'currentMedia' ? this.states.currentMedia : (action.options.source as string)
			if (action.options.playPause === 'toggle' && media) {
				if (this.mediaSources[media]?.mediaState == 'OBS_MEDIA_STATE_PLAYING') {
					playPause = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE'
				} else {
					playPause = 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY'
				}
			} else {
				playPause =
					action.options.playPause == 'true'
						? 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE'
						: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PLAY'
			}
			await this.sendRequest('TriggerMediaInputAction', {
				inputName: media,
				mediaAction: playPause,
			})
		},
	}
	actions['restart_media'] = {
		name: 'Restart Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
		],
		callback: async (action) => {
			await this.sendRequest('TriggerMediaInputAction', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
			})
		},
	}
	actions['stop_media'] = {
		name: 'Stop Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
		],
		callback: async (action) => {
			await this.sendRequest('TriggerMediaInputAction', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
			})
		},
	}
	actions['next_media'] = {
		name: 'Next Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
		],
		callback: async (action) => {
			await this.sendRequest('TriggerMediaInputAction', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
			})
		},
	}
	actions['previous_media'] = {
		name: 'Previous Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
		],
		callback: async (action) => {
			await this.sendRequest('TriggerMediaInputAction', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
			})
		},
	}
	actions['set_media_time'] = {
		name: 'Set Media Time',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
			{
				type: 'number',
				label: 'Time (in ms)',
				id: 'mediaTime',
				default: 1,
				min: 0,
				max: 24 * 60 * 60 * 1000,
				range: false,
			},
		],
		callback: async (action) => {
			const inputName =
				action.options.source === 'currentMedia' ? this.states.currentMedia : (action.options.source as string)
			const mediaTime = action.options.mediaTime as number
			await this.sendRequest('SetMediaInputCursor', {
				inputName: inputName,
				mediaCursor: mediaTime,
			})
		},
	}
	actions['scrub_media'] = {
		name: 'Scrub Media',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
			{
				type: 'number',
				label: 'Scrub Amount (in seconds, positive or negative)',
				id: 'scrubAmount',
				default: 1,
				min: -3600, // 1 hour back
				max: 3600, // 1 hour forward
			},
		],
		callback: async (action) => {
			const inputName =
				action.options.source === 'currentMedia' ? this.states.currentMedia : (action.options.source as string)
			const scrubAmount = action.options.scrubAmount as number
			await this.sendRequest('OffsetMediaInputCursor', {
				inputName: inputName,
				mediaCursorOffset: scrubAmount * 1000,
			})
		},
	}
	actions['updateMediaLocalFile'] = {
		name: 'Update Media Source Local File Path',
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: 'currentMedia',
				choices: this.mediaSourceListCurrentMedia,
			},
			{
				type: 'textinput',
				label: 'File Path',
				id: 'mediaFilePath',
				useVariables: true,
				default: '',
			},
		],
		callback: async (action) => {
			const mediaFilePath = action.options.mediaFilePath as string
			const inputName =
				action.options.source === 'currentMedia' ? this.states.currentMedia : (action.options.source as string)
			try {
				const input = await this.sendRequest('GetInputSettings', {
					inputName: inputName,
				})
				if (input?.inputSettings?.local_file) {
					await this.sendRequest('SetInputSettings', {
						inputName: inputName,
						inputSettings: {
							local_file: mediaFilePath,
						},
					})
				} else {
					this.log('warn', `Unable to update media file for ${inputName} because it is not a local file input`)
				}
			} catch (e: any) {
				this.log('warn', `Error updating media file: ${e.message}`)
				return
			}
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
				choices: this.monitors,
				isVisible: (options): boolean => options.window === 'fullscreen',
			},
			{
				type: 'dropdown',
				label: 'Source / Scene (required if selected as projector type)',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
				isVisible: (options): boolean => options.type === 'Source' || options.type === 'Scene',
			},
		],
		callback: async (action) => {
			const monitor = action.options.window === 'window' ? -1 : (action.options.display as number)
			let requestType: string
			let requestData: any
			if (action.options.type === 'Multiview') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_MULTIVIEW',
					monitorIndex: monitor,
				}
			} else if (action.options.type === 'Preview') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PREVIEW',
					monitorIndex: monitor,
				}
			} else if (action.options.type === 'StudioProgram') {
				requestType = 'OpenVideoMixProjector'
				requestData = {
					videoMixType: 'OBS_WEBSOCKET_VIDEO_MIX_TYPE_PROGRAM',
					monitorIndex: monitor,
				}
			} else if (action.options.type === 'Source' || action.options.type === 'Scene') {
				requestType = 'OpenSourceProjector'
				requestData = {
					sourceName: action.options.source as string,
					monitorIndex: monitor,
				}
			} else {
				return
			}
			await this.sendRequest(requestType, requestData)
		},
	}
	actions['source_properties'] = {
		name: 'Set Source Transform',
		description: 'All transform values optional, any parameter left blank is ignored',
		options: [
			{
				type: 'dropdown',
				label: 'Scene (optional, defaults to current scene)',
				id: 'scene',
				default: 'Current Scene',
				choices: this.sceneChoicesProgramPreview,
			},
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Position - X (pixels)',
				id: 'positionX',
				default: '',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Position - Y (pixels)',
				id: 'positionY',
				default: '',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Scale - X (multiplier, 1 is 100%)',
				id: 'scaleX',
				default: '',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Scale - Y (multiplier, 1 is 100%)',
				id: 'scaleY',
				default: '',
			},
			{
				type: 'textinput',
				useVariables: true,
				label: 'Rotation (degrees clockwise)',
				id: 'rotation',
				default: '',
			},
		],
		callback: async (action) => {
			let sourceScene: string
			if (action.options.scene == 'Current Scene') {
				sourceScene = this.states.programScene ?? ''
			} else if (action.options.scene == 'Preview Scene') {
				sourceScene = this.states.previewScene ?? ''
			} else {
				sourceScene = action.options.scene as string
			}

			const positionX = action.options.positionX as string
			const positionY = action.options.positionY as string
			const scaleX = action.options.scaleX as string
			const scaleY = action.options.scaleY as string
			const rotation = action.options.rotation as string

			const transform: { [key: string]: number } = {}
			if (positionX) {
				transform.positionX = Number(positionX)
			}
			if (positionY) {
				transform.positionY = Number(positionY)
			}
			if (scaleX) {
				transform.scaleX = Number(scaleX)
			}
			if (scaleY) {
				transform.scaleY = Number(scaleY)
			}
			if (rotation) {
				transform.rotation = Number(rotation)
			}

			try {
				const sceneItem = await this.sendRequest('GetSceneItemId', {
					sceneName: sourceScene,
					sourceName: action.options.source as string,
				})

				if (sceneItem?.sceneItemId) {
					await this.sendRequest('SetSceneItemTransform', {
						sceneName: sourceScene,
						sceneItemId: sceneItem?.sceneItemId,
						sceneItemTransform: transform,
					})
				} else {
					this.log('warn', `Scene item not found for source: ${action.options.source} in scene: ${sourceScene}`)
					return
				}
			} catch (e: any) {
				this.log('error', `Set Scene Item Properties Error: ${e.message}`)
			}
		},
	}
	actions['openInputPropertiesDialog'] = {
		name: 'Open Source Properties Window',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			await this.sendRequest('OpenInputPropertiesDialog', { inputName: action.options.source as string })
		},
	}
	actions['openInputFiltersDialog'] = {
		name: 'Open Source Filters Window',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			await this.sendRequest('OpenInputFiltersDialog', { inputName: action.options.source as string })
		},
	}
	actions['openInputInteractDialog'] = {
		name: 'Open Source Interact Window',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			await this.sendRequest('OpenInputInteractDialog', { inputName: action.options.source as string })
		},
	}
	actions['triggerInputActivateState'] = {
		name: 'Trigger Input Activate State',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoices,
			},
		],
		callback: async (action) => {
			const source = action.options.source as string
			await this.sendRequest('TriggerInputActivateState', { inputName: source })
		},
	}
	actions['custom_command'] = {
		name: 'Custom Command',
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
			const command = action.options.command as string
			let arg: any = ''
			try {
				command.replace(/ /g, '')
			} catch (e: any) {
				this.log('warn', `Unknown command format: ${e.message}`)
				return
			}

			if (action.options.arg) {
				arg = action.options.arg as string
				try {
					arg = JSON.parse(arg)
				} catch (e: any) {
					this.log('warn', `Request data must be formatted as valid JSON. ${e.message}`)
					return
				}
			}

			try {
				const res = await this.sendRequest(command as any, arg ? arg : {})
				this.log('debug', `Custom Command Response: ${JSON.stringify(res)}`)
			} catch (e: any) {
				this.log('warn', `Custom Command Error: ${e.message}`)
			}
		},
	}
	actions['vendorRequest'] = {
		name: 'Custom Vendor Request',
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
			const vendorName = action.options.vendorName as string
			const requestType = action.options.requestType as string
			let requestData = ''
			try {
				vendorName.replace(/ /g, '')
				requestType.replace(/ /g, '')
			} catch (e: any) {
				this.log('warn', `Unknown vendor or request format ${e.message}`)
				return
			}

			if (action.options.requestData) {
				requestData = action.options.requestData as string
				try {
					requestData = JSON.parse(requestData)
				} catch (e: any) {
					this.log('warn', `Request data must be formatted as valid JSON. ${e.message}`)
					return
				}
			}
			const data = {
				vendorName: vendorName,
				requestType: requestType,
				requestData: requestData,
			}
			await this.sendRequest('CallVendorRequest', data)
		},
	}

	return actions
}
