const instance_skel = require('../../instance_skel')
const actions = require('./actions')
const presets = require('./presets')
const { updateVariableDefinitions } = require('./variables')
const { initFeedbacks } = require('./feedbacks')
const upgradeScripts = require('./upgrades')

const { EventSubscription } = require('obs-websocket-js')
const OBSWebSocket = require('obs-websocket-js').default

let debug
let log

class instance extends instance_skel {
	constructor(system, id, config) {
		super(system, id, config)

		Object.assign(this, {
			...actions,
			...presets,
		})

		this.updateVariableDefinitions = updateVariableDefinitions
	}

	static GetUpgradeScripts() {
		return [
			upgradeScripts.v2_0_0,
			instance_skel.CreateConvertToBooleanFeedbackUpgradeScript({
				streaming: true,
				scene_item_active: true,
				profile_active: true,
				scene_collection_active: true,
				scene_item_active_in_scene: true,
				output_active: true,
				transition_active: true,
				current_transition: true,
				transition_duration: true,
				filter_enabled: true,
			}),
		]
	}
	//COMMENT THIS OUT
	//static DEVELOPER_forceStartupUpgradeScript = 0
	config_fields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Server IP',
				width: 8,
				regex: this.REGEX_IP,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Server Port',
				width: 4,
				default: 4455,
				regex: this.REGEX_PORT,
			},
			{
				type: 'textinput',
				id: 'pass',
				label: 'Server Password',
				width: 4,
			},
		]
	}

	updateConfig(config) {
		this.config = config

		this.status(this.STATUS_WARNING, 'Connecting')
		if (this.config.host && this.config.port) {
			this.connectOBS()
		} else {
			this.log('warn', 'Please ensure your websocket server IP and server port are correct in the module settings')
		}
	}

	destroy() {
		debug('destroy', this.id)
		this.disconnectOBS()
		this.stopReconnectionPoll()
	}

	init() {
		debug = this.debug
		log = this.log

		this.status(this.STATUS_WARNING, 'Connecting')
		if (this.config.host) {
			this.connectOBS()
		}
	}

	initVariables() {
		this.updateVariableDefinitions()
	}

	async connectOBS() {
		if (this.obs) {
			await this.obs.disconnect()
		} else {
			this.obs = new OBSWebSocket()
		}
		try {
			const { obsWebSocketVersion, negotiatedRpcVersion } = await this.obs.connect(
				`ws:///${this.config.host}:${this.config.port}`,
				this.config.pass,
				{
					eventSubscriptions:
						EventSubscription.All |
						EventSubscription.Ui |
						EventSubscription.InputActiveStateChanged |
						EventSubscription.InputShowStateChanged |
						EventSubscription.SceneItemTransformChanged,
					rpcVersion: 1,
				}
			)
			if (obsWebSocketVersion) {
				this.status(this.STATUS_OK)
				this.stopReconnectionPoll()
				this.log('info', 'Connected to OBS')
				this.obsListeners()

				//Setup Initial State Objects
				this.initializeStates()

				//Get Initial Info
				this.obsInfo()
				this.getStats()
				this.getRecordStatus()
				this.getStreamStatus()
				this.getProfileList()
				this.getSceneTransitionList()
				this.getSceneCollectionList()
				this.getScenesSources()
				this.startStatsPoll()
			}
		} catch (error) {
			this.debug(error)
			if (!this.reconnectionPoll) {
				this.startReconnectionPoll()
			}
			if (this.currentStatus != 2) {
				this.status(this.STATUS_ERROR)
				if (error?.message.match(/(Server sent no subprotocol)/i)) {
					this.log('error', 'Failed to connect to OBS. Please upgrade OBS Websocket to version 5.0.0 or above')
				} else if (error?.message.match(/(missing an `authentication` string)/i)) {
					this.log('error', `Failed to connect to OBS. Please enter your obs-websocket password in the module settings`)
				} else if (error?.message.match(/(Authentication failed)/i)) {
					this.log(
						'error',
						`Failed to connect to OBS. Please ensure your obs-websocket password is correct in the module settings`
					)
				} else {
					this.log('error', `Failed to connect to OBS (${error.message})`)
				}
			}
		}
	}

	async disconnectOBS() {
		if (this.obs) {
			await this.obs.disconnect()
			//Clear all active polls
			this.stopStatsPoll()
			this.stopMediaPoll()
		}
	}

	async obsListeners() {
		//General
		this.obs.once('ExitStarted', () => {
			this.log('error', 'OBS closed, connection lost')
			this.status(this.STATUS_ERROR)
			this.disconnectOBS()
			if (!this.reconnectionPoll) {
				this.startReconnectionPoll()
			}
		})
		this.obs.on('VendorEvent', () => {})
		//Config
		this.obs.on('CurrentSceneCollectionChanging', () => {
			this.stopMediaPoll()
			this.states.sceneCollectionChanging = true
		})
		this.obs.on('CurrentSceneCollectionChanged', (data) => {
			this.states.currentSceneCollection = data.sceneCollectionName
			this.checkFeedbacks('scene_collection_active')
			this.setVariable('scene_collection', this.states.currentSceneCollection)
			this.states.sceneCollectionChanging = false
			this.getScenesSources()
			this.getSceneTransitionList()
		})
		this.obs.on('SceneCollectionListChanged', () => {
			this.getSceneCollectionList()
		})
		this.obs.on('CurrentProfileChanging', () => {})
		this.obs.on('CurrentProfileChanged', (data) => {
			this.states.currentProfile = data.profileName
			this.checkFeedbacks('profile_active')
			this.setVariable('profile', this.states.currentProfile)
			this.this.obsInfo()
		})
		this.obs.on('ProfileListChanged', () => {
			this.getProfileList()
		})
		//Scenes
		this.obs.on('SceneCreated', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				this.addScene(data.sceneName)
			}
		})
		this.obs.on('SceneRemoved', (data) => {
			if (data?.isGroup === false && this.states.sceneCollectionChanging === false) {
				this.removeScene(data.sceneName)
			}
		})
		this.obs.on('SceneNameChanged', (data) => {
			if (this.sceneItems[data.oldSceneName]) {
				this.sceneItems[data.sceneName] = this.sceneItems[data.oldSceneName]
				delete this.sceneItems[data.oldSceneName]
			}
			let scene = this.sceneChoices.findIndex((item) => item.id === data.oldSceneName)
			this.sceneChoices.splice(scene, 1)
			this.sceneChoices.push({ id: data.sceneName, label: data.sceneName })

			this.updateActionsFeedbacksVariables()
		})
		this.obs.on('CurrentProgramSceneChanged', (data) => {
			this.states.programScene = data.sceneName
			this.setVariable('scene_active', this.states.programScene)
			this.checkFeedbacks('scene_active')
		})
		this.obs.on('CurrentPreviewSceneChanged', (data) => {
			this.states.previewScene = data.sceneName ? data.sceneName : 'None'
			this.setVariable('scene_preview', this.states.previewScene)
			this.checkFeedbacks('scene_active')
		})
		this.obs.on('SceneListChanged', () => {})
		//Inputs
		this.obs.on('InputCreated', () => {})
		this.obs.on('InputRemoved', () => {})
		this.obs.on('InputNameChanged', () => {})
		this.obs.on('InputActiveStateChanged', (data) => {
			if (this.sources[data.inputName]) {
				this.sources[data.inputName].active = data.videoActive
				this.checkFeedbacks('scene_item_active')
			}
		})
		this.obs.on('InputShowStateChanged', (data) => {
			if (this.sources[data.inputName]) {
				this.sources[data.inputName].videoShowing = data.videoShowing
				this.checkFeedbacks('scene_item_previewed')
			}
		})
		this.obs.on('InputMuteStateChanged', (data) => {
			this.sources[data.inputName].inputMuted = data.inputMuted
			this.setVariable('mute_' + data.inputName, this.sources[data.inputName].inputMuted ? 'Muted' : 'Unmuted')
			this.checkFeedbacks('audio_muted')
		})
		this.obs.on('InputVolumeChanged', (data) => {
			this.sources[data.inputName].inputVolume = this.roundNumber(data.inputVolumeDb, 1)
			this.setVariable('volume_' + data.inputName, this.sources[data.inputName].inputVolume + 'db')
			this.checkFeedbacks('volume')
		})
		this.obs.on('InputAudioBalanceChanged', (data) => {
			this.sources[data.inputName].inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
			this.setVariable('balance_' + data.inputName, this.sources[data.inputName].inputAudioBalance)
		})
		this.obs.on('InputAudioSyncOffsetChanged', (data) => {
			this.sources[data.inputName].inputAudioSyncOffset = data.inputAudioSyncOffset
			this.setVariable('sync_offset_' + data.inputName, this.sources[data.inputName].inputAudioSyncOffset + 'ms')
		})
		this.obs.on('InputAudioTracksChanged', () => {})
		this.obs.on('InputAudioMonitorTypeChanged', (data) => {
			this.sources[data.inputName].monitorType = data.monitorType
			let monitorType
			if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
				monitorType = 'Monitor / Output'
			} else if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
				monitorType = 'Monitor Only'
			} else {
				monitorType = 'Off'
			}
			this.setVariable('monitor_' + data.inputName, monitorType)
			this.checkFeedbacks('audio_monitor_type')
		})
		this.obs.on('InputVolumeMeters', () => {})
		//Transitions
		this.obs.on('CurrentSceneTransitionChanged', (data) => {
			this.states.currentTransition = data.transitionName
			this.checkFeedbacks('current_transition')
			this.setVariable('current_transition', this.states.currentTransition)
			this.obs.call('GetCurrentSceneTransition').then((data) => {
				this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
				this.checkFeedbacks('transition_duration')
				this.setVariable('transition_duration', this.states.transitionDuration)
			})
		})
		this.obs.on('CurrentSceneTransitionDurationChanged', (data) => {
			this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
			this.checkFeedbacks('transition_duration')
			this.setVariable('transition_duration', this.states.transitionDuration)
		})
		this.obs.on('SceneTransitionStarted', () => {
			this.states.transitionActive = true
			this.checkFeedbacks('transition_active')
		})
		this.obs.on('SceneTransitionEnded', () => {
			this.states.transitionActive = false
			this.checkFeedbacks('transition_active')
		})
		this.obs.on('SceneTransitionVideoEnded', () => {})
		//Filters
		this.obs.on('SourceFilterListReindexed', () => {})
		this.obs.on('SourceFilterCreated', () => {})
		this.obs.on('SourceFilterRemoved', () => {})
		this.obs.on('SourceFilterNameChanged', () => {})
		this.obs.on('SourceFilterEnableStateChanged', (data) => {
			if (this.sourceFilters[data.sourceName]) {
				let filter = this.sourceFilters[data.sourceName].findIndex((item) => item.filterName == data.filterName)
				if (filter !== undefined) {
					this.sourceFilters[data.sourceName][filter].filterEnabled = data.filterEnabled
					this.checkFeedbacks('filter_enabled')
				}
			}
		})
		//Scene Items
		this.obs.on('SceneItemCreated', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				this.getSceneItems(data.sceneName)
			}
		})
		this.obs.on('SceneItemRemoved', (data) => {
			if (this.states.sceneCollectionChanging === false) {
				let source = this.sourceChoices.findIndex((item) => item.id === data.sourceName)
				this.sourceChoices.splice(source, 1)
				this.updateActionsFeedbacksVariables()

				this.getSceneItems(data.sceneName)
			}
		})
		this.obs.on('SceneItemListReindexed', () => {})
		this.obs.on('SceneItemEnableStateChanged', (data) => {
			let sceneItem = this.sceneItems[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
			this.sceneItems[data.sceneName][sceneItem].sceneItemEnabled = data.sceneItemEnabled
			this.checkFeedbacks('scene_item_active_in_scene')
		})
		this.obs.on('SceneItemLockStateChanged', () => {})
		this.obs.on('SceneItemSelected', () => {})
		this.obs.on('SceneItemTransformChanged', (data) => {
			let sceneItem = this.sceneItems[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
			if (sceneItem !== undefined) {
				let sourceName = this.sceneItems[data.sceneName][sceneItem].sourceName
				if (this.sceneItems[data.sceneName][sceneItem].inputKind) {
					this.obs
						.call('GetInputSettings', { inputName: sourceName })
						.then((settings) => {
							this.sources[sourceName].settings = settings.inputSettings
							if (settings.inputKind === 'text_ft2_source_v2' || settings.inputKind === 'text_gdiplus_v2') {
								this.setVariable(
									'current_text_' + sourceName,
									settings.inputSettings.text ? settings.inputSettings.text : ''
								)
							}
							if (settings.inputKind === 'image_source') {
								this.setVariable(
									'image_file_name_' + sourceName,
									settings.inputSettings?.file
										? settings.inputSettings.file.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
										: ''
								)
							}
						})
						.catch((error) => {})
				}
			}
		})
		//Outputs
		this.obs.on('StreamStateChanged', (data) => {
			this.states.streaming = data.outputActive

			this.setVariable('streaming', this.states.streaming ? 'Live' : 'Off-Air')
			this.checkFeedbacks('streaming')
		})
		this.obs.on('RecordStateChanged', (data) => {
			if (data.outputActive === true) {
				this.states.recording = 'Recording'
			} else {
				if (data.outputState === 'OBS_WEBSOCKET_OUTPUT_PAUSED') {
					this.states.recording = 'Paused'
				} else {
					this.states.recording = 'Stopped'
					this.setVariable('recording_timecode', '00:00:00')
				}
			}
			if (data.outputPath) {
				this.setVariable('recording_file_name', data.outputPath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/))
			}
			this.setVariable('recording', this.states.recording)
			this.checkFeedbacks('recording')
		})
		this.obs.on('ReplayBufferStateChanged', (data) => {
			this.states.replayBuffer = data.outputActive
			this.checkFeedbacks('replayBufferActive')
		})
		this.obs.on('VirtualcamStateChanged', (data) => {
			this.outputs['virtualcam_output'].outputActive = data.outputActive
			this.checkFeedbacks('output_active')
		})
		this.obs.on('ReplayBufferSaved', (data) => {
			this.setVariable('replay_buffer_path', data.savedReplayPath)
		})
		//Media Inputs
		this.obs.on('MediaInputPlaybackStarted', (data) => {
			this.states.currentMedia = data.inputName
			this.setVariable('current_media_name', this.states.currentMedia)
			this.setVariable(`media_status_${data.inputName}`, 'Playing')
		})
		this.obs.on('MediaInputPlaybackEnded', (data) => {
			if (this.states.currentMedia == data.inputName) {
				this.setVariable('current_media_name', 'None')
				this.setVariable(`media_status_${data.inputName}`, 'Stopped')
			}
		})
		this.obs.on('MediaInputActionTriggered', (data) => {
			if (data.mediaAction == 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE') {
				this.setVariable(`media_status_${data.inputName}`, 'Paused')
			}
		})
		//UI
		this.obs.on('StudioModeStateChanged', (data) => {
			this.states.studioMode = data.studioModeEnabled ? true : false
		})
	}

	initFeedbacks() {
		const feedbacks = initFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
		this.setPresetDefinitions(this.getPresets())
	}

	actions() {
		this.setActions(this.getActions())
	}

	action(action) {
		let requestType
		let requestData

		switch (action.action) {
			//General
			case 'trigger-hotkey':
				requestType = 'TriggerHotkeyByName'
				requestData = { hotkeyName: action.options.id }
				break
			case 'trigger-hotkey-sequence':
				let keyModifiers = {
					shift: action.options.keyShift,
					alt: action.options.keyAlt,
					control: action.options.keyControl,
					command: action.options.keyCommand,
				}

				requestType = 'TriggerHotkeyByKeySequence'
				requestData = {
					keyId: action.options.keyId,
					keyModifiers: keyModifiers,
				}
				break
			case 'custom_command':
				let command
				let arg

				this.parseVariables(action.options.command, (value) => {
					command = value.replace(/ /g, '')
				})

				if (action.options.arg) {
					this.parseVariables(action.options.arg, (value) => {
						arg = value
					})
					try {
						arg = JSON.parse(arg)
					} catch (e) {
						this.log('warn', 'Request data must be formatted as valid JSON.')
						return
					}
				}

				requestType = command
				requestData = arg
				break
			//Config
			case 'set_profile':
				requestType = 'SetCurrentProfile'
				requestData = { profileName: action.options.profile }
				break
			case 'set_scene_collection':
				requestType = 'SetCurrentSceneCollection'
				requestData = { sceneCollectionName: action.options.scene_collection }
				break
			case 'set_stream_settings':
				let streamServiceSettings = {
					key: action.options.streamKey,
					server: action.options.streamURL,
					use_auth: action.options.streamAuth,
					username: action.options.streamUserName,
					password: action.options.streamPassword,
				}
				let streamServiceType = action.options.streamType
				requestType = 'SetStreamServiceSettings'
				requestData = { streamServiceType: streamServiceType, streamServiceSettings: streamServiceSettings }
				break
			//Sources
			case 'take_screenshot':
				let date = new Date().toISOString()
				let day = date.slice(0, 10)
				let time = date.slice(11, 19).replace(/:/g, '-')

				let fileName = action.options.source === 'programScene' ? this.states.programScene : action.options.custom
				let fileLocation = action.options.path ? action.options.path : this.states.recordDirectory
				let filePath = fileLocation + '/' + day + '_' + fileName + '_' + time + '.' + action.options.format
				let quality = action.options.compression == 0 ? -1 : action.options.compression

				requestType = 'SaveSourceScreenshot'
				requestData = {
					sourceName: fileName,
					imageFormat: action.options.format,
					imageFilePath: filePath,
					imageCompressionQuality: quality,
				}
				break
			//Scenes
			case 'set_scene':
				if (action.options.scene === 'customSceneName') {
					this.parseVariables(action.options.customSceneName, (value) => {
						requestData = { sceneName: value }
					})
				} else {
					requestData = { sceneName: action.options.scene }
				}
				requestType = 'SetCurrentProgramScene'
				break
			case 'preview_scene':
				if (action.options.scene === 'customSceneName') {
					this.parseVariables(action.options.customSceneName, (value) => {
						requestData = { sceneName: value }
					})
				} else {
					requestData = { sceneName: action.options.scene }
				}
				requestType = 'SetCurrentPreviewScene'
				break
			case 'smart_switcher':
				let scene = action.options.scene
				if (action.options.scene === 'customSceneName') {
					this.parseVariables(action.options.customSceneName, (value) => {
						scene = value
					})
				}

				if (this.states.previewScene == scene && this.states.programScene != scene) {
					requestType = 'TriggerStudioModeTransition'
				} else {
					requestType = 'SetCurrentPreviewScene'
					requestData = { sceneName: scene }
				}
				break
			//Inputs
			case 'setText':
				let newText
				this.parseVariables(action.options.text, (value) => {
					newText = value
				})
				requestType = 'SetInputSettings'
				requestData = { inputName: action.options.source, inputSettings: { text: newText } }
				break
			case 'set_source_mute':
				requestType = 'SetInputMute'
				requestData = { inputName: action.options.source, inputMuted: action.options.mute == 'true' ? true : false }
				break
			case 'toggle_source_mute':
				requestType = 'ToggleInputMute'
				requestData = { inputName: action.options.source }
				break
			case 'set_volume':
				requestType = 'SetInputVolume'
				requestData = { inputName: action.options.source, inputVolumeDb: action.options.volume }
				break
			case 'adjust_volume':
				let newVolume = this.sources[action.options.source].inputVolume + action.options.volume
				if (newVolume > 26) {
					newVolume = 26
				} else if (newVolume < -100) {
					newVolume = -100
				}
				requestType = 'SetInputVolume'
				requestData = { inputName: action.options.source, inputVolumeDb: newVolume }
				break
			case 'set_audio_monitor':
				let monitorType
				if (action.options.monitor === 'monitorAndOutput') {
					monitorType = 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT'
				} else if (action.options.monitor === 'monitorOnly') {
					monitorType = 'OBS_MONITORING_TYPE_MONITOR_ONLY'
				} else {
					monitorType = 'OBS_MONITORING_TYPE_NONE'
				}
				requestType = 'SetInputAudioMonitorType'
				requestData = { inputName: action.options.source, monitorType: monitorType }
				break
			case 'setSyncOffset':
				requestType = 'SetInputAudioSyncOffset'
				requestData = { inputName: action.options.source, inputAudioSyncOffset: action.options.offset }
				break
			case 'setAudioBalance':
				requestType = 'SetInputAudioBalance'
				requestData = { inputName: action.options.source, inputAudioBalance: action.options.balance }
				break
			case 'refresh_browser_source':
				if (this.sources[action.options.source]?.inputKind == 'browser_source') {
					requestType = 'PressInputPropertiesButton'
					requestData = { inputName: action.options.source, propertyName: 'refreshnocache' }
				}
				break
			//Transitions
			case 'do_transition':
				if (this.states.studioMode) {
					requestType = 'TriggerStudioModeTransition'
				} else {
					this.log(
						'warn',
						'The Transition action requires OBS to be in Studio Mode. Try switching to Studio Mode, or using the Change Scene action instead'
					)
				}
				break
			case 'set_transition':
				requestType = 'SetCurrentSceneTransition'
				requestData = { transitionName: action.options.transitions }
				break
			case 'set_transition_duration':
				requestType = 'SetCurrentSceneTransitionDuration'
				requestData = { transitionDuration: action.options.duration }
				break
			case 'quick_transition':
				if (action.options.transition == 'Default' && !action.options.transition_time) {
					requestType = 'TriggerStudioModeTransition'
				} else {
					let transitionWaitTime
					let transitionDuration
					let revertTransition = this.states.currentTransition
					let revertTransitionDuration = this.states.transitionDuration
					if (action.options.transition != 'Cut' && action.options.transition_time > 50) {
						transitionWaitTime = action.options.transition_time + 50
					} else if (action.options.transition_time == null) {
						transitionWaitTime = revertTransitionDuration + 50
					} else {
						transitionWaitTime = 100
					}
					if (action.options.transition_time != null) {
						transitionDuration = action.options.transition_time
					} else {
						transitionDuration = revertTransitionDuration
					}
					//This is a workaround until obs-websocket-js can support Batch Requests
					//https://github.com/obs-websocket-community-projects/obs-websocket-js/issues/292
					try {
						this.obs.call('SetCurrentSceneTransition', { transitionName: action.options.transition }).then(() => {
							this.obs
								.call('SetCurrentSceneTransitionDuration', { transitionDuration: transitionDuration })
								.then(() => {
									this.obs.call('TriggerStudioModeTransition').then(() => {
										setTimeout(function () {
											this.obs.call('SetCurrentSceneTransition', { transitionName: revertTransition }).then(() => {
												this.obs
													.call('SetCurrentSceneTransitionDuration', { transitionDuration: revertTransitionDuration })
													.then(() => {})
											})
										}, transitionWaitTime)
									})
								})
						})
					} catch (error) {}
				}
				break
			//Filters
			case 'toggle_filter':
				let filterVisibility
				if (action.options.visible !== 'toggle') {
					filterVisibility = action.options.visible === 'true' ? true : false
				} else if (action.options.visible === 'toggle') {
					if (this.sourceFilters[action.options.source]) {
						let filter = this.sourceFilters[action.options.source].find(
							(item) => item.filterName === action.options.filter
						)
						if (filter) {
							filterVisibility = !filter.filterEnabled
						}
					}
				}

				requestType = 'SetSourceFilterEnabled'
				requestData = {
					sourceName: action.options.source,
					filterName: action.options.filter,
					filterEnabled: filterVisibility,
				}
				break
			//Scene Items
			case 'source_properties':
				let sourceScene
				if (action.options.scene == 'Current Scene') {
					sourceScene = this.states.programScene
				} else if (action.options.scene == 'Preview Scene') {
					sourceScene = this.states.previewScene
				} else {
					sourceScene = action.options.scene
				}

				let positionX
				let positionY
				let scaleX
				let scaleY
				let rotation

				this.parseVariables(action.options.positionX, function (value) {
					positionX = parseFloat(value)
				})
				this.parseVariables(action.options.positionY, function (value) {
					positionY = parseFloat(value)
				})
				this.parseVariables(action.options.scaleX, function (value) {
					scaleX = parseFloat(value)
				})
				this.parseVariables(action.options.scaleY, function (value) {
					scaleY = parseFloat(value)
				})
				this.parseVariables(action.options.rotation, function (value) {
					rotation = parseFloat(value)
				})

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

				break
			case 'toggle_scene_item':
				let sceneName = action.options.scene
				let sourceName = action.options.source

				// special scene names
				if (!sceneName || sceneName === 'Current Scene') {
					sceneName = this.states.programScene
				} else if (sceneName === 'Preview Scene') {
					sceneName = this.states.previewScene
				}
				let targetScene = this.sceneItems[sceneName]

				if (targetScene) {
					targetScene.forEach((source) => {
						if (sourceName === 'allSources' || source.sourceName === sourceName) {
							let enabled
							if (action.options.visible === 'toggle') {
								enabled = !source.sceneItemEnabled
							} else {
								enabled = action.options.visible == 'true' ? true : false
							}
							this.sendRequest('SetSceneItemEnabled', {
								sceneName: sceneName,
								sceneItemId: source.sceneItemId,
								sceneItemEnabled: enabled,
							})
							if (source.isGroup) {
								for (let x in this.groups[source.sourceName]) {
									let item = this.groups[source.sourceName][x]
									let groupEnabled
									if (action.options.visible === 'toggle') {
										groupEnabled = !this.sources[item.sourceName].sceneItemEnabled
									} else {
										groupEnabled = action.options.visible == 'true' ? true : false
									}
									this.sendRequest('SetSceneItemEnabled', {
										sceneName: source.sourceName,
										sceneItemId: item.sceneItemId,
										sceneItemEnabled: groupEnabled,
									})
								}
							}
						}
					})
				}
				break
			//Outputs
			case 'start_output':
				requestType = 'StartOutput'
				requestData = {
					outputName: action.options.output,
				}
				break
			case 'stop_output':
				requestType = 'StopOutput'
				requestData = {
					outputName: action.options.output,
				}
				break
			case 'start_stop_output':
				requestType = 'ToggleOutput'
				requestData = {
					outputName: action.options.output,
				}
				break
			case 'ToggleReplayBuffer':
				requestType = 'ToggleReplayBuffer'
				break
			case 'start_replay_buffer':
				requestType = 'StartReplayBuffer'
				break
			case 'stop_replay_buffer':
				requestType = 'StopReplayBuffer'
				break
			case 'save_replay_buffer':
				requestType = 'SaveReplayBuffer'
				break
			//Stream
			case 'StartStopStreaming':
				requestType = 'ToggleStream'
				break
			case 'start_streaming':
				requestType = 'StartStream'
				break
			case 'stop_streaming':
				requestType = 'StopStream'
				break
			case 'SendStreamCaption':
				if (this.states.streaming) {
					let captionText
					this.parseVariables(action.options.text, (value) => {
						captionText = value
					})
					requestType = 'SendStreamCaption'
					requestData = { captionText: captionText }
				}
				break
			//Record
			case 'StartStopRecording':
				requestType = 'ToggleRecord'
				break
			case 'start_recording':
				requestType = 'StartRecord'
				break
			case 'stop_recording':
				requestType = 'StopRecord'
				break
			case 'pause_recording':
				requestType = 'PauseRecord'
				break
			case 'resume_recording':
				requestType = 'ResumeRecord'
				break
			case 'ToggleRecordPause':
				requestType = 'ToggleRecordPause'
				break
			//Media Inputs
			case 'play_pause_media':
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
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: media,
					mediaAction: playPause,
				}
				break
			case 'restart_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_RESTART',
				}
				break
			case 'stop_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_STOP',
				}
				break
			case 'next_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_NEXT',
				}
				break
			case 'previous_media':
				requestType = 'TriggerMediaInputAction'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaAction: 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PREVIOUS',
				}
				break
			case 'set_media_time':
				requestType = 'SetMediaInputCursor'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaCursor: action.options.mediaTime * 1000,
				}
				break
			case 'scrub_media':
				requestType = 'OffsetMediaInputCursor'
				requestData = {
					inputName: action.options.source === 'currentMedia' ? this.states.currentMedia : action.options.source,
					mediaCursorOffset: action.options.scrubAmount * 1000,
				}
				break
			//UI
			case 'enable_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: true }
				break
			case 'disable_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: false }
				break
			case 'toggle_studio_mode':
				requestType = 'SetStudioModeEnabled'
				requestData = { studioModeEnabled: this.states.studioMode ? false : true }
				break
			case 'openInputPropertiesDialog':
				requestType = 'OpenInputPropertiesDialog'
				requestData = { inputName: action.options.source }
				break
			case 'openInputFiltersDialog':
				requestType = 'OpenInputFiltersDialog'
				requestData = { inputName: action.options.source }
				break
			case 'openInputInteractDialog':
				requestType = 'OpenInputInteractDialog'
				requestData = { inputName: action.options.source }
				break
			case 'open_projector':
				let monitor = action.options.window === 'window' ? -1 : action.options.display

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
				break
		}
		if (requestType) {
			this.sendRequest(requestType, requestData)
		}
	}

	async sendRequest(requestType, requestData) {
		try {
			let data = await this.obs.call(requestType, requestData)
			return data
		} catch (error) {
			this.debug(error)
			this.log('warn', `Request ${requestType} failed (${error})`)
		}
	}

	startReconnectionPoll() {
		this.stopReconnectionPoll()
		this.reconnectionPoll = setInterval(() => {
			this.connectOBS()
		}, 5000)
	}

	stopReconnectionPoll() {
		if (this.reconnectionPoll) {
			clearInterval(this.reconnectionPoll)
			delete this.reconnectionPoll
		}
	}

	async obsInfo() {
		let version = await this.sendRequest('GetVersion')
		this.states.version = version
		version.supportedImageFormats.forEach((format) => {
			this.imageFormats.push({ id: format, label: format })
		})

		this.obs
			.call('GetInputKindList')
			.then((data) => {
				this.states.inputKindList = data
			})
			.catch((error) => {})
		this.obs
			.call('GetHotkeyList')
			.then((data) => {
				data.hotkeys.forEach((hotkey) => {
					this.hotkeyNames.push({ id: hotkey, label: hotkey })
				})
			})
			.catch((error) => {})
		this.obs
			.call('GetStudioModeEnabled')
			.then((data) => {
				this.states.studioMode = data.studioModeEnabled ? true : false
			})
			.catch((error) => {})
		this.obs
			.call('GetVideoSettings')
			.then((data) => {
				this.states.resolution = `${data.baseWidth}x${data.baseHeight}`
				this.states.outputResolution = `${data.outputWidth}x${data.outputHeight}`
				this.states.framerate = `${this.roundNumber(data.fpsNumerator / data.fpsDenominator, 2)} fps`
				this.setVariables({
					base_resolution: this.states.resolution,
					output_resolution: this.states.outputResolution,
					target_framerate: this.states.framerate,
				})
			})
			.catch((error) => {})
		this.obs
			.call('GetMonitorList')
			.then((data) => {
				this.states.monitors = data
				data.monitors.forEach((monitor) => {
					let monitorName = monitor.monitorName
					if (monitorName.match(/\([0-9]+\)/i)) {
						monitorName = `Display ${monitorName.replace(/[^0-9]/g, '')}`
					}
					this.monitors.push({
						id: monitor.monitorIndex,
						label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
					})
				})
			})
			.catch((error) => {})
		this.obs
			.call('GetOutputList')
			.then((data) => {
				this.outputs = {}
				this.outputList = []
				data.outputs.forEach((output) => {
					let outputKind = output.outputKind
					if (outputKind === 'virtualcam_output') {
						this.outputList.push({ id: 'virtualcam_output', label: 'Virtual Camera' })
					} else if (outputKind != 'ffmpeg_muxer' && outputKind != 'replay_buffer' && outputKind != 'rtmp_output') {
						//The above outputKinds are handled separately by other actions, so they are omitted
						this.outputList.push({ id: output.outputName, label: output.outputName })
					}
					this.getOutputStatus(output.outputName)
				})
			})
			.catch((error) => {})
		this.obs
			.call('GetReplayBufferStatus')
			.then((data) => {
				this.states.replayBuffer = data.outputActive
				this.checkFeedbacks('replayBufferActive')
			})
			.catch((error) => {})
	}

	roundNumber(number, decimalPlaces) {
		if (number) {
			return Number(Math.round(number + 'e' + decimalPlaces) + 'e-' + decimalPlaces)
		} else {
			return number
		}
	}

	startStatsPoll() {
		this.stopStatsPoll()
		if (this.obs) {
			this.statsPoll = setInterval(() => {
				this.getStats()
				if (this.states.streaming) {
					this.getStreamStatus()
				}
				if (this.states.recording === 'Recording') {
					this.getRecordStatus()
				}
				if (this.outputs) {
					for (let outputName in this.outputs) {
						this.getOutputStatus(outputName)
					}
				}
			}, 1000)
		}
	}

	stopStatsPoll() {
		if (this.statsPoll) {
			clearInterval(this.statsPoll)
			delete this.statsPoll
		}
	}

	getStats() {
		this.obs
			.call('GetStats')
			.then((data) => {
				this.states.stats = data
				this.setVariable('fps', this.roundNumber(data.activeFps, 2))
				this.setVariable('render_total_frames', data.renderTotalFrames)
				this.setVariable('render_missed_frames', data.renderSkippedFrames)
				this.setVariable('output_total_frames', data.outputTotalFrames)
				this.setVariable('output_skipped_frames', data.outputSkippedFrames)
				this.setVariable('average_frame_time', this.roundNumber(data.averageFrameRenderTime, 2))
				this.setVariable('cpu_usage', `${this.roundNumber(data.cpuUsage, 2)}%`)
				this.setVariable('memory_usage', `${this.roundNumber(data.memoryUsage, 0)} MB`)
				let freeSpace = this.roundNumber(data.availableDiskSpace, 0)
				if (freeSpace > 1000) {
					this.setVariable('free_disk_space', `${this.roundNumber(freeSpace / 1000, 0)} GB`)
				} else {
					this.setVariable('free_disk_space', `${this.roundNumber(freeSpace, 0)} MB`)
				}
			})
			.catch((error) => {})
	}

	getOutputStatus(outputName) {
		this.obs
			.call('GetOutputStatus', { outputName: outputName })
			.then((data) => {
				this.outputs[outputName] = data
				this.checkFeedbacks('output_active')
			})
			.catch((error) => {})
	}

	getStreamStatus() {
		this.obs
			.call('GetStreamStatus')
			.then((data) => {
				this.states.streaming = data.outputActive
				this.setVariable('streaming', data.outputActive ? 'Live' : 'Off-Air')
				this.checkFeedbacks('streaming')
				this.states.streamingTimecode = data.outputTimecode.match(/\d\d:\d\d:\d\d/i)
				this.setVariable('stream_timecode', this.states.streamingTimecode)
				this.setVariable('output_skipped_frames', data.outputSkippedFrames)
				this.setVariable('output_total_frames', data.outputTotalFrames)
			})
			.catch((error) => {})
		this.obs
			.call('GetStreamServiceSettings')
			.then((data) => {
				this.setVariable(
					'stream_service',
					data.streamServiceSettings?.service ? data.streamServiceSettings.service : 'Custom'
				)
			})
			.catch((error) => {})
	}

	getSceneTransitionList() {
		this.transitionList = []
		this.obs
			.call('GetSceneTransitionList')
			.then((data) => {
				data.transitions.forEach((transition) => {
					this.transitionList.push({ id: transition.transitionName, label: transition.transitionName })
				})
			})

			.then(() => {
				this.updateActionsFeedbacksVariables()
			})
			.catch((error) => {})
		this.obs
			.call('GetCurrentSceneTransition')
			.then((data) => {
				this.states.currentTransition = data.transitionName
				this.checkFeedbacks('current_transition')
				this.setVariable('current_transition', this.states.currentTransition)

				this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
				this.checkFeedbacks('transition_duration')
				this.setVariable('transition_duration', this.states.transitionDuration)
			})
			.catch((error) => {})
	}

	getRecordStatus() {
		this.obs
			.call('GetRecordStatus')
			.then((data) => {
				if (data.outputActive === true) {
					this.states.recording = 'Recording'
				} else {
					this.states.recording = data.outputPaused ? 'Paused' : 'Stopped'
				}
				this.setVariable('recording', this.states.recording)
				this.checkFeedbacks('recording')
				this.states.recordingTimecode = data.outputTimecode.match(/\d\d:\d\d:\d\d/i)
				this.setVariable('recording_timecode', this.states.recordingTimecode)
			})
			.catch((error) => {})
		this.obs
			.call('GetRecordDirectory')
			.then((data) => {
				this.states.recordDirectory = data.recordDirectory
				this.setVariable('recording_path', this.states.recordDirectory)
			})
			.catch((error) => {})
	}

	getProfileList() {
		this.profileChoices = []
		this.obs
			.call('GetProfileList')
			.then((data) => {
				this.states.currentProfile = data.currentProfileName
				this.checkFeedbacks('profile_active')
				this.setVariable('profile', this.states.currentProfile)
				data.profiles.forEach((profile) => {
					this.profileChoices.push({ id: profile, label: profile })
				})
			})
			.then(() => {
				this.updateActionsFeedbacksVariables()
			})
			.catch((error) => {})
	}

	getSceneCollectionList() {
		this.sceneCollectionList = []
		this.obs
			.call('GetSceneCollectionList')
			.then((data) => {
				this.states.currentSceneCollection = data.currentSceneCollectionName
				this.checkFeedbacks('scene_collection_active')
				this.setVariable('scene_collection', this.states.currentSceneCollection)
				data.sceneCollections.forEach((sceneCollection) => {
					this.sceneCollectionList.push({ id: sceneCollection, label: sceneCollection })
				})
			})
			.then(() => {
				this.updateActionsFeedbacksVariables()
			})
			.catch((error) => {})
	}

	getAudioSources(sourceName) {
		this.obs
			.call('GetInputAudioTracks', { inputName: sourceName })
			.then((data) => {
				if (!this.audioSourceList.find((item) => item.id === sourceName)) {
					this.audioSourceList.push({ id: sourceName, label: sourceName })
					this.sources[sourceName].inputAudioTracks = data.inputAudioTracks
					this.getSourceAudio(sourceName)
					//this.updateActionsFeedbacksVariables()
				}
			})
			.catch((error) => {})
	}

	getSourceAudio(sourceName) {
		this.obs.call('GetInputMute', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].inputMuted = data.inputMuted
			this.setVariable('mute_' + sourceName, this.sources[sourceName].inputMuted ? 'Muted' : 'Unmuted')
			this.checkFeedbacks('audio_muted')
		})
		this.obs.call('GetInputVolume', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].inputVolume = this.roundNumber(data.inputVolumeDb, 1)
			this.setVariable('volume_' + sourceName, this.sources[sourceName].inputVolume + 'db')
			this.checkFeedbacks('volume')
		})
		this.obs.call('GetInputAudioBalance', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
			this.setVariable('balance_' + sourceName, this.sources[sourceName].inputAudioBalance)
		})
		this.obs.call('GetInputAudioSyncOffset', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].inputAudioSyncOffset = data.inputAudioSyncOffset
			this.setVariable('sync_offset_' + sourceName, this.sources[sourceName].inputAudioSyncOffset + 'ms')
		})
		this.obs.call('GetInputAudioMonitorType', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].monitorType = data.monitorType
			let monitorType
			if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
				monitorType = 'Monitor / Output'
			} else if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
				monitorType = 'Monitor Only'
			} else {
				monitorType = 'Off'
			}
			this.setVariable('monitor_' + sourceName, monitorType)
			this.checkFeedbacks('audio_monitor_type')
		})
		this.obs.call('GetInputAudioTracks', { inputName: sourceName }).then((data) => {
			this.sources[sourceName].inputAudioTracks = data.inputAudioTracks
		})
		this.updateActionsFeedbacksVariables()
	}

	getSourceFilters(sourceName) {
		this.obs
			.call('GetSourceFilterList', { sourceName: sourceName })
			.then((data) => {
				this.sourceFilters[sourceName] = data.filters
				if (data.filters) {
					data.filters.forEach((filter) => {
						if (!this.filterList.find((item) => item.id === filter.filterName)) {
							this.filterList.push({ id: filter.filterName, label: filter.filterName })
						}
					})
				}
			})
			.catch((error) => {})
	}

	getGroupInfo(sourceName) {
		this.obs
			.call('GetGroupSceneItemList', { sceneName: sourceName })
			.then((data) => {
				this.groups[sourceName] = data.sceneItems
				data.sceneItems.forEach((sceneItem) => {
					let sourceName = sceneItem.sourceName
					this.sources[sourceName] = sceneItem
					this.sources[sourceName].groupedSource = true

					if (!this.sourceChoices.find((item) => item.id === sourceName)) {
						this.sourceChoices.push({ id: sourceName, label: sourceName })
						this.updateActionsFeedbacksVariables()
					}

					this.getSourceFilters(sourceName)
					this.getAudioSources(sourceName)

					if (sceneItem.inputKind) {
						let inputKind = sceneItem.inputKind
						this.getInputSettings(sourceName, inputKind)
					}
				})
			})
			.catch((error) => {})
	}

	getInputSettings(sourceName, inputKind) {
		this.obs
			.call('GetInputSettings', { inputName: sourceName })
			.then((settings) => {
				this.sources[sourceName].settings = settings.inputSettings

				if (inputKind === 'text_ft2_source_v2' || inputKind === 'text_gdiplus_v2') {
					this.textSourceList.push({ id: sourceName, label: sourceName })
					this.setVariable('current_text_' + sourceName, settings.inputSettings.text ? settings.inputSettings.text : '')
				}
				if (inputKind === 'ffmpeg_source' || inputKind === 'vlc_source') {
					this.mediaSourceList.push({ id: sourceName, label: sourceName })
					this.mediaSources[sourceName] = settings.inputSettings
					this.startMediaPoll()
					this.updateActionsFeedbacksVariables()
				}
				if (inputKind === 'image_source') {
					this.imageSourceList.push({ id: sourceName, label: sourceName })
				}
			})
			.catch((error) => {})
	}

	getSceneItems(sceneName) {
		this.obs
			.call('GetSceneItemList', { sceneName: sceneName })
			.then((data) => {
				this.sceneItems[sceneName] = data.sceneItems

				data.sceneItems.forEach((sceneItem) => {
					let sourceName = sceneItem.sourceName
					this.sources[sourceName] = sceneItem

					if (!this.sourceChoices.find((item) => item.id === sourceName)) {
						this.sourceChoices.push({ id: sourceName, label: sourceName })
					}

					if (sceneItem.isGroup) {
						this.getGroupInfo(sourceName)
					}
					this.obs
						.call('GetSourceActive', { sourceName: sourceName })
						.then((active) => {
							if (this.sources[sourceName]) {
								this.sources[sourceName].active = active.videoActive
							}
						})
						.catch((error) => {})

					this.getSourceFilters(sourceName)
					this.getAudioSources(sourceName)

					if (sceneItem.inputKind) {
						let inputKind = sceneItem.inputKind
						this.getInputSettings(sourceName, inputKind)
					}

					this.updateActionsFeedbacksVariables()
				})
			})
			.catch((error) => {})
	}

	addScene(sceneName) {
		this.sceneChoices.push({ id: sceneName, label: sceneName })
		this.updateActionsFeedbacksVariables()
		this.getSceneItems(sceneName)
	}

	removeScene(sceneName) {
		for (let x in this.sceneItems[sceneName]) {
			let sourceName = this.sceneItems[sceneName][x].sourceName
			delete this.sources[sourceName]

			let source = this.sourceChoices.findIndex((item) => item.id === sourceName)
			this.sourceChoices.splice(source, 1)
		}
		delete this.sceneItems[sceneName]

		let scene = this.sceneChoices.findIndex((item) => item.id === sceneName)
		this.sceneChoices.splice(scene, 1)

		this.updateActionsFeedbacksVariables()
	}

	getScenesSources() {
		this.scenes = {}
		this.sources = {}
		this.mediaSources = {}
		this.imageSources = {}
		this.textSources = {}
		this.sourceFilters = {}
		this.groups = {}

		this.sceneChoices = []
		this.sourceChoices = []
		this.filterList = []
		this.audioSourceList = []
		this.mediaSourceList = []
		this.textSourceList = []
		this.imageSourceList = []

		this.obs
			.call('GetSceneList')
			.then((data) => {
				this.scenes = data.scenes
				this.states.previewScene = data.currentPreviewSceneName ? data.currentPreviewSceneName : 'None'
				this.setVariable('scene_preview', this.states.previewScene)
				this.states.programScene = data.currentProgramSceneName
				this.setVariable('scene_active', this.states.programScene)
				return data
			})
			.then((data) => {
				data.scenes.forEach((scene) => {
					let sceneName = scene.sceneName
					this.addScene(sceneName)
					this.getSourceFilters(sceneName)
				})
			})
			.catch((error) => {})
	}

	formatTimecode(data) {
		//Converts milliseconds into a readable time format (hh:mm:ss)
		try {
			let formattedTime = new Date(data).toISOString().slice(11, 19)
			return formattedTime
		} catch (error) {}
	}

	startMediaPoll() {
		this.stopMediaPoll()
		this.mediaPoll = setInterval(() => {
			this.mediaSourceList.forEach((source) => {
				this.obs
					.call('GetMediaInputStatus', { inputName: source.id })
					.then((data) => {
						this.mediaSources[source.id] = data

						let remaining = data.mediaDuration - data.mediaCursor
						if (remaining > 0) {
							remaining = this.formatTimecode(remaining)
						} else {
							remaining = '--:--:--'
						}

						this.mediaSources[source.id].timeElapsed = this.formatTimecode(data.mediaCursor)
						this.mediaSources[source.id].timeRemaining = remaining

						if (data.mediaState === 'OBS_MEDIA_STATE_PLAYING') {
							this.setVariable('current_media_time_elapsed', this.mediaSources[source.id].timeElapsed)
							this.setVariable('current_media_time_remaining', this.mediaSources[source.id].timeRemaining)
							this.setVariable('media_status_' + source.id, 'Playing')
						} else if (data.mediaState === 'OBS_MEDIA_STATE_PAUSED') {
							this.setVariable('media_status_' + source.id, 'Paused')
						} else {
							this.setVariable('media_status_' + source.id, 'Stopped')
						}
						this.setVariable('media_time_elapsed_' + source.id, this.mediaSources[source.id].timeElapsed)
						this.setVariable('media_time_remaining_' + source.id, remaining)
						this.checkFeedbacks('media_playing')
						this.checkFeedbacks('media_source_time_remaining')
					})
					.catch((error) => {
						this.debug(error)
					})
			})
		}, 1000)
	}

	stopMediaPoll() {
		if (this.mediaPoll) {
			clearInterval(this.mediaPoll)
			this.mediaPoll = null
		}
	}

	organizeChoices() {
		//Sort choices alphabetically
		this.sourceChoices?.sort((a, b) => a.id.localeCompare(b.id))
		this.sceneChoices?.sort((a, b) => a.id.localeCompare(b.id))
		this.textSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		this.mediaSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		this.filterList?.sort((a, b) => a.id.localeCompare(b.id))
		this.audioSourceList?.sort((a, b) => a.id.localeCompare(b.id))
		//Special Choices - Scenes
		this.sceneChoicesProgramPreview = [
			{ id: 'Current Scene', label: 'Current Scene' },
			{ id: 'Preview Scene', label: 'Preview Scene' },
		].concat(this.sceneChoices)
		this.sceneChoicesAnyScene = [{ id: 'anyScene', label: '<ANY SCENE>' }].concat(this.sceneChoices)
		this.sceneChoicesCustomScene = [{ id: 'customSceneName', label: '<CUSTOM SCENE NAME>' }].concat(this.sceneChoices)
		//Special Choices - Sources
		this.sourceChoicesAllSources = [{ id: 'allSources', label: '<ALL SOURCES>' }].concat(this.sourceChoices)
		this.sourceChoicesAnySource = [{ id: 'anySource', label: '<ANY SOURCE>' }].concat(this.sourceChoices)
		this.sourceChoicesWithScenes = this.sourceChoices.concat(this.sceneChoices)
		this.mediaSourceListCurrentMedia = [{ id: 'currentMedia', label: '<CURRENT MEDIA>' }].concat(this.mediaSourceList)
		//Default Choices
		this.sourceListDefault = this.sourceChoices?.[0] ? this.sourceChoices?.[0]?.id : ''
		this.sceneListDefault = this.sceneChoices?.[0] ? this.sceneChoices?.[0]?.id : ''
		this.filterListDefault = this.filterList?.[0] ? this.filterList?.[0]?.id : ''
		this.audioSourceListDefault = this.audioSourceList?.[0] ? this.audioSourceList?.[0]?.id : ''
		this.profileChoicesDefault = this.profileChoices?.[0] ? this.profileChoices[0].id : ''
	}

	updateActionsFeedbacksVariables() {
		this.organizeChoices()

		this.actions()
		this.initVariables()
		this.initFeedbacks()
		this.initPresets()
		this.checkFeedbacks()
	}

	initializeStates() {
		//Basic Info
		this.scenes = {}
		this.sources = {}
		this.states = {}
		this.transitions = {}
		this.profiles = {}
		this.sceneCollections = {}
		this.outputs = {}
		this.sceneItems = {}
		this.groups = {}
		//Source Types
		this.mediaSources = {}
		this.imageSources = {}
		this.textSources = {}
		this.sourceFilters = {}
		//Choices
		this.sceneChoices = []
		this.sourceChoices = []
		this.profileChoices = []
		this.sceneCollectionList = []
		this.textSourceList = []
		this.mediaSourceList = []
		this.imageSourceList = []
		this.hotkeyNames = []
		this.imageFormats = []
		this.transitionList = []
		this.monitors = []
		this.outputList = []
		this.filterList = []
		this.audioSourceList = []
		//Set Initial States
		this.states.sceneCollectionChanging = false
	}
}
exports = module.exports = instance
