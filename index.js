import { InstanceBase, Regex, runEntrypoint } from '@companion-module/base'
import { getActions } from './actions.js'
import { getPresets } from './presets.js'
import { getVariables } from './variables.js'
import { getFeedbacks } from './feedbacks.js'
import UpgradeScripts from './upgrades.js'

import OBSWebSocket, { EventSubscription } from 'obs-websocket-js'

class OBSInstance extends InstanceBase {
	constructor(internal) {
		super(internal)
	}

	async init(config) {
		this.config = config

		this.updateStatus('connecting')
		if (this.config.host && this.config.port) {
			this.connectOBS()
		} else if (this.config.host && !this.config.port) {
			this.updateStatus('bad_config', 'Missing WebSocket Server port')
		} else if (!this.config.host && this.config.port) {
			this.updateStatus('bad_config', 'Missing WebSocket Server IP address or hostname')
		} else {
			this.updateStatus('bad_config', 'Missing WebSocket Server connection info')
		}
	}

	getConfigFields() {
		return [
			{
				type: 'textinput',
				id: 'host',
				label: 'Server IP / Hostname',
				width: 8,
			},
			{
				type: 'textinput',
				id: 'port',
				label: 'Server Port',
				width: 4,
				default: 4455,
				regex: Regex.PORT,
			},
			{
				type: 'textinput',
				id: 'pass',
				label: 'Server Password',
				width: 4,
			},
		]
	}

	async configUpdated(config) {
		this.config = config

		this.init(config)
	}

	async destroy() {
		this.disconnectOBS()
		this.stopReconnectionPoll()
	}

	initVariables() {
		const variables = getVariables.bind(this)()
		this.setVariableDefinitions(variables)
	}

	initFeedbacks() {
		const feedbacks = getFeedbacks.bind(this)()
		this.setFeedbackDefinitions(feedbacks)
	}

	initPresets() {
		const presets = getPresets.bind(this)()
		this.setPresetDefinitions(presets)
	}

	initActions() {
		const actions = getActions.bind(this)()
		this.setActionDefinitions(actions)
	}

