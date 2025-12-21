import { InstanceStatus } from '@companion-module/base'
import OBSWebSocket, { EventSubscription } from 'obs-websocket-js'
import { initOBSListeners } from './listeners.js'
import type { OBSInstance } from './main.js'
import * as utils from './utils.js'

export class OBSApi {
	private self: OBSInstance

	constructor(self: OBSInstance) {
		this.self = self
	}

	// Initialization & Connection
	public initializeStates(): void {
		this.self.obsState.resetSceneSourceStates()
		// Basic Info
		this.self.states.sceneCollectionChanging = false
	}

	public async connectOBS(): Promise<void> {
		if (this.self.socket) {
			this.self.socket.removeAllListeners()
			await this.self.socket.disconnect()
		} else {
			this.self.socket = new OBSWebSocket()
		}
		try {
			const { obsWebSocketVersion } = await this.self.socket.connect(
				`ws://${this.self.config.host}:${this.self.config.port}`,
				this.self.config.pass,
				{
					eventSubscriptions:
						EventSubscription.All |
						EventSubscription.InputActiveStateChanged |
						EventSubscription.InputShowStateChanged |
						EventSubscription.InputVolumeMeters |
						EventSubscription.SceneItemTransformChanged,
					rpcVersion: 1,
				},
			)
			if (obsWebSocketVersion) {
				this.self.updateStatus(InstanceStatus.Ok)
				void this.stopReconnectionPoll()
				this.self.log('info', 'Connected to OBS')

				//Setup Initial State Objects
				this.initializeStates()

				//Get Initial OBS Info
				const initialInfo = await this.obsInfo()

				if (initialInfo) {
					//Start Listeners
					initOBSListeners(this.self)

					//Get Project Info
					await this.getStats()
					await this.getRecordStatus()
					await this.getStreamStatus()
					await this.startStatsPoll()

					//Build General Parameters
					await this.buildProfileList()
					await this.buildSceneCollectionList()

					//Build Scene Collection Parameters
					await this.buildSceneTransitionList()
					await this.buildSpecialInputs()
					await this.buildSceneList()
				} else {
					//throw an error if initial info returns false.
					throw new Error('could not get OBS info')
				}
			}
		} catch (error) {
			this.processWebsocketError(error)
		}
	}

