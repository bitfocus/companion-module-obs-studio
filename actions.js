import hotkeys from './hotkeys.js'

export function getActions() {
	let actions = {}

	actions['enable_studio_mode'] = {
		name: 'Enable Studio Mode',
		options: [],
		callback: () => {
			this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: true })
		},
	}
	actions['disable_studio_mode'] = {
		name: 'Disable Studio Mode',
		options: [],
		callback: () => {
			this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: false })
		},
	}
	actions['toggle_studio_mode'] = {
		name: 'Toggle Studio Mode',
		options: [],
		callback: () => {
			this.sendRequest('SetStudioModeEnabled', { studioModeEnabled: this.states.studioMode ? false : true })
		},
	}
	actions['start_recording'] = {
		name: 'Start Recording',
		options: [],
		callback: () => {
			this.sendRequest('StartRecord')
		},
	}
	actions['stop_recording'] = {
		name: 'Stop Recording',
		options: [],
		callback: () => {
			this.sendRequest('StopRecord')
		},
	}
	actions['pause_recording'] = {
		name: 'Pause Recording',
		options: [],
		callback: () => {
			this.sendRequest('PauseRecord')
		},
	}
	actions['resume_recording'] = {
		name: 'Resume Recording',
		options: [],
		callback: () => {
			this.sendRequest('ResumeRecord')
		},
	}
	actions['ToggleRecordPause'] = {
		name: 'Toggle Recording Pause',
		options: [],
		callback: () => {
			this.sendRequest('ToggleRecordPause')
		},
	}
	actions['start_streaming'] = {
		name: 'Start Streaming',
		options: [],
		callback: () => {
			this.sendRequest('StartStream')
		},
	}
	actions['stop_streaming'] = {
		name: 'Stop Streaming',
		options: [],
		callback: () => {
			this.sendRequest('StopStream')
		},
	}
	actions['StartStopStreaming'] = {
		name: 'Toggle Streaming',
		options: [],
		callback: () => {
			this.sendRequest('ToggleStream')
		},
	}
	actions['start_replay_buffer'] = {
		name: 'Start Replay Buffer',
		options: [],
		callback: () => {
			this.sendRequest('StartReplayBuffer')
		},
	}
	actions['stop_replay_buffer'] = {
		name: 'Stop Replay Buffer',
		options: [],
		callback: () => {
			this.sendRequest('StopReplayBuffer')
		},
	}
	actions['save_replay_buffer'] = {
		name: 'Save Replay Buffer',
		options: [],
		callback: () => {
			this.sendRequest('SaveReplayBuffer')
		},
	}
	actions['ToggleReplayBuffer'] = {
		name: 'Toggle Replay Buffer',
		options: [],
		callback: () => {
			this.sendRequest('ToggleReplayBuffer')
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
			if (action.options.scene === 'customSceneName') {
				const scene = await this.parseVariablesInString(action.options.customSceneName)
				this.sendRequest('SetCurrentProgramScene', { sceneName: scene })
			} else {
				this.sendRequest('SetCurrentProgramScene', { sceneName: action.options.scene })
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
		],
		callback: async (action) => {
			if (action.options.scene === 'customSceneName') {
				const scene = await this.parseVariablesInString(action.options.customSceneName)
				this.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			} else {
				this.sendRequest('SetCurrentPreviewScene', { sceneName: action.options.scene })
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
			let scene = action.options.scene
			if (action.options.scene === 'customSceneName') {
				scene = await this.parseVariablesInString(action.options.customSceneName)
			}

			if (this.states.previewScene == scene && this.states.programScene != scene) {
				this.sendRequest('TriggerStudioModeTransition')
			} else {
				this.sendRequest('SetCurrentPreviewScene', { sceneName: scene })
			}
		},
	}
	actions['previewPreviousScene'] = {
		name: 'Preview Previous Scene',
		options: [],
		callback: () => {
			if (this.states.previewScene) {
				let previewScene = this.scenes.find((scene) => scene.sceneName === this.states.previewScene)
				let previousIndex = previewScene?.sceneIndex + 1
				let previousScene = this.scenes.find((scene) => scene.sceneIndex === previousIndex)
				if (previousScene) {
					this.sendRequest('SetCurrentPreviewScene', { sceneName: previousScene.sceneName })
				}
			}
		},
	}
	actions['previewNextScene'] = {
		name: 'Preview Next Scene',
		options: [],
		callback: () => {
			if (this.states.previewScene) {
				let previewScene = this.scenes.find((scene) => scene.sceneName === this.states.previewScene)
				let nextIndex = previewScene?.sceneIndex - 1
				let nextScene = this.scenes.find((scene) => scene.sceneIndex === nextIndex)
				if (nextScene) {
					this.sendRequest('SetCurrentPreviewScene', { sceneName: nextScene.sceneName })
				}
			}
		},
	}
	actions['do_transition'] = {
		name: 'Transition',
		description: 'Transitions preview to program in Studio Mode',
		options: [],
		callback: () => {
			if (this.states.studioMode) {
				this.sendRequest('TriggerStudioModeTransition')
			} else {
				this.log(
					'warn',
					'The Transition action requires OBS to be in Studio Mode. Try switching to Studio Mode, or using the Change Scene action instead'
				)
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
		callback: (action) => {
			if (action.options.transition == 'Default' && !action.options.customDuration) {
				this.sendRequest('TriggerStudioModeTransition')
			} else {
				let transitionWaitTime
				let transitionDuration
				let revertTransition = this.states.currentTransition
				let revertTransitionDuration = this.states.transitionDuration > 0 ? this.states.transitionDuration : 500

				if (action.options.transition == 'Cut') {
					transitionWaitTime = 100
				} else if (action.options.transition != 'Cut' && action.options.customDuration) {
					transitionWaitTime =
						action.options.transition_time > 50 ? action.options.transition_time + 100 : revertTransitionDuration + 100
				} else {
					transitionWaitTime = revertTransitionDuration + 100
				}

				if (action.options.customDuration) {
					transitionDuration =
						action.options.transition_time != null ? action.options.transition_time : revertTransitionDuration
				} else {
					transitionDuration = revertTransitionDuration
				}

				this.sendBatch([
					{
						requestType: 'SetCurrentSceneTransition',
						requestData: { transitionName: action.options.transition },
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
			},
		],
		callback: (action) => {
			this.sendRequest('SetCurrentSceneTransition', { transitionName: action.options.transitions })
		},
	}
	actions['set_transition_duration'] = {
		name: 'Set Transition Duration',
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				id: 'duration',
				default: null,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
			},
		],
		callback: (action) => {
			this.sendRequest('SetCurrentSceneTransitionDuration', { transitionDuration: action.options.duration })
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
					{ id: 'rtmp_custom', label: 'Custom' },
				],
				default: 'rtmp_custom',
			},
			{
				type: 'textinput',
				label: 'Stream URL',
				id: 'streamURL',
				default: '',
				isVisible: (options) => options.streamType === 'rtmp_custom',
			},
			{
				type: 'textinput',
				label: 'Stream Key',
				id: 'streamKey',
				default: '',
			},
			{
				type: 'checkbox',
				label: 'Use Authentication',
				id: 'streamAuth',
				default: false,
				isVisible: (options) => options.streamType === 'rtmp_custom',
			},
			{
				type: 'textinput',
				label: 'User Name (Optional)',
				id: 'streamUserName',
				default: '',
				isVisible: (options) => options.streamType === 'rtmp_custom',
			},
			{
				type: 'textinput',
				label: 'Password (Optional)',
				id: 'streamPassword',
				default: '',
				isVisible: (options) => options.streamType === 'rtmp_custom',
			},
		],
		callback: (action) => {
			let streamServiceSettings = {
				key: action.options.streamKey,
				server: action.options.streamURL,
				use_auth: action.options.streamAuth,
				username: action.options.streamUserName,
				password: action.options.streamPassword,
			}
			let streamServiceType = action.options.streamType

			this.sendRequest('SetStreamServiceSettings', {
				streamServiceType: streamServiceType,
				streamServiceSettings: streamServiceSettings,
			})
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
				let captionText = await this.parseVariablesInString(action.options.customSceneName)
				this.sendRequest('SendStreamCaption', { captionText: captionText })
			}
		},
	}
	actions['StartStopRecording'] = {
		name: 'Toggle Recording',
		options: [],
		callback: () => {
			this.sendRequest('ToggleRecord')
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
		callback: (action) => {
			this.sendRequest('SetInputMute', {
				inputName: action.options.source,
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
		callback: (action) => {
			this.sendRequest('ToggleInputMute', { inputName: action.options.source })
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
		callback: (action) => {
			this.sendRequest('SetInputVolume', { inputName: action.options.source, inputVolumeDb: action.options.volume })
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
				range: false,
			},
		],
		callback: (action) => {
			let newVolume = this.sources[action.options.source].inputVolume + action.options.volume
			if (newVolume > 26) {
				newVolume = 26
			} else if (newVolume < -100) {
				newVolume = -100
			}

			this.sendRequest('SetInputVolume', { inputName: action.options.source, inputVolumeDb: newVolume })
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
		callback: (action) => {
			//Standard offset values (aka how the OBS code determines slider percentage)
			let LOG_RANGE_DB = 96.0
			let LOG_OFFSET_DB = 6.0
			let LOG_OFFSET_VAL = -0.77815125038364363
			let LOG_RANGE_VAL = -2.00860017176191756

			//Calculate current "percent" of volume slider in OBS
			let dB = this.sources[action.options.source].inputVolume
			let currentPercent = 0.0
			if (dB >= 0.0) {
				currentPercent = 100.0
			} else if (dB <= -96.0) {
				currentPercent = 0.0
			} else {
				currentPercent = ((-Math.log10(-dB + 6.0) - LOG_RANGE_VAL) / (LOG_OFFSET_VAL - LOG_RANGE_VAL)) * 100.0
			}

			//Calculate new "percent" of volume slider
			let percentAdjustment = Math.abs(action.options.percent)

			let newPercent
			if (action.options.percent > 0) {
				newPercent = currentPercent + percentAdjustment
			} else {
				newPercent = currentPercent - percentAdjustment
			}
			newPercent = newPercent / 100
			let newDb
			if (newPercent >= 1.0) {
				newDb = 0.0
			} else if (newPercent <= 0.0) {
				newDb = -100.0
			} else {
				newDb =
					-(LOG_RANGE_DB + LOG_OFFSET_DB) * Math.pow((LOG_RANGE_DB + LOG_OFFSET_DB) / LOG_OFFSET_DB, -newPercent) +
					LOG_OFFSET_DB
			}

			this.sendRequest('SetInputVolume', { inputName: action.options.source, inputVolumeDb: newDb })
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
		callback: (action) => {
			this.sendRequest('SetInputAudioSyncOffset', {
				inputName: action.options.source,
				inputAudioSyncOffset: action.options.offset,
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
		callback: (action) => {
			this.sendRequest('SetInputAudioBalance', {
				inputName: action.options.source,
				inputAudioBalance: action.options.balance,
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
		callback: (action) => {
			let sceneName = action.options.scene
			let sourceName = action.options.source
			let enabled = true
			let requests = []

			// special scene names
			if (sceneName === 'Current Scene') {
				sceneName = this.states.programScene
			} else if (sceneName === 'Preview Scene') {
				sceneName = this.states.previewScene
			}

			if (this.sources[sourceName]?.groupedSource) {
				let group = this.sources[sourceName].groupName
				let source = this.groups[group].find((item) => item.sourceName === sourceName)
				if (action.options.visible === 'toggle') {
					enabled = !source.sceneItemEnabled
				} else {
					enabled = action.options.visible == 'true' ? true : false
				}
				this.sendRequest('SetSceneItemEnabled', {
					sceneName: source.groupName,
					sceneItemId: source.sceneItemId,
					sceneItemEnabled: enabled,
				})
			}
			let targetScene = this.sceneItems[sceneName]
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
							for (let x in this.groups[source.sourceName]) {
								let item = this.groups[source.sourceName][x]
								let groupEnabled
								if (action.options.visible === 'toggle') {
									groupEnabled = !this.sources[item.sourceName].sceneItemEnabled
								} else {
									groupEnabled = action.options.visible == 'true' ? true : false
								}
								requests.push({
									requestType: 'SetSceneItemEnabled',
									requestData: {
										sceneName: source.sourceName,
										sceneItemId: item.sceneItemId,
										sceneItemEnabled: groupEnabled,
									},
								})
							}
						}
					}
				})
				this.sendBatch(requests)
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
			let newText = await this.parseVariablesInString(action.options.text)

			this.sendRequest('SetInputSettings', { inputName: action.options.source, inputSettings: { text: newText } })
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
			},
		],
		callback: (action) => {
			this.sendRequest('TriggerHotkeyByName', { hotkeyName: action.options.id })
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
		callback: (action) => {
			let keyModifiers = {
				shift: action.options.keyShift,
				alt: action.options.keyAlt,
				control: action.options.keyControl,
				command: action.options.keyCommand,
			}

			this.sendRequest('TriggerHotkeyByKeySequence', {
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
		callback: (action) => {
			this.sendRequest('SetCurrentProfile', { profileName: action.options.profile })
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
		callback: (action) => {
			this.sendRequest('SetCurrentSceneCollection', { sceneCollectionName: action.options.scene_collection })
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
		callback: (action) => {
			if (action.options.output === 'virtualcam_output') {
				this.sendRequest('StartVirtualCam')
			} else {
				this.sendRequest('StartOutput', {
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
		callback: (action) => {
			if (action.options.output === 'virtualcam_output') {
				this.sendRequest('StopVirtualCam')
			} else {
				this.sendRequest('StopOutput', {
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
		callback: (action) => {
			if (action.options.output === 'virtualcam_output') {
				this.sendRequest('ToggleVirtualCam')
			} else {
				this.sendRequest('ToggleOutput', {
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
		callback: (action) => {
			if (this.sources[action.options.source]?.inputKind == 'browser_source') {
				this.sendRequest('PressInputPropertiesButton', {
					inputName: action.options.source,
					propertyName: 'refreshnocache',
				})
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
		callback: (action) => {
			let monitorType
			if (action.options.monitor === 'monitorAndOutput') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
			} else if (action.options.monitor === 'monitorOnly') {
				monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
			} else {
				monitorType = 'OBS_MONITORING_TYPE_NONE'
			}
			this.sendRequest('SetInputAudioMonitorType', { inputName: action.options.source, monitorType: monitorType })
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
				label: 'Source (Optional, default is current scene)',
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
				choices: this.sourceChoices,
				isVisible: (options) => options.source === 'custom',
			},
			{
				type: 'textinput',
				label: 'Custom File Path (Optional, default is recording path)',
				id: 'path',
			},
		],
		callback: (action) => {
			let date = new Date().toISOString()
			let day = date.slice(0, 10)
			let time = date.slice(11, 19).replace(/:/g, '-')

			let fileName = action.options.source === 'programScene' ? this.states.programScene : action.options.custom
			let fileLocation = action.options.path ? action.options.path : this.states.recordDirectory
			let filePath = fileLocation + '/' + day + '_' + fileName + '_' + time + '.' + action.options.format
			let quality = action.options.compression == 0 ? -1 : action.options.compression

			this.sendRequest('SaveSourceScreenshot', {
				sourceName: fileName,
				imageFormat: action.options.format,
				imageFilePath: filePath,
				imageCompressionQuality: quality,
			})
		},
	}
	actions['toggle_filter'] = {
		name: 'Set Source Filter Visibility',
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
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
		callback: (action) => {
			let sourceFilterList = this.sourceFilters[action.options.source]
			if (action.options.all) {
				let requests = []
				sourceFilterList.forEach((filter) => {
					let name = filter.filterName
					let filterVisibility
					if (action.options.visible !== 'toggle') {
						filterVisibility = action.options.visible === 'true' ? true : false
					} else if (action.options.visible === 'toggle') {
						filterVisibility = !filter.filterEnabled
					}
					requests.push({
						requestType: 'SetSourceFilterEnabled',
						requestData: { sourceName: action.options.source, filterName: name, filterEnabled: filterVisibility },
					})
				})

				this.sendBatch(requests)
			} else {
				let filterVisibility
				if (action.options.visible !== 'toggle') {
					filterVisibility = action.options.visible === 'true' ? true : false
				} else if (action.options.visible === 'toggle') {
					if (sourceFilterList) {
						let filter = sourceFilterList.find((item) => item.filterName === action.options.filter)
						if (filter) {
							filterVisibility = !filter.filterEnabled
						}
					}
				}

				this.sendRequest('SetSourceFilterEnabled', {
					sourceName: action.options.source,
					filterName: action.options.filter,
					filterEnabled: filterVisibility,
				})
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
		callback: (action) => {
			let playPause
			let media = action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source
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
			this.sendRequest('TriggerMediaInputAction', {
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
		callback: (action) => {
			this.sendRequest('TriggerMediaInputAction', {
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
		callback: (action) => {
			this.sendRequest('TriggerMediaInputAction', {
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
		callback: (action) => {
			this.sendRequest('TriggerMediaInputAction', {
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
		callback: (action) => {
			this.sendRequest('TriggerMediaInputAction', {
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
				label: 'Timecode (in seconds)',
				id: 'mediaTime',
				default: 1,
			},
		],
		callback: (action) => {
			this.sendRequest('SetMediaInputCursor', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaCursor: action.options.mediaTime * 1000,
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
			},
		],
		callback: (action) => {
			this.sendRequest('OffsetMediaInputCursor', {
				inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
				mediaCursorOffset: action.options.scrubAmount * 1000,
			})
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
				isVisible: (options) => options.window === 'fullscreen',
			},
			{
				type: 'dropdown',
				label: 'Source / Scene (required if selected as projector type)',
				id: 'source',
				default: this.sourceListDefault,
				choices: this.sourceChoicesWithScenes,
				isVisible: (options) => options.type === 'Source' || options.type === 'Scene',
			},
		],
		callback: (action) => {
			let monitor = action.options.window === 'window' ? -1 : action.options.display
			let requestType
			let requestData
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
					sourceName: action.options.source,
					monitorIndex: monitor,
				}
			}
			this.sendRequest(requestType, requestData)
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
			let sourceScene
			if (action.options.scene == 'Current Scene') {
				sourceScene = this.states.programScene
			} else if (action.options.scene == 'Preview Scene') {
				sourceScene = this.states.previewScene
			} else {
				sourceScene = action.options.scene
			}

			let positionX = await this.parseVariablesInString(action.options.positionX)
			let positionY = await this.parseVariablesInString(action.options.positionY)
			let scaleX = await this.parseVariablesInString(action.options.scaleX)
			let scaleY = await this.parseVariablesInString(action.options.scaleY)
			let rotation = await this.parseVariablesInString(action.options.rotation)

			let transform = {
				positionX: positionX,
				positionY: positionY,
				rotation: rotation,
				scaleX: scaleX,
				scaleY: scaleY,
			}

			this.obs.call('GetSceneItemId', { sceneName: sourceScene, sourceName: action.options.source }).then((data) => {
				if (data.sceneItemId) {
					requestType = 'SetSceneItemTransform'
					requestData = {
						sceneName: sourceScene,
						sceneItemId: data.sceneItemId,
						sceneItemTransform: transform,
					}
					this.sendRequest(requestType, requestData)
				}
			})
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
		callback: (action) => {
			this.sendRequest('OpenInputPropertiesDialog', { inputName: action.options.source })
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
		callback: (action) => {
			this.sendRequest('OpenInputFiltersDialog', { inputName: action.options.source })
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
		callback: (action) => {
			this.sendRequest('OpenInputInteractDialog', { inputName: action.options.source })
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
			let command = await this.parseVariablesInString(action.options.command)
			let arg = ''
			try {
				command.replace(/ /g, '')
			} catch (e) {
				this.log('warn', 'Request data must be formatted as valid JSON.')
				return
			}

			if (action.options.arg) {
				arg = await this.parseVariablesInString(action.options.arg)
				try {
					arg = JSON.parse(arg)
				} catch (e) {
					this.log('warn', 'Request data must be formatted as valid JSON.')
					return
				}
			}
			this.sendRequest(command, arg ? arg : {})
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
			let vendorName = await this.parseVariablesInString(action.options.vendorName)
			let requestType = await this.parseVariablesInString(action.options.requestType)
			let requestData = ''
			try {
				vendorName.replace(/ /g, '')
				requestType.replace(/ /g, '')
			} catch (e) {
				this.log('warn', 'Unknown vendor or request format')
				return
			}

			if (action.options.requestData) {
				requestData = await this.parseVariablesInString(action.options.requestData)
				try {
					requestData = JSON.parse(requestData)
				} catch (e) {
					this.log('warn', 'Request data must be formatted as valid JSON.')
					return
				}
			}
			let data = {
				vendorName: vendorName,
				requestType: requestType,
				requestData: requestData,
			}
			this.sendRequest('CallVendorRequest', data)
		},
	}

	return actions
}