	async connectOBS() {
		if (this.obs) {
			await this.obs.disconnect()
		} else {
			this.obs = new OBSWebSocket()
		}
		try {
			const { obsWebSocketVersion } = await this.obs.connect(
				`ws:///${this.config.host}:${this.config.port}`,
				this.config.pass,
				{
					eventSubscriptions:
						EventSubscription.All |
						EventSubscription.Ui |
						EventSubscription.InputActiveStateChanged |
						EventSubscription.InputShowStateChanged |
						EventSubscription.InputVolumeMeters |
						EventSubscription.SceneItemTransformChanged,
					rpcVersion: 1,
				}
			)
			if (obsWebSocketVersion) {
				this.updateStatus('ok')
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
			if (!this.reconnectionPoll) {
				this.startReconnectionPoll()

				if (error?.message.match(/(Server sent no subprotocol)/i)) {
					this.log('error', 'Failed to connect to OBS. Please upgrade OBS to version 28 or above')
					this.updateStatus('bad_config', 'Outdated websocket plugin')
				} else if (error?.message.match(/(missing an `authentication` string)/i)) {
					this.log(
						'error',
						`Failed to connect to OBS. Please enter your WebSocket Server password in the module settings`
					)
				} else if (error?.message.match(/(Authentication failed)/i)) {
					this.log(
						'error',
						`Failed to connect to OBS. Please ensure your WebSocket Server password is correct in the module settings`
					)
					this.updateStatus('bad_config', 'Invalid password')
				} else if (error?.message.match(/(ECONNREFUSED)/i)) {
					this.log('error', `Failed to connect to OBS. Please ensure OBS is open and reachable via your network`)
					this.updateStatus('connection_failure')
				} else {
					this.log('error', `Failed to connect to OBS (${error.message})`)
					this.updateStatus('unknown_error')
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

	connectionLost() {
		this.log('error', 'Connection lost to OBS')
		this.updateStatus('disconnected')
		this.disconnectOBS()
		if (!this.reconnectionPoll) {
			this.startReconnectionPoll()
		}
	}

	async obsListeners() {
		//General
		this.obs.once('ExitStarted', () => {
			this.connectionLost()
		})
		this.obs.on('VendorEvent', (data) => {
			this.vendorEvent = data
			this.checkFeedbacks('vendorEvent')
		})
		//Config
		this.obs.on('CurrentSceneCollectionChanging', () => {
			this.stopMediaPoll()
			this.states.sceneCollectionChanging = true
		})
		this.obs.on('CurrentSceneCollectionChanged', (data) => {
			this.states.currentSceneCollection = data.sceneCollectionName
			this.checkFeedbacks('scene_collection_active')
			this.setVariableValues({ scene_collection: this.states.currentSceneCollection })
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
			this.setVariableValues({ profile: this.states.currentProfile })
			this.obsInfo()
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
			this.setVariableValues({ scene_active: this.states.programScene })
			this.checkFeedbacks('scene_active')
			this.checkFeedbacks('sceneProgram')
		})
		this.obs.on('CurrentPreviewSceneChanged', (data) => {
			this.states.previewScene = data.sceneName ? data.sceneName : 'None'
			this.setVariableValues({ scene_preview: this.states.previewScene })
			this.checkFeedbacks('scene_active')
			this.checkFeedbacks('scenePreview')
		})
		this.obs.on('SceneListChanged', (data) => {
			this.scenes = data.scenes
		})
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
			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				[`mute_${name}`]: this.sources[data.inputName].inputMuted ? 'Muted' : 'Unmuted',
			})
			this.checkFeedbacks('audio_muted')
		})
		this.obs.on('InputVolumeChanged', (data) => {
			this.sources[data.inputName].inputVolume = this.roundNumber(data.inputVolumeDb, 1)
			let name = this.sources[data.inputName].validName
			this.setVariableValues({ [`volume_${name}`]: this.sources[data.inputName].inputVolume + 'db' })
			this.checkFeedbacks('volume')
		})
		this.obs.on('InputAudioBalanceChanged', (data) => {
			this.sources[data.inputName].inputAudioBalance = this.roundNumber(data.inputAudioBalance, 1)
			let name = this.sources[data.inputName].validName
			this.setVariableValues({ [`balance_${name}`]: this.sources[data.inputName].inputAudioBalance })
		})
		this.obs.on('InputAudioSyncOffsetChanged', (data) => {
			this.sources[data.inputName].inputAudioSyncOffset = data.inputAudioSyncOffset
			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				[`sync_offset_${name}`]: this.sources[data.inputName].inputAudioSyncOffset + 'ms',
			})
		})
		this.obs.on('InputAudioTracksChanged', () => {})
		this.obs.on('InputAudioMonitorTypeChanged', (data) => {
			this.sources[data.inputName].monitorType = data.monitorType
			let name = this.sources[data.inputName].validName
			let monitorType
			if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
				monitorType = 'Monitor / Output'
			} else if (data.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
				monitorType = 'Monitor Only'
			} else {
				monitorType = 'Off'
			}
			this.setVariableValues({ [`monitor_${name}`]: monitorType })
			this.checkFeedbacks('audio_monitor_type')
		})
		this.obs.on('InputVolumeMeters', (data) => {
			this.updateAudioPeak(data)
		})
		//Transitions
		this.obs.on('CurrentSceneTransitionChanged', async (data) => {
			let transition = await this.sendRequest('GetCurrentSceneTransition')

			this.states.currentTransition = data.transitionName
			this.states.transitionDuration = transition.transitionDuration ? transition.transitionDuration : '0'

			this.checkFeedbacks('transition_duration', 'current_transition')
			this.setVariableValues({
				current_transition: this.states.currentTransition,
				transition_duration: this.states.transitionDuration,
			})
		})
		this.obs.on('CurrentSceneTransitionDurationChanged', (data) => {
			this.states.transitionDuration = data.transitionDuration ? data.transitionDuration : '0'
			this.checkFeedbacks('transition_duration')
			this.setVariableValues({ transition_duration: this.states.transitionDuration })
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
		this.obs.on('SourceFilterCreated', (data) => {
			this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterRemoved', (data) => {
			this.getSourceFilters(data.sourceName)
		})
		this.obs.on('SourceFilterNameChanged', () => {})
		this.obs.on('SourceFilterEnableStateChanged', (data) => {
			if ('this.sourceFilters[data.sourceName]') {
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
			if (this.groups[data.sceneName]) {
				let sceneItem = this.groups[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
				this.groups[data.sceneName][sceneItem].sceneItemEnabled = data.sceneItemEnabled
			} else {
				let sceneItem = this.sceneItems[data.sceneName].findIndex((item) => item.sceneItemId === data.sceneItemId)
				this.sceneItems[data.sceneName][sceneItem].sceneItemEnabled = data.sceneItemEnabled
			}
			this.checkFeedbacks('scene_item_active_in_scene')
		})
		this.obs.on('SceneItemLockStateChanged', () => {})
		this.obs.on('SceneItemSelected', () => {})
		this.obs.on('SceneItemTransformChanged', async (data) => {
			if (data.sceneName) {
				let sceneItem = this.sceneItems[data.sceneName]?.findIndex((item) => item.sceneItemId === data.sceneItemId)
				if (sceneItem !== undefined) {
					let source = this.sceneItems[data.sceneName][sceneItem]?.sourceName
					if (source && this.sources[source]) {
						if (this.sceneItems[data.sceneName][sceneItem]?.inputKind) {
							let input = await this.sendRequest('GetInputSettings', { inputName: source })
							if (input) {
								this.sources[source].settings = input.inputSettings
								let name = this.sources[source].validName
								if (input.inputKind === 'text_ft2_source_v2' || input.inputKind === 'text_gdiplus_v2') {
									this.setVariableValues({
										[`current_text_${name}`]: input.inputSettings.text ? input.inputSettings.text : '',
									})
								}
								if (input.inputKind === 'image_source') {
									this.setVariableValues({
										[`image_file_name_${name}`]: input.inputSettings?.file
											? input.inputSettings?.file?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
											: '',
									})
								}
							}
						}
					}
				}
			}
		})
		//Outputs
		this.obs.on('StreamStateChanged', (data) => {
			this.states.streaming = data.outputActive

			this.setVariableValues({ streaming: this.states.streaming ? 'Live' : 'Off-Air' })
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
					this.setVariableValues({ recording_timecode: '00:00:00' })
				}
			}
			if (data.outputPath) {
				this.setVariableValues({ recording_file_name: data.outputPath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/) })
			}
			this.setVariableValues({ recording: this.states.recording })
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
			this.setVariableValues({ replay_buffer_path: data.savedReplayPath })
		})
		//Media Inputs
		this.obs.on('MediaInputPlaybackStarted', (data) => {
			this.states.currentMedia = data.inputName

			let name = this.sources[data.inputName].validName
			this.setVariableValues({
				current_media_name: this.states.currentMedia,
				[`media_status_${name}`]: 'Playing',
			})
		})
		this.obs.on('MediaInputPlaybackEnded', (data) => {
			if (this.states.currentMedia == data.inputName) {
				let name = this.sources[data.inputName].validName
				this.setVariableValues({
					current_media_name: 'None',
					[`media_status_${name}`]: 'Stopped',
				})
			}
		})
		this.obs.on('MediaInputActionTriggered', (data) => {
			if (data.mediaAction == 'OBS_WEBSOCKET_MEDIA_INPUT_ACTION_PAUSE') {
				let name = this.sources[data.inputName].validName
				this.setVariableValues({ [`media_status_${name}`]: 'Paused' })
			}
		})
		//UI
		this.obs.on('StudioModeStateChanged', (data) => {
			this.states.studioMode = data.studioModeEnabled ? true : false
			this.checkFeedbacks('studioMode')
		})
	}

	async sendRequest(requestType, requestData) {
		try {
			let data = await this.obs.call(requestType, requestData)
			return data
		} catch (error) {
			this.log('debug', `Request ${requestType} failed (${error})`)
		}
	}

	async sendBatch(batch) {
		try {
			this.obs.callBatch(batch)
		} catch (error) {
			this.log('debug', `Batch request failed (${error})`)
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
		try {
			let version = await this.sendRequest('GetVersion')
			this.states.version = version
			version.supportedImageFormats.forEach((format) => {
				this.imageFormats.push({ id: format, label: format })
			})

			let inputKindList = await this.sendRequest('GetInputKindList')
			this.states.inputKindList = inputKindList

			let hotkeyList = await this.sendRequest('GetHotkeyList')
			hotkeyList.hotkeys.forEach((hotkey) => {
				this.hotkeyNames.push({ id: hotkey, label: hotkey })
			})

			let studioMode = await this.sendRequest('GetStudioModeEnabled')
			this.states.studioMode = studioMode.studioModeEnabled ? true : false

			let videoSettings = await this.sendRequest('GetVideoSettings')
			this.states.resolution = `${videoSettings.baseWidth}x${videoSettings.baseHeight}`
			this.states.outputResolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`
			this.states.framerate = `${this.roundNumber(videoSettings.fpsNumerator / videoSettings.fpsDenominator, 2)} fps`
			this.setVariableValues({
				base_resolution: this.states.resolution,
				output_resolution: this.states.outputResolution,
				target_framerate: this.states.framerate,
			})

			let monitorList = await this.sendRequest('GetMonitorList')
			this.states.monitors = monitorList
			monitorList.monitors.forEach((monitor) => {
				let monitorName = monitor.monitorName
				if (monitorName?.match(/\([0-9]+\)/i)) {
					monitorName = `Display ${monitorName.replace(/[^0-9]/g, '')}`
				}
				this.monitors.push({
					id: monitor.monitorIndex,
					label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
				})
			})

			let outputData = await this.sendRequest('GetOutputList')
			this.outputs = {}
			this.outputList = []
			outputData.outputs.forEach((output) => {
				let outputKind = output.outputKind
				if (outputKind === 'virtualcam_output') {
					this.outputList.push({ id: 'virtualcam_output', label: 'Virtual Camera' })
				} else if (
					outputKind != 'ffmpeg_muxer' &&
					outputKind != 'ffmpeg_output' &&
					outputKind != 'replay_buffer' &&
					outputKind != 'rtmp_output'
				) {
					//The above outputKinds are handled separately by other actions, so they are omitted
					this.outputList.push({ id: output.outputName, label: output.outputName })
				}
				this.getOutputStatus(output.outputName)
			})
		} catch (error) {
			this.log('debug', error)
		}

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
				let freeSpace = this.roundNumber(data.availableDiskSpace, 0)
				if (freeSpace > 1000) {
					freeSpace = `${this.roundNumber(freeSpace / 1000, 0)} GB`
				} else {
					freeSpace = `${this.roundNumber(freeSpace, 0)} MB`
				}

				this.setVariableValues({
					fps: this.roundNumber(data.activeFps, 2),
					render_total_frames: data.renderTotalFrames,
					render_missed_frames: data.renderSkippedFrames,
					output_total_frames: data.outputTotalFrames,
					output_skipped_frames: data.outputSkippedFrames,
					average_frame_time: this.roundNumber(data.averageFrameRenderTime, 2),
					cpu_usage: `${this.roundNumber(data.cpuUsage, 2)}%`,
					memory_usage: `${this.roundNumber(data.memoryUsage, 0)} MB`,
					free_disk_space: freeSpace,
				})
			})
			.catch((error) => {
				if (error?.message.match(/(Not connected)/i)) {
					this.connectionLost()
				}
			})
	}

	async getOutputStatus(outputName) {
		let outputStatus = await this.sendRequest('GetOutputStatus', { outputName: outputName })
		this.outputs[outputName] = outputStatus
		this.checkFeedbacks('output_active')
	}

	async getStreamStatus() {
		let streamStatus = await this.sendRequest('GetStreamStatus')
		let streamService = await this.sendRequest('GetStreamServiceSettings')

		this.states.streaming = streamStatus.outputActive
		this.states.streamingTimecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
		this.states.streamCongestion = streamStatus.outputCongestion

		let kbits = 0
		if (streamStatus.outputBytes > this.states.outputBytes) {
			kbits = Math.round(((streamStatus.outputBytes - this.states.outputBytes) * 8) / 1000)
			this.states.outputBytes = streamStatus.outputBytes
		} else {
			this.states.outputBytes = streamStatus.outputBytes
		}

		this.checkFeedbacks('streaming', 'streamCongestion')
		this.setVariableValues({
			streaming: streamStatus.outputActive ? 'Live' : 'Off-Air',
			stream_timecode: this.states.streamingTimecode,
			output_skipped_frames: streamStatus.outputSkippedFrames,
			output_total_frames: streamStatus.outputTotalFrames,
			kbits_per_sec: kbits,
			stream_service: streamService.streamServiceSettings?.service
				? streamService.streamServiceSettings.service
				: 'Custom',
		})
	}

	async getSceneTransitionList() {
		this.transitionList = []

		let sceneTransitionList = await this.sendRequest('GetSceneTransitionList')
		let currentTransition = await this.sendRequest('GetSceneTransitionList')

		sceneTransitionList.transitions.forEach((transition) => {
			this.transitionList.push({ id: transition.transitionName, label: transition.transitionName })
		})

		this.states.currentTransition = currentTransition.transitionName
		this.states.transitionDuration = currentTransition.transitionDuration ? currentTransition.transitionDuration : '0'

		this.checkFeedbacks('transition_duration', 'current_transition')
		this.setVariableValues({
			current_transition: this.states.currentTransition,
			transition_duration: this.states.transitionDuration,
		})
	}

	async getRecordStatus() {
		let recordStatus = await this.sendRequest('GetRecordStatus')
		let recordDirectory = await this.sendRequest('GetRecordDirectory')

		if (recordStatus.outputActive === true) {
			this.states.recording = 'Recording'
		} else {
			this.states.recording = recordStatus.outputPaused ? 'Paused' : 'Stopped'
		}

		this.states.recordingTimecode = recordStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
		this.states.recordDirectory = recordDirectory.recordDirectory

		this.checkFeedbacks('recording')
		this.setVariableValues({
			recording: this.states.recording,
			recording_timecode: this.states.recordingTimecode,
			recording_path: this.states.recordDirectory,
		})
	}

	async getProfileList() {
		let profiles = await this.sendRequest('GetProfileList')
		this.profileChoices = []

		this.states.currentProfile = profiles.currentProfileName

		profiles.profiles.forEach((profile) => {
			this.profileChoices.push({ id: profile, label: profile })
		})

		this.checkFeedbacks('profile_active')
		this.setVariableValues({ profile: this.states.currentProfile })
		this.updateActionsFeedbacksVariables()
	}

	async getSceneCollectionList() {
		let collections = await this.sendRequest('GetSceneCollectionList')
		this.sceneCollectionList = []

		this.states.currentSceneCollection = collections.currentSceneCollectionName
		collections.sceneCollections.forEach((sceneCollection) => {
			this.sceneCollectionList.push({ id: sceneCollection, label: sceneCollection })
		})

		this.checkFeedbacks('scene_collection_active')
		this.setVariableValues({ scene_collection: this.states.currentSceneCollection })

		this.updateActionsFeedbacksVariables()
	}

	getAudioSources(sourceName) {
		this.obs
			.call('GetInputAudioTracks', { inputName: sourceName })
			.then((data) => {
				if (!this.audioSourceList.find((item) => item.id === sourceName)) {
					this.audioSourceList.push({ id: sourceName, label: sourceName })
					this.sources[sourceName].inputAudioTracks = data.inputAudioTracks
					this.getSourceAudio(sourceName)
					this.updateActionsFeedbacksVariables()
				}
			})
			.catch((error) => {})
	}

	async getSourceAudio(sourceName) {
		let validName = sourceName.replace(/[\W]/gi, '_')

		let inputMute = await this.sendRequest('GetInputMute', { inputName: sourceName })
		this.sources[sourceName].inputMuted = inputMute.inputMuted

		let inputVolume = await this.sendRequest('GetInputVolume', { inputName: sourceName })
		this.sources[sourceName].inputVolume = this.roundNumber(inputVolume.inputVolumeDb, 1)

		let audioBalance = await this.sendRequest('GetInputAudioBalance', { inputName: sourceName })
		this.sources[sourceName].inputAudioBalance = this.roundNumber(audioBalance.inputAudioBalance, 1)

		let syncOffset = await this.sendRequest('GetInputAudioSyncOffset', { inputName: sourceName })
		this.sources[sourceName].inputAudioSyncOffset = syncOffset.inputAudioSyncOffset

		let audioMonitor = await this.sendRequest('GetInputAudioMonitorType', { inputName: sourceName })
		this.sources[sourceName].monitorType = audioMonitor.monitorType
		let monitorType
		if (audioMonitor.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
			monitorType = 'Monitor / Output'
		} else if (audioMonitor.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
			monitorType = 'Monitor Only'
		} else {
			monitorType = 'Off'
		}

		let audioTracks = await this.sendRequest('GetInputAudioTracks', { inputName: sourceName })
		this.sources[sourceName].inputAudioTracks = audioTracks.inputAudioTracks

		this.setVariableValues({
			[`mute_${validName}`]: this.sources[sourceName].inputMuted ? 'Muted' : 'Unmuted',
			[`volume_${validName}`]: this.sources[sourceName].inputVolume + 'db',
			[`balance_${validName}`]: this.sources[sourceName].inputAudioBalance,
			[`sync_offset_${validName}`]: this.sources[sourceName].inputAudioSyncOffset + 'ms',
			[`monitor_${validName}`]: monitorType,
		})
		this.checkFeedbacks('audio_muted', 'volume', 'audio_monitor_type')

		this.updateActionsFeedbacksVariables()
	}

	async getSourceFilters(sourceName) {
		let data = await this.sendRequest('GetSourceFilterList', { sourceName: sourceName })

		if (data?.filters) {
			this.sourceFilters[sourceName] = data.filters
			data.filters.forEach((filter) => {
				if (!this.filterList.find((item) => item.id === filter.filterName)) {
					this.filterList.push({ id: filter.filterName, label: filter.filterName })
				}
			})

			this.updateActionsFeedbacksVariables()
		}
	}

	getGroupInfo(groupName) {
		this.obs
			.call('GetGroupSceneItemList', { sceneName: groupName })
			.then((data) => {
				this.groups[groupName] = data.sceneItems
				data.sceneItems.forEach((sceneItem) => {
					let sourceName = sceneItem.sourceName
					this.sources[sourceName] = sceneItem
					this.sources[sourceName].groupedSource = true
					this.sources[sourceName].groupName = groupName

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

	async getInputSettings(sourceName, inputKind) {
		let settings = await this.sendRequest('GetInputSettings', { inputName: sourceName })

		let name = this.sources[sourceName].validName ? this.sources[sourceName].validName : sourceName
		this.sources[sourceName].settings = settings.inputSettings

		if (inputKind === 'text_ft2_source_v2' || inputKind === 'text_gdiplus_v2') {
			//Exclude text sources that read from file, as there is no way to edit or read the text value
			if (settings?.inputSettings?.text) {
				this.textSourceList.push({ id: sourceName, label: sourceName })
				this.setVariableValues({
					[`current_text_${name}`]: settings.inputSettings.text ? settings.inputSettings.text : '',
				})
			} else if (settings?.inputSettings?.from_file) {
				this.setVariableValues({
					[`current_text_${name}`]: `Text from file: ${settings.inputSettings.text_file}`,
				})
			}

			this.updateActionsFeedbacksVariables()
		}
		if (inputKind === 'ffmpeg_source' || inputKind === 'vlc_source') {
			this.mediaSourceList.push({ id: sourceName, label: sourceName })
			this.startMediaPoll()
			this.updateActionsFeedbacksVariables()
		}
		if (inputKind === 'image_source') {
			this.imageSourceList.push({ id: sourceName, label: sourceName })
		}
	}

	async getSceneItems(sceneName) {
		let data = await this.sendRequest('GetSceneItemList', { sceneName: sceneName })

		this.sceneItems[sceneName] = data.sceneItems
		data.sceneItems.forEach(async (sceneItem) => {
			let sourceName = sceneItem.sourceName
			this.sources[sourceName] = sceneItem

			//Generate name that can be used as valid Variable IDs
			this.sources[sourceName].validName = sceneItem.sourceName.replace(/[\W]/gi, '_')

			if (!this.sourceChoices.find((item) => item.id === sourceName)) {
				this.sourceChoices.push({ id: sourceName, label: sourceName })
			}

			if (sceneItem.isGroup) {
				this.getGroupInfo(sourceName)
			}
			let active = await this.sendRequest('GetSourceActive', { sourceName: sourceName })

			if (this.sources[sourceName]) {
				this.sources[sourceName].active = active.videoActive
			}

			this.getSourceFilters(sourceName)
			this.getAudioSources(sourceName)

			if (sceneItem.inputKind) {
				let inputKind = sceneItem.inputKind
				this.getInputSettings(sourceName, inputKind)
			}

			this.updateActionsFeedbacksVariables()
		})
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

	async getScenesSources() {
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

		let sceneList = await this.sendRequest('GetSceneList')

		this.scenes = sceneList.scenes
		this.states.previewScene = sceneList.currentPreviewSceneName ? sceneList.currentPreviewSceneName : 'None'
		this.states.programScene = sceneList.currentProgramSceneName

		this.setVariableValues({
			scene_preview: this.states.previewScene,
			scene_active: this.states.programScene,
		})

		sceneList.scenes.forEach((scene) => {
			let sceneName = scene.sceneName
			this.addScene(sceneName)
			this.getSourceFilters(sceneName)
		})

		let specialInputs = await this.sendRequest('GetSpecialInputs')

		for (let x in specialInputs) {
			let input = specialInputs[x]
			if (input) {
				this.sources[input] = {
					sourceName: input,
					validName: input.replace(/[\W]/gi, '_'),
				}

				if (!this.sourceChoices.find((item) => item.id === input)) {
					this.sourceChoices.push({ id: input, label: input })
				}
				this.getAudioSources(input)
			}
		}
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
			this.mediaSourceList.forEach(async (source) => {
				let sourceName = source.id.replace(/[\W]/gi, '_')

				let data = await this.sendRequest('GetMediaInputStatus', { inputName: source.id })

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
					this.setVariableValues({
						current_media_name: source.id,
						current_media_time_elapsed: this.mediaSources[source.id].timeElapsed,
						current_media_time_remaining: this.mediaSources[source.id].timeRemaining,
						[`media_status_${sourceName}`]: 'Playing',
					})
				} else if (data.mediaState === 'OBS_MEDIA_STATE_PAUSED') {
					this.setVariableValues({ [`media_status_${sourceName}`]: 'Paused' })
				} else {
					this.setVariableValues({ [`media_status_${sourceName}`]: 'Stopped' })
				}
				this.setVariableValues({
					[`media_time_elapsed_${sourceName}`]: this.mediaSources[source.id].timeElapsed,
					[`media_time_remaining_${sourceName}`]: remaining,
				})
				this.checkFeedbacks('media_playing', 'media_source_time_remaining')

				/* this.obs
					.call('GetInputSettings', { inputName: source.id })
					.then((settings) => {
						if (settings.inputKind === 'vlc_source') {
						}
					})
					.catch((error) => {}) */
			})
		}, 1000)
	}

	stopMediaPoll() {
		if (this.mediaPoll) {
			clearInterval(this.mediaPoll)
			this.mediaPoll = null
		}
	}

	updateAudioPeak(data) {
		this.audioPeak = {}
		data.inputs.forEach((input) => {
			let channel = input.inputLevelsMul[0]
			if (channel) {
				let channelPeak = channel?.[1]
				let dbPeak = Math.round(20.0 * Math.log10(channelPeak))
				if (this.audioPeak && dbPeak) {
					this.audioPeak[input.inputName] = dbPeak
					this.checkFeedbacks('audioPeaking', 'audioMeter')
				}
			}
		})
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

		this.initActions()
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
		this.vendorEvent = {}
		this.states.sceneCollectionChanging = false
		this.initActions()
		this.initVariables()
		this.initFeedbacks()
		this.initPresets()
		this.checkFeedbacks()
	}
}
runEntrypoint(OBSInstance, UpgradeScripts)