	public processWebsocketError(error: unknown): void {
		if (!this.self.reconnectionPoll) {
			let tryReconnect = null
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.match(/(Server sent no subprotocol)/i)) {
				tryReconnect = false
				this.self.log('error', 'Failed to connect to OBS. Please upgrade OBS to version 28 or above')
				this.self.updateStatus(InstanceStatus.ConnectionFailure, 'Outdated OBS version')
			} else if (errorMessage.match(/(missing an `authentication` string)/i)) {
				tryReconnect = false
				this.self.log(
					'error',
					`Failed to connect to OBS. Please enter your WebSocket Server password in the module settings`,
				)
				this.self.updateStatus(InstanceStatus.BadConfig, 'Missing password')
			} else if (errorMessage.match(/(Authentication failed)/i)) {
				tryReconnect = false
				this.self.log(
					'error',
					`Failed to connect to OBS. Please ensure your WebSocket Server password is correct in the module settings`,
				)
				this.self.updateStatus(InstanceStatus.AuthenticationFailure)
			} else if (errorMessage.match(/(ECONNREFUSED)/i)) {
				tryReconnect = true
				this.self.log('error', `Failed to connect to OBS. Please ensure OBS is open and reachable via your network`)
				this.self.updateStatus(InstanceStatus.ConnectionFailure)
			} else {
				tryReconnect = true
				this.self.log('error', `Failed to connect to OBS (${errorMessage})`)
				this.self.updateStatus(InstanceStatus.UnknownError)
			}
			if (tryReconnect) {
				void this.startReconnectionPoll()
			}
		}
	}

	public async disconnectOBS(): Promise<void> {
		if (this.self.socket) {
			//Clear all active polls
			void this.stopStatsPoll()
			void this.stopMediaPoll()
			//Remove listeners, will recreate on connection
			this.self.socket.removeAllListeners()
			//Disconnect from OBS
			await this.self.socket.disconnect()
		}
	}

	public async connectionLost(): Promise<void> {
		if (!this.self.reconnectionPoll) {
			this.self.log('error', 'Connection lost to OBS')
			this.self.updateStatus(InstanceStatus.Disconnected)
			await this.disconnectOBS()

			void this.startReconnectionPoll()
		}
	}

	// OBS Websocket Commands
	public async sendRequest(requestType: string, requestData?: unknown): Promise<any> {
		try {
			const data = await this.self.socket.call(requestType as any, requestData)
			return data
		} catch (error) {
			this.self.log('debug', `Request ${requestType ?? ''} failed (${error})`)
			return
		}
	}

	public async sendCustomRequest(requestType: string, requestData?: unknown): Promise<any> {
		try {
			const data = await this.self.socket.call(requestType as any, requestData)
			if (data) {
				this.self.log(
					'debug',
					`Custom Command Response: Request ${requestType ?? ''} replied with ${requestData ? `data ${JSON.stringify(data)}` : 'no data'}`,
				)
				this.self.setVariableValues({
					custom_command_type: requestType,
					custom_command_request: requestData ? JSON.stringify(requestData) : '',
					custom_command_response: JSON.stringify(data),
				})
			} else {
				this.self.states.custom_command_request = ''
				this.self.states.custom_command_response = ''
				this.self.setVariableValues({
					custom_command_request: '',
					custom_command_response: '',
				})
			}
			return data
		} catch (error) {
			this.self.log(
				'warn',
				`Custom Command Failed: Request ${requestType ?? ''} with data ${requestData ? JSON.stringify(requestData) : 'none'} failed (${error})`,
			)
			return
		}
	}

	public async sendBatch(batch: any[]): Promise<any> {
		try {
			const data = await this.self.socket.callBatch(batch)
			const errors = data.filter((request: any) => request.requestStatus.result === false)
			if (errors.length > 0) {
				const errorMessages = errors.map((error: any) => error.requestStatus.comment).join(' // ')
				this.self.log('debug', `Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error) {
			this.self.log('debug', `Request GetStats failed (${error as any})`)
			return
		}
	}

	// Polls
	public async startReconnectionPoll(): Promise<void> {
		void this.stopReconnectionPoll()
		this.self.reconnectionPoll = setInterval(() => {
			void this.connectOBS()
		}, 5000)
	}

	public async stopReconnectionPoll(): Promise<void> {
		if (this.self.reconnectionPoll) {
			clearInterval(this.self.reconnectionPoll)
			delete this.self.reconnectionPoll
		}
	}

	public async startStatsPoll(): Promise<void> {
		void this.stopStatsPoll()
		if (this.self.socket) {
			this.self.statsPoll = setInterval(() => {
				void this.getStats()
				if (this.self.states.streaming) {
					void this.getStreamStatus()
				}
				if (this.self.states.recording === 'Recording') {
					void this.getRecordStatus()
				}
				if (this.self.states.outputs) {
					for (const outputName in this.self.states.outputs) {
						void this.getOutputStatus(outputName)
					}
				}
			}, 1000)
		}
	}

	public async stopStatsPoll(): Promise<void> {
		if (this.self.statsPoll) {
			clearInterval(this.self.statsPoll)
			delete this.self.statsPoll
		}
	}

	public async startMediaPoll(): Promise<void> {
		void this.stopMediaPoll()
		this.self.mediaPoll = setInterval(() => {
			void this.getMediaStatus()
		}, 1000)
	}

	public async stopMediaPoll(): Promise<void> {
		if (this.self.mediaPoll) {
			clearInterval(this.self.mediaPoll)
			this.self.mediaPoll = null
		}
	}

	// General OBS Project Info
	public async obsInfo(): Promise<boolean> {
		try {
			const version = await this.sendRequest('GetVersion')
			this.self.states.version = version
			this.self.log(
				'debug',
				`OBS Version: ${version.obsVersion} // OBS Websocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			this.self.states.imageFormats = []
			version.supportedImageFormats.forEach((format: string) => {
				this.self.states.imageFormats.push({ id: format, label: format })
			})

			const studioMode = await this.sendRequest('GetStudioModeEnabled')
			this.self.states.studioMode = studioMode.studioModeEnabled ? true : false

			await this.buildHotkeyList()
			await this.buildOutputList()
			await this.buildMonitorList()
			await this.getVideoSettings()
			await this.getReplayBufferStatus()
			await this.getInputKindList()

			return true
		} catch (error) {
			this.self.log('debug', error as any)
			return false
		}
	}

	public async buildHotkeyList(): Promise<void> {
		const hotkeyList = await this.sendRequest('GetHotkeyList')
		this.self.states.hotkeyNames = []
		hotkeyList?.hotkeys?.forEach((hotkey: any) => {
			this.self.states.hotkeyNames.push({ id: hotkey, label: hotkey })
		})
		void this.self.updateActionsFeedbacksVariables()
	}

	public async getInputKindList(): Promise<void> {
		const inputKindList = await this.sendRequest('GetInputKindList')
		await Promise.all(
			inputKindList?.inputKinds?.map(async (inputKind: any) => {
				this.self.states.inputKindList.set(inputKind, {})
				const defaultSettings = await this.sendRequest('GetInputDefaultSettings', { inputKind: inputKind })
				this.self.states.inputKindList.set(inputKind, defaultSettings)
			}) ?? [],
		)
	}

	public async buildProfileList(): Promise<void> {
		const profiles = await this.sendRequest('GetProfileList')
		this.self.states.profiles.clear()

		this.self.states.currentProfile = profiles?.currentProfileName

		profiles?.profiles.forEach((profile: any) => {
			this.self.states.profiles.set(profile, {})
		})

		this.self.checkFeedbacks('profile_active')
		this.self.setVariableValues({ profile: this.self.states.currentProfile })
		void this.self.updateActionsFeedbacksVariables()
	}

	public async buildSceneCollectionList(): Promise<void> {
		const collections = await this.sendRequest('GetSceneCollectionList')
		this.self.states.sceneCollections.clear()

		this.self.states.currentSceneCollection = collections?.currentSceneCollectionName
		collections?.sceneCollections.forEach((sceneCollection: any) => {
			this.self.states.sceneCollections.set(sceneCollection, {})
		})

		this.self.checkFeedbacks('scene_collection_active')
		this.self.setVariableValues({ scene_collection: this.self.states.currentSceneCollection })

		void this.self.updateActionsFeedbacksVariables()
	}

	public async buildSpecialInputs(): Promise<void> {
		const specialInputs = await this.sendRequest('GetSpecialInputs')
		if (specialInputs) {
			await Promise.all(
				Object.values(specialInputs).map(async (input) => {
					if (input) {
						const inputName = input as string
						this.self.states.sources.set(inputName, {
							sourceName: inputName,
							validName: utils.validName(this.self, inputName),
						})

						await this.getAudioSources(inputName)
					}
				}),
			)
		}
	}

	public async buildOutputList(): Promise<void> {
		this.self.states.outputs.clear()

		const outputData = await this.sendRequest('GetOutputList')

		if (outputData) {
			outputData.outputs?.forEach((output: any) => {
				this.self.states.outputs.set(output.outputName, output)

				void this.getOutputStatus(output.outputName)
			})
			void this.self.updateActionsFeedbacksVariables()
		}
	}

	public async buildMonitorList(): Promise<void> {
		const monitorList = await this.sendRequest('GetMonitorList')

		if (monitorList && Array.isArray(monitorList.monitors)) {
			this.self.states.monitors = monitorList.monitors.map((monitor: any) => {
				const monitorName = monitor.monitorName ?? `Display ${monitor.monitorIndex}`

				return {
					id: monitor.monitorIndex,
					label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
				}
			})
		}
	}

	public async getStats(): Promise<void> {
		this.self.socket
			.call('GetStats')
			.then((data) => {
				this.self.states.stats = data

				const freeSpaceMB = utils.roundNumber(this.self, data.availableDiskSpace, 0)
				let freeSpace: number | string = freeSpaceMB
				if (freeSpace > 1000) {
					freeSpace = `${utils.roundNumber(this.self, freeSpace / 1000, 0)} GB`
				} else {
					freeSpace = `${utils.roundNumber(this.self, freeSpace, 0)} MB`
				}

				this.self.setVariableValues({
					fps: utils.roundNumber(this.self, data.activeFps, 2),
					render_total_frames: data.renderTotalFrames,
					render_missed_frames: data.renderSkippedFrames,
					output_total_frames: data.outputTotalFrames,
					output_skipped_frames: data.outputSkippedFrames,
					average_frame_time: utils.roundNumber(this.self, data.averageFrameRenderTime, 2),
					cpu_usage: `${utils.roundNumber(this.self, data.cpuUsage, 2)}%`,
					memory_usage: `${utils.roundNumber(this.self, data.memoryUsage, 0)} MB`,
					free_disk_space: freeSpace,
					free_disk_space_mb: freeSpaceMB,
				})
				this.self.checkFeedbacks('freeDiskSpaceRemaining')
			})
			.catch((error) => {
				if (error?.message.match(/(Not connected)/i)) {
					void this.connectionLost()
				}
			})
	}

	public async getVideoSettings(): Promise<void> {
		const videoSettings = await this.sendRequest('GetVideoSettings')

		if (videoSettings) {
			this.self.states.resolution = `${videoSettings.baseWidth}x${videoSettings.baseHeight}`
			this.self.states.outputResolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`
			this.self.states.framerate = `${utils.roundNumber(this.self, videoSettings.fpsNumerator / videoSettings.fpsDenominator, 2)} fps`
			this.self.setVariableValues({
				base_resolution: this.self.states.resolution,
				output_resolution: this.self.states.outputResolution,
				target_framerate: this.self.states.framerate,
			})
		}
	}

	// Outputs, Streams, Recordings
	public async getStreamStatus(): Promise<void> {
		const streamStatus = await this.sendRequest('GetStreamStatus')
		const streamService = await this.sendRequest('GetStreamServiceSettings')

		if (streamStatus) {
			this.self.states.streaming = streamStatus.outputActive
			this.self.states.streamingTimecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)

			const timecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.self.states.streamingTimecode = timecode
			const streamingTimecodeSplit = String(timecode)?.split(':')

			this.self.states.streamCongestion = streamStatus.outputCongestion

			let kbits = 0
			if (streamStatus.outputBytes > this.self.states.outputBytes) {
				kbits = Math.round(((streamStatus.outputBytes - this.self.states.outputBytes) * 8) / 1000)
				this.self.states.outputBytes = streamStatus.outputBytes
			} else {
				this.self.states.outputBytes = streamStatus.outputBytes
			}

			this.self.checkFeedbacks('streaming', 'streamCongestion')
			this.self.setVariableValues({
				streaming: streamStatus.outputActive ? 'Live' : 'Off-Air',
				stream_timecode: this.self.states.streamingTimecode,
				stream_timecode_hh: streamingTimecodeSplit[0],
				stream_timecode_mm: streamingTimecodeSplit[1],
				stream_timecode_ss: streamingTimecodeSplit[2],
				output_skipped_frames: streamStatus.outputSkippedFrames,
				output_total_frames: streamStatus.outputTotalFrames,
				kbits_per_sec: kbits,
				stream_service: streamService?.streamServiceSettings?.service ?? 'Custom',
			})
		}
	}

	public async getRecordStatus(): Promise<void> {
		const recordStatus = await this.sendRequest('GetRecordStatus')
		const recordDirectory = await this.sendRequest('GetRecordDirectory')

		if (recordStatus) {
			if (recordStatus.outputActive === true) {
				this.self.states.recording = 'Recording'
			} else {
				this.self.states.recording = recordStatus.outputPaused ? 'Paused' : 'Stopped'
			}

			const timecode = recordStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
			this.self.states.recordingTimecode = timecode
			const recordingTimecodeSplit = String(timecode)?.split(':')
			this.self.states.recordDirectory = recordDirectory.recordDirectory

			this.self.checkFeedbacks('recording')
			this.self.setVariableValues({
				recording: this.self.states.recording,
				recording_timecode: this.self.states.recordingTimecode,
				recording_timecode_hh: recordingTimecodeSplit[0],
				recording_timecode_mm: recordingTimecodeSplit[1],
				recording_timecode_ss: recordingTimecodeSplit[2],
				recording_path: this.self.states.recordDirectory,
			})
		}
	}

	public async getOutputStatus(outputName: string): Promise<void> {
		if (!this.self.states.sceneCollectionChanging) {
			const outputStatus = await this.sendRequest('GetOutputStatus', { outputName: outputName })
			this.self.states.outputs.set(outputName, outputStatus)
			this.self.checkFeedbacks('output_active')
		}
	}

	public async getReplayBufferStatus(): Promise<void> {
		const replayBuffer = await this.sendRequest('GetReplayBufferStatus')

		if (replayBuffer) {
			this.self.states.replayBuffer = replayBuffer.outputActive
			this.self.checkFeedbacks('replayBufferActive')
		}
	}

	// Scene Collection Specific Info
	public async buildSceneList(): Promise<void> {
		this.self.states.scenes.clear()

		const sceneList = await this.sendRequest('GetSceneList')

		if (sceneList) {
			if (Array.isArray(sceneList.scenes)) {
				for (const scene of sceneList.scenes) {
					this.self.states.scenes.set(scene.sceneName, scene)
				}
			}
			this.self.states.previewScene = sceneList.currentPreviewSceneName ?? 'None'
			this.self.states.programScene = sceneList.currentProgramSceneName

			this.self.setVariableValues({
				scene_preview: this.self.states.previewScene,
				scene_active: this.self.states.programScene,
			})

			await Promise.all(
				Array.from(this.self.states.scenes.values()).map(async (scene: any) => {
					const sceneName = scene.sceneName
					await this.buildSourceList(sceneName)

					await this.getSourceFilters(sceneName)
				}),
			)
			void this.self.updateActionsFeedbacksVariables()
		}
	}

	public async buildSourceList(sceneName: string): Promise<void> {
		const data = await this.sendRequest('GetSceneItemList', { sceneName: sceneName })

		if (data) {
			this.self.states.sceneItems.set(sceneName, data.sceneItems)

			const batch = []
			for (const sceneItem of data.sceneItems as any[]) {
				const sourceName = sceneItem.sourceName
				if (!this.self.states.sources.has(sourceName)) {
					this.self.states.sources.set(sourceName, {
						sourceName: sourceName,
						validName: utils.validName(this.self, sourceName),
						isGroup: sceneItem.isGroup,
						inputKind: sceneItem.inputKind,
					})
				}

				if (sceneItem.isGroup) {
					await this.getGroupInfo(sourceName)
				}

				batch.push(
					{
						requestId: sourceName,
						requestType: 'GetSourceActive',
						requestData: { sourceName: sourceName },
					},
					{
						requestId: sourceName,
						requestType: 'GetSourceFilterList',
						requestData: { sourceName: sourceName },
					},
				)
				if (sceneItem.inputKind) {
					batch.push({
						requestId: sourceName,
						requestType: 'GetInputSettings',
						requestData: { inputName: sourceName },
					})
				}
				await this.getAudioSources(sourceName)
			}

			const sourceBatch = await this.sendBatch(batch)

			if (sourceBatch) {
				for (const response of sourceBatch) {
					if (response.requestStatus.result) {
						const sourceName = response.requestId
						const type = response.requestType
						const data = response.responseData
						const source = this.self.states.sources.get(sourceName)

						if (source) {
							switch (type) {
								case 'GetSourceActive':
									source.active = data.videoActive
									source.videoShowing = data.videoShowing
									break
								case 'GetSourceFilterList':
									this.self.states.sourceFilters.set(sourceName, data.filters)
									break
								case 'GetInputSettings':
									this.buildInputSettings(sourceName, data.inputKind, data.inputSettings)
									break
								default:
									break
							}
						}
					}
				}
				this.self.checkFeedbacks('scene_item_active')
			}
		}
	}

	public async getGroupInfo(groupName: string): Promise<void> {
		const data = await this.sendRequest('GetGroupSceneItemList', { sceneName: groupName })
		if (data) {
			this.self.states.groups.set(groupName, data.sceneItems)
			await Promise.all(
				data.sceneItems?.map(async (sceneItem: any) => {
					const sourceName = sceneItem.sourceName
					let source = this.self.states.sources.get(sourceName)
					if (!source) {
						source = {
							sourceName: sourceName,
							validName: utils.validName(this.self, sourceName),
							inputKind: sceneItem.inputKind,
						}
						this.self.states.sources.set(sourceName, source)
					}

					//Flag that this source is part of a group
					source.groupedSource = true
					source.groupName = groupName

					await this.getSourceFilters(sourceName)
					await this.getAudioSources(sourceName)

					if (sceneItem.inputKind) {
						const input = await this.sendRequest('GetInputSettings', { inputName: sourceName })

						if (input.inputSettings) {
							this.buildInputSettings(sourceName, sceneItem.inputKind, input.inputSettings)
						}
					}
				}) ?? [],
			)
		}
	}

	public async buildSceneTransitionList(): Promise<void> {
		this.self.states.transitions.clear()

		const sceneTransitionList = await this.sendRequest('GetSceneTransitionList')
		const currentTransition = await this.sendRequest('GetCurrentSceneTransition')

		if (sceneTransitionList) {
			if (Array.isArray(sceneTransitionList.transitions)) {
				for (const item of sceneTransitionList.transitions) {
					this.self.states.transitions.set(item.transitionName, item)
				}
			}

			const transitionListVariable = this.self.obsState.transitionList?.map((item) => item.id) ?? []

			this.self.states.currentTransition = currentTransition?.transitionName ?? 'None'
			this.self.states.transitionDuration = currentTransition?.transitionDuration ?? '0'

			this.self.checkFeedbacks('transition_duration', 'current_transition')
			this.self.setVariableValues({
				current_transition: this.self.states.currentTransition,
				transition_duration: this.self.states.transitionDuration,
				transition_active: 'False',
				transition_list: transitionListVariable.join(', '),
			})
		}
	}

	// Scene and Source Actions
	public async addScene(sceneName: string): Promise<void> {
		this.self.states.scenes.set(sceneName, { sceneName: sceneName, sceneIndex: this.self.states.scenes.size })
		await this.buildSourceList(sceneName)
		void this.self.updateActionsFeedbacksVariables()
	}

	public async removeScene(sceneName: string): Promise<void> {
		this.self.states.scenes.delete(sceneName)
		this.self.states.sceneItems.delete(sceneName)
		void this.self.updateActionsFeedbacksVariables()
	}

	// Source Info
	public async getMediaStatus(): Promise<void> {
		const batch = []
		for (const source of this.self.obsState.mediaSourceList) {
			const sourceName = source.id
			batch.push({
				requestId: sourceName,
				requestType: 'GetMediaInputStatus',
				requestData: { inputName: sourceName },
			})
		}

		const data = await this.sendBatch(batch)

		if (data) {
			const currentMedia = []
			for (const response of data) {
				if (response.requestStatus.result) {
					const sourceName = response.requestId
					const validName = this.self.states.sources.get(sourceName)?.validName ?? sourceName
					const data = response.responseData

					this.self.states.mediaSources.set(sourceName, data)

					const remainingValue = (data?.mediaDuration ?? 0) - (data?.mediaCursor ?? 0)
					let remaining: string
					if (remainingValue > 0) {
						remaining = utils.formatTimecode(this.self, remainingValue)
					} else {
						remaining = '--:--:--'
					}

					let mediaSource = this.self.states.mediaSources.get(sourceName)
					if (mediaSource) {
						mediaSource.timeElapsed = utils.formatTimecode(this.self, data.mediaCursor)
						mediaSource.timeRemaining = remaining
					}

					if (data?.mediaState) {
						switch (data?.mediaState) {
							case 'OBS_MEDIA_STATE_PLAYING':
								if (this.self.states.sources.get(sourceName)?.active == true) {
									mediaSource = this.self.states.mediaSources.get(sourceName)
									currentMedia.push({
										name: sourceName,
										elapsed: mediaSource?.timeElapsed,
										remaining: mediaSource?.timeRemaining,
									})
								}
								this.self.setVariableValues({
									[`media_status_${validName}`]: 'Playing',
								})
								break
							case 'OBS_MEDIA_STATE_PAUSED':
								if (this.self.states.sources.get(sourceName)?.active == true) {
									mediaSource = this.self.states.mediaSources.get(sourceName)
									currentMedia.push({
										name: sourceName,
										elapsed: mediaSource?.timeElapsed,
										remaining: mediaSource?.timeRemaining,
									})
								}
								this.self.setVariableValues({ [`media_status_${validName}`]: 'Paused' })
								break
							default:
								this.self.setVariableValues({ [`media_status_${validName}`]: 'Stopped' })
								break
						}
					}
					mediaSource = this.self.states.mediaSources.get(sourceName)
					this.self.setVariableValues({
						[`media_time_elapsed_${validName}`]: mediaSource?.timeElapsed,
						[`media_time_remaining_${validName}`]: remaining,
					})
					this.self.checkFeedbacks('media_playing', 'media_source_time_remaining')
				}
			}
			if (currentMedia) {
				const names = currentMedia.map((value) => value.name)
				const elapsed = currentMedia.map((value) => value.elapsed)
				const remaining = currentMedia.map((value) => value.remaining)

				this.self.setVariableValues({
					current_media_name: names.length > 0 ? names.join('\n') : 'None',
					current_media_time_elapsed: elapsed.length > 0 ? elapsed.join('\n') : '--:--:--',
					current_media_time_remaining: remaining.length > 0 ? remaining.join('\n') : '--:--:--',
				})
			}
		}
	}

	public buildInputSettings(sourceName: string, inputKind: string, inputSettings: unknown): void {
		const source = this.self.states.sources.get(sourceName)
		const name = source?.validName ?? sourceName

		const kindList = this.self.states.inputKindList.get(inputKind)
		if (kindList?.defaultInputSettings) {
			inputSettings = { ...kindList.defaultInputSettings, ...(inputSettings as any) }
			if (source) source.settings = inputSettings
		} else {
			if (source) source.settings = inputSettings
		}

		const settings = inputSettings as any
		switch (inputKind) {
			case 'text_ft2_source_v2':
			case 'text_gdiplus_v2':
			case 'text_gdiplus_v3':
				//Exclude text sources that read from file, as there is no way to edit or read the text value
				if (settings?.from_file || settings?.read_from_file) {
					this.self.setVariableValues({
						[`current_text_${name}`]: `Text from file: ${settings.text_file ?? settings.file}`,
					})
				} else {
					this.self.states.textSources.set(sourceName, {})
					this.self.setVariableValues({
						[`current_text_${name}`]: settings.text ?? '',
					})
				}
				break
			case 'ffmpeg_source':
			case 'vlc_source':
				this.self.states.mediaSources.set(sourceName, {})
				if (!this.self.mediaPoll) {
					void this.startMediaPoll()
				}
				break
			case 'image_source':
				this.self.states.imageSources.set(sourceName, {})
				break
			default:
				break
		}
	}

	public updateInputSettings(sourceName: string, inputSettings: unknown): void {
		const source = this.self.states.sources.get(sourceName)
		if (source) {
			source.settings = {
				...(source.settings || {}),
				...((inputSettings as any) || {}),
			}
			const name = source.validName ?? sourceName
			const inputKind = source.inputKind
			const settings = inputSettings as any

			switch (inputKind) {
				case 'text_ft2_source_v2':
				case 'text_gdiplus_v2':
				case 'text_gdiplus_v3':
					//Exclude text sources that read from file, as there is no way to edit or read the text value
					if (settings?.from_file || settings?.read_from_file) {
						this.self.setVariableValues({
							[`current_text_${name}`]: `Text from file: ${settings.text_file ?? settings.file}`,
						})
					} else if (settings?.text) {
						this.self.setVariableValues({
							[`current_text_${name}`]: settings.text ?? '',
						})
					}
					break
				case 'ffmpeg_source':
				case 'vlc_source': {
					let file = ''
					if (settings?.playlist) {
						file = settings?.playlist[0]?.value?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
						//Use first value in playlist until support for determining currently playing cue
					} else if (settings?.local_file) {
						file = settings?.local_file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
					}
					this.self.setVariableValues({ [`media_file_name_${name}`]: file })

					break
				}
				case 'image_source':
					this.self.setVariableValues({
						[`image_file_name_${name}`]: settings?.file ? settings?.file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/) : '',
					})
					break
				default:
					break
			}
		}
	}

	public async getSourceFilters(sourceName: string): Promise<void> {
		const data = await this.sendRequest('GetSourceFilterList', { sourceName: sourceName })

		if (data?.filters) {
			this.self.states.sourceFilters.set(sourceName, data.filters)
		}
	}

	// Audio Sources
	public async getAudioSources(sourceName: string): Promise<void> {
		try {
			await this.self.socket.call('GetInputAudioTracks', { inputName: sourceName })
			if (!this.self.obsState.audioSourceList.find((item) => item.id === sourceName)) {
				await this.getSourceAudio(sourceName)
			}
		} catch {
			//Ignore, this source is not an audio source
		}
	}

	public async getSourceAudio(sourceName: string): Promise<void> {
		const source = this.self.states.sources.get(sourceName)
		const validName = source?.validName ?? utils.validName(this.self, sourceName)

		const batch = [
			{
				requestId: sourceName,
				requestType: 'GetInputMute',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputVolume',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioBalance',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioSyncOffset',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioMonitorType',
				requestData: { inputName: sourceName },
			},
			{
				requestId: sourceName,
				requestType: 'GetInputAudioTracks',
				requestData: { inputName: sourceName },
			},
		] as any[]

		const data = await this.sendBatch(batch)

		if (data) {
			for (const response of data) {
				if (response.requestStatus.result && response.responseData) {
					const sourceName = response.requestId
					const type = response.requestType
					const responseData = response.responseData
					const source = this.self.states.sources.get(sourceName)

					if (source) {
						switch (type) {
							case 'GetInputMute':
								source.inputMuted = responseData.inputMuted
								this.self.setVariableValues({ [`mute_${validName}`]: responseData.inputMuted ? 'Muted' : 'Unmuted' })
								break
							case 'GetInputVolume':
								source.inputVolume = utils.roundNumber(this.self, responseData.inputVolumeDb, 1)
								this.self.setVariableValues({ [`volume_${validName}`]: source.inputVolume + ' dB' })
								break
							case 'GetInputAudioBalance':
								source.inputAudioBalance = utils.roundNumber(this.self, responseData.inputAudioBalance, 1)
								this.self.setVariableValues({ [`balance_${validName}`]: source.inputAudioBalance })
								break
							case 'GetInputAudioSyncOffset':
								source.inputAudioSyncOffset = responseData.inputAudioSyncOffset
								this.self.setVariableValues({ [`sync_offset_${validName}`]: responseData.inputAudioSyncOffset + 'ms' })
								break
							case 'GetInputAudioMonitorType': {
								source.monitorType = responseData.monitorType
								let monitorType
								if (responseData.monitorType === 'OBS_MONITORING_TYPE_MONITOR_AND_OUTPUT') {
									monitorType = 'Monitor / Output'
								} else if (responseData.monitorType === 'OBS_MONITORING_TYPE_MONITOR_ONLY') {
									monitorType = 'Monitor Only'
								} else {
									monitorType = 'Off'
								}
								this.self.setVariableValues({ [`monitor_${validName}`]: monitorType })
								break
							}
							case 'GetInputAudioTracks':
								source.inputAudioTracks = responseData.inputAudioTracks
								break
							default:
								break
						}
					}
				}
			}

			if (source) {
				this.self.setVariableValues({
					[`mute_${validName}`]: source.inputMuted ? 'Muted' : 'Unmuted',
					[`volume_${validName}`]: source.inputVolume + 'dB',
					[`balance_${validName}`]: source.inputAudioBalance,
					[`sync_offset_${validName}`]: source.inputAudioSyncOffset + 'ms',
				})
			}
			this.self.checkFeedbacks('audio_muted', 'volume', 'audio_monitor_type')
		}
	}

	public updateAudioPeak(data: unknown): void {
		this.self.states.audioPeak.clear()
		;(data as any).inputs.forEach((input: any) => {
			const channel = input.inputLevelsMul[0]
			if (channel) {
				const channelPeak = channel?.[1]
				const dbPeak = Math.round(20.0 * Math.log10(channelPeak))
				if (dbPeak) {
					this.self.states.audioPeak.set(input.inputName, dbPeak)
					this.self.checkFeedbacks('audioPeaking', 'audioMeter')
				}
			}
		})
	}
}
