import { InstanceStatus } from '@companion-module/base'
import OBSWebSocket, { EventSubscription, OBSRequestTypes, OBSResponseTypes } from 'obs-websocket-js'
import { initOBSListeners } from './listeners.js'
import type { OBSInstance } from './main.js'
import * as utils from './utils.js'
import {
	OBSMediaStatus,
	OBSRecordingState,
	OBSStreamingState,
	OBSSceneItem,
	ObsAudioMonitorType,
	OBSSource,
	OBSBatchRequest,
	OBSBatchResponse,
} from './types.js'

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
				this.self.secrets.pass,
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
	private async _call<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		try {
			return (await this.self.socket.call(requestType as any, requestData)) as OBSResponseTypes[T]
		} catch (error: any) {
			this.self.log('debug', `Request ${requestType} failed (${error?.message ?? error})`)
			return undefined
		}
	}

	public async sendRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		// Backward Compatibility: If sceneName or inputName is provided but we have a UUID, prioritize UUID
		if (requestData) {
			const data = requestData as any
			if (data.sceneName && !data.sceneUuid) {
				const scene = Array.from(this.self.states.scenes.values()).find((s) => s.sceneName === data.sceneName)
				if (scene) data.sceneUuid = scene.sceneUuid
			}
			if (data.inputName && !data.inputUuid) {
				const source = Array.from(this.self.states.sources.values()).find((s) => s.sourceName === data.inputName)
				if (source) data.inputUuid = source.sourceUuid
			}
			if (data.sourceName && !data.sourceUuid) {
				const source = Array.from(this.self.states.sources.values()).find((s) => s.sourceName === data.sourceName)
				if (source) data.sourceUuid = source.sourceUuid
			}
		}

		return this._call(requestType, requestData)
	}

	public async sendCustomRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		const data = await this._call(requestType, requestData)
		if (data) {
			this.self.log(
				'debug',
				`Custom Command Response: Request ${requestType} replied with ${requestData ? `data ${JSON.stringify(data)}` : 'no data'}`,
			)
			this.self.setVariableValues({
				custom_command_type: requestType,
				custom_command_request: requestData ? JSON.stringify(requestData) : '',
				custom_command_response: JSON.stringify(data),
			})
		} else {
			this.self.setVariableValues({
				custom_command_request: '',
				custom_command_response: '',
			})
		}
		return data
	}

	public async sendBatch(batch: OBSBatchRequest[]): Promise<OBSBatchResponse[] | undefined> {
		try {
			const data = (await this.self.socket.callBatch(batch as any)) as unknown as OBSBatchResponse[]
			const errors = data.filter(
				(request) =>
					request.requestStatus.result === false &&
					request.requestStatus.comment !== 'The specified source is not an input.' &&
					request.requestStatus.comment !== 'The specified input does not support audio.',
			)
			if (errors.length > 0) {
				const errorMessages = errors.map((error) => error.requestStatus.comment).join(' // ')
				this.self.log('debug', `Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error: any) {
			this.self.log('debug', `Batch request failed (${error?.message ?? error})`)
			return undefined
		}
	}

	public addSource(sourceUuid: string, sourceName: string, inputKind?: string | null, isGroup?: boolean): OBSSource {
		let source = this.self.states.sources.get(sourceUuid)
		if (!source) {
			source = {
				sourceName,
				sourceUuid,
				validName: utils.validName(this.self, sourceName),
				isGroup: !!isGroup,
				inputKind: inputKind ?? undefined,
			}
			this.self.states.sources.set(sourceUuid, source)
		}
		return source
	}

	private _addScene(sceneUuid: string, sceneName: string, sceneIndex?: number): void {
		this.self.states.scenes.set(sceneUuid, {
			sceneName: sceneName,
			sceneUuid: sceneUuid,
			sceneIndex: sceneIndex ?? Number(this.self.states.scenes.size),
		})
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
				if (this.self.states.recording === OBSRecordingState.Recording) {
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
			void this.getOBSMediaStatus()
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
			if (!version) return false

			this.self.states.version = version as any
			this.self.log(
				'debug',
				`OBS Version: ${version.obsVersion} // OBS Websocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			this.self.states.imageFormats = []
			version.supportedImageFormats.forEach((format: string) => {
				this.self.states.imageFormats.push({ id: format, label: format })
			})

			const studioMode = await this.sendRequest('GetStudioModeEnabled')
			if (studioMode) {
				this.self.states.studioMode = studioMode.studioModeEnabled ? true : false
			}

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
		if (inputKindList && inputKindList.inputKinds) {
			await Promise.all(
				inputKindList.inputKinds.map(async (inputKind: any) => {
					this.self.states.inputKindList.set(inputKind, {})
					const defaultSettings = await this.sendRequest('GetInputDefaultSettings', { inputKind: inputKind })
					if (defaultSettings) {
						this.self.states.inputKindList.set(
							inputKind,
							defaultSettings.defaultInputSettings as Record<string, unknown>,
						)
					}
				}),
			)
		}
	}

	public async buildProfileList(): Promise<void> {
		const profiles = await this.sendRequest('GetProfileList')
		this.self.states.profiles.clear()

		this.self.states.currentProfile = profiles?.currentProfileName ?? 'None'

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

		this.self.states.currentSceneCollection = collections?.currentSceneCollectionName ?? 'None'
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
			const inputs = await this.sendRequest('GetInputList')
			const inputMap = new Map<string, any>()
			inputs?.inputs?.forEach((input: any) => {
				inputMap.set(input.inputName, input)
			})

			const specialUuids = []
			for (const input of Object.values(specialInputs)) {
				if (input) {
					const inputName = input
					const inputInfo = inputMap.get(inputName)
					const inputUuid = inputInfo?.inputUuid ?? inputName
					this.addSource(inputUuid, inputName)
					specialUuids.push(inputUuid)
				}
			}
			await this.fetchSourcesData(specialUuids)
		}
	}

	public async buildOutputList(): Promise<void> {
		this.self.states.outputs.clear()

		const outputData = await this.sendRequest('GetOutputList')

		if (outputData) {
			outputData.outputs?.forEach((output: any) => {
				if (output) this.self.states.outputs.set(output.outputName, output)
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
		try {
			const data = await this.sendRequest('GetStats')
			if (data) {
				this.self.states.stats = data as any

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
			}
		} catch (error: any) {
			if (error?.message.match(/(Not connected)/i)) {
				void this.connectionLost()
			}
		}
	}

	public async getVideoSettings(): Promise<void> {
		const videoSettings = await this.sendRequest('GetVideoSettings')

		if (videoSettings) {
			this.self.states.resolution = `${videoSettings.baseWidth}x${videoSettings.baseHeight}`
			this.self.states.outputResolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`
			this.self.states.framerate = `${utils.roundNumber(
				this.self,
				videoSettings.fpsNumerator / videoSettings.fpsDenominator,
				2,
			)} fps`
			this.self.setVariableValues({
				base_resolution: this.self.states.resolution,
				output_resolution: this.self.states.outputResolution,
				target_framerate: this.self.states.framerate,
			})
		}
	}

	// Outputs, Streams, Recordings
	public async getStreamStatus(): Promise<void> {
		const batch = [
			{ requestType: 'GetStreamStatus', requestId: 'status' },
			{ requestType: 'GetStreamServiceSettings', requestId: 'settings' },
		]
		const data = await this.sendBatch(batch)

		if (data) {
			const streamStatus = data.find((res: any) => res.requestId === 'status')?.responseData
			const streamService = data.find((res: any) => res.requestId === 'settings')?.responseData

			if (streamStatus) {
				const timecode = streamStatus.outputTimecode.match(/\d\d:\d\d:\d\d/i)
				this.self.states.streaming = streamStatus.outputActive
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
					streaming: utils.getOBSStreamingStateLabel(
						this.self.states.streaming ? OBSStreamingState.Streaming : OBSStreamingState.OffAir,
					),
					stream_timecode: String(this.self.states.streamingTimecode),
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
	}

	public async getRecordStatus(): Promise<void> {
		const batch = [
			{ requestType: 'GetRecordStatus', requestId: 'status' },
			{ requestType: 'GetRecordDirectory', requestId: 'directory' },
		]
		const data = await this.sendBatch(batch)

		if (data) {
			const recordStatus = data.find((res: any) => res.requestId === 'status')?.responseData
			const recordDirectory = data.find((res: any) => res.requestId === 'directory')?.responseData

			if (recordStatus) {
				if (recordStatus.outputActive === true) {
					this.self.states.recording = OBSRecordingState.Recording
				} else {
					this.self.states.recording = recordStatus.outputPaused ? OBSRecordingState.Paused : OBSRecordingState.Stopped
				}

				this.self.states.recordDirectory = recordDirectory?.recordDirectory

				this.self.checkFeedbacks('recording')
				this.self.setVariableValues({ recording: utils.getOBSRecordingStateLabel(this.self.states.recording) })
			}
		}
	}

	public updateRecordingTimecode(data: unknown): void {
		if (this.self.states.recording === OBSRecordingState.Recording) {
			const timecode = (data as any).recordingTimecode
			this.self.states.recordingTimecode = timecode
			const recordingTimecodeSplit = timecode.split(':')
			this.self.setVariableValues({
				recording: utils.getOBSRecordingStateLabel(this.self.states.recording),
				recording_timecode: String(this.self.states.recordingTimecode),
				recording_timecode_hh: recordingTimecodeSplit[0],
				recording_timecode_mm: recordingTimecodeSplit[1],
				recording_timecode_ss: recordingTimecodeSplit[2],
			})
		}
	}

	public async getOutputStatus(outputName: string): Promise<void> {
		if (!this.self.states.sceneCollectionChanging) {
			const outputStatus = await this.sendRequest('GetOutputStatus', { outputName: outputName })
			if (outputStatus) {
				this.self.states.outputs.set(outputName, outputStatus as any)
				this.self.checkFeedbacks('output_active')
			}
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
		this.self.states.sources.clear()
		this.self.states.sceneItems.clear()
		this.self.states.groups.clear()

		const sceneList = await this.sendRequest('GetSceneList')
		if (!sceneList) return

		if (Array.isArray(sceneList.scenes)) {
			for (const scene of sceneList.scenes) {
				this._addScene(scene.sceneUuid as string, scene.sceneName as string, scene.sceneIndex as number)
			}
		}

		this.self.states.previewScene = sceneList.currentPreviewSceneName ?? 'None'
		this.self.states.previewSceneUuid = sceneList.currentPreviewSceneUuid ?? ''
		if (sceneList.currentProgramSceneName) {
			this.self.states.programScene = sceneList.currentProgramSceneName ?? 'None'
		}
		if (sceneList.currentPreviewSceneName) {
			this.self.states.previewScene = sceneList.currentPreviewSceneName
		}
		this.self.states.programSceneUuid = sceneList.currentProgramSceneUuid ?? ''

		this.self.setVariableValues({
			scene_preview: this.self.states.previewScene,
			scene_active: this.self.states.programScene,
		})

		// Fetch all scene items for all scenes
		const sceneUuids = Array.from(this.self.states.scenes.keys())
		const batch = sceneUuids.map((uuid) => ({
			requestType: 'GetSceneItemList',
			requestData: { sceneUuid: uuid },
			requestId: uuid,
		}))

		const response = await this.sendBatch(batch)
		const allSourceUuids = new Set<string>()

		if (response) {
			for (const res of response) {
				if (res.requestStatus.result) {
					const sceneUuid = res.requestId
					const items = res.responseData.sceneItems as OBSSceneItem[]
					this.self.states.sceneItems.set(sceneUuid, items)

					for (const item of items) {
						allSourceUuids.add(item.sourceUuid)
						this.addSource(item.sourceUuid, item.sourceName, item.inputKind, item.isGroup)
					}
				}
			}
		}

		// Handle Groups separately as they contain sources not directly in scenes
		const groupUuids = Array.from(this.self.states.sources.values())
			.filter((s) => s.isGroup)
			.map((s) => s.sourceUuid)

		if (groupUuids.length > 0) {
			const groupBatch = groupUuids.map((uuid) => ({
				requestType: 'GetGroupSceneItemList',
				requestData: { sceneUuid: uuid },
				requestId: uuid,
			}))
			const groupResponse = await this.sendBatch(groupBatch)
			if (groupResponse) {
				for (const res of groupResponse) {
					if (res.requestStatus.result) {
						const groupUuid = res.requestId
						const items = res.responseData.sceneItems as any[]
						this.self.states.groups.set(groupUuid, items)
						for (const item of items) {
							allSourceUuids.add(item.sourceUuid)
							const source = this.addSource(item.sourceUuid, item.sourceName, item.inputKind)
							source.groupedSource = true
							source.groupName = groupUuid
						}
					}
				}
			}
		}

		await this.fetchSourcesData(Array.from(allSourceUuids))

		void this.self.updateActionsFeedbacksVariables()
	}

	public async fetchSourcesData(sourceUuids: string[]): Promise<void> {
		if (sourceUuids.length === 0) return

		const batch: any[] = []
		for (const uuid of sourceUuids) {
			batch.push(
				{
					requestType: 'GetSourceActive',
					requestData: { sourceUuid: uuid },
					requestId: `${uuid}:active`,
				},
				{
					requestType: 'GetSourceFilterList',
					requestData: { sourceUuid: uuid },
					requestId: `${uuid}:filters`,
				},
			)

			const source = this.self.states.sources.get(uuid)
			if (source?.inputKind) {
				batch.push({
					requestType: 'GetInputSettings',
					requestData: { inputUuid: uuid },
					requestId: `${uuid}:settings`,
				})

				// Optimistically try to get audio info for all inputs
				batch.push(
					{
						requestType: 'GetInputMute',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:mute`,
					},
					{
						requestType: 'GetInputVolume',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:volume`,
					},
					{
						requestType: 'GetInputAudioBalance',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:balance`,
					},
					{
						requestType: 'GetInputAudioSyncOffset',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:sync_offset`,
					},
					{
						requestType: 'GetInputAudioMonitorType',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:monitor`,
					},
					{
						requestType: 'GetInputAudioTracks',
						requestData: { inputUuid: uuid },
						requestId: `${uuid}:tracks`,
					},
				)
			}
		}

		const responses = await this.sendBatch(batch)
		if (responses) {
			for (const res of responses) {
				if (!res.requestStatus.result) continue

				const [uuid, type] = res.requestId.split(':')
				const source = this.self.states.sources.get(uuid)
				if (!source) continue

				const data = res.responseData
				const validName = source.validName ?? utils.validName(this.self, source.sourceName)
				if (!source.validName) source.validName = validName

				switch (type) {
					case 'active':
						source.active = data.videoActive
						source.videoShowing = data.videoShowing
						break
					case 'filters':
						this.self.states.sourceFilters.set(uuid, data.filters)
						break
					case 'settings':
						this.buildInputSettings(uuid, data.inputKind ?? '', data.inputSettings)
						if (source.inputKind && this.self.states.inputKindList.has(source.inputKind)) {
							const kindList = this.self.states.inputKindList.get(source.inputKind)
							if (kindList?.defaultInputSettings) {
								this.buildInputSettings(
									source.sourceUuid,
									source.inputKind,
									kindList.defaultInputSettings as Record<string, unknown>,
								)
							}
						}
						break
					case 'mute':
						this._updateSourceMute(source, data.inputMuted)
						break
					case 'volume':
						this._updateSourceVolume(source, data.inputVolumeDb)
						break
					case 'balance':
						this._updateSourceBalance(source, data.inputAudioBalance)
						break
					case 'sync_offset':
						this._updateSourceSyncOffset(source, data.inputAudioSyncOffset)
						break
					case 'monitor':
						this._updateSourceMonitorType(source, data.monitorType)
						break
					case 'tracks':
						source.inputAudioTracks = data.inputAudioTracks
						break
				}
			}
		}

		this.self.checkFeedbacks('scene_item_active', 'audio_muted', 'volume', 'audio_monitor_type')
	}

	private _updateSourceMute(source: OBSSource, muted: boolean): void {
		source.inputMuted = muted
		this.self.setVariableValues({ [`mute_${source.validName}`]: muted ? 'Muted' : 'Unmuted' })
	}

	private _updateSourceVolume(source: OBSSource, volumeDb: number): void {
		source.inputVolume = utils.roundNumber(this.self, volumeDb, 1)
		this.self.setVariableValues({ [`volume_${source.validName}`]: source.inputVolume + ' dB' })
	}

	private _updateSourceBalance(source: OBSSource, balance: number): void {
		source.inputAudioBalance = utils.roundNumber(this.self, balance, 1)
		this.self.setVariableValues({ [`balance_${source.validName}`]: source.inputAudioBalance })
	}

	private _updateSourceSyncOffset(source: OBSSource, offset: number): void {
		source.inputAudioSyncOffset = offset
		this.self.setVariableValues({ [`sync_offset_${source.validName}`]: offset + 'ms' })
	}

	private _updateSourceMonitorType(source: OBSSource, monitorType: ObsAudioMonitorType): void {
		source.monitorType = monitorType
		let label = 'Off'
		if (monitorType === ObsAudioMonitorType.MonitorAndOutput) {
			label = 'Monitor / Output'
		} else if (monitorType === ObsAudioMonitorType.MonitorOnly) {
			label = 'Monitor Only'
		}
		this.self.setVariableValues({ [`monitor_${source.validName}`]: label })
	}

	public async buildSourceList(sceneUuid: string): Promise<void> {
		const data = await this.sendRequest('GetSceneItemList', { sceneUuid: sceneUuid })
		if (data) {
			this.self.states.sceneItems.set(sceneUuid, data.sceneItems as any)
			const sceneItems = data.sceneItems as any[]
			const sourceUuids = sceneItems.map((item) => item.sourceUuid)
			for (const item of sceneItems) {
				this.addSource(item.sourceUuid, item.sourceName, item.inputKind, item.isGroup)
			}
			await this.fetchSourcesData(sourceUuids)
		}
	}

	public async getGroupInfo(groupUuid: string): Promise<void> {
		const data = await this.sendRequest('GetGroupSceneItemList', { sceneUuid: groupUuid })
		if (data) {
			this.self.states.sceneItems.set(groupUuid, data.sceneItems as any)
			const sceneItems = data.sceneItems as any[]
			const sourceUuids = sceneItems.map((item) => item.sourceUuid)
			for (const item of sceneItems) {
				const source = this.addSource(item.sourceUuid, item.sourceName, item.inputKind)
				source.groupedSource = true
				source.groupName = groupUuid
			}
			await this.fetchSourcesData(sourceUuids)
		}
	}

	public async buildSceneTransitionList(): Promise<void> {
		this.self.states.transitions.clear()

		const sceneTransitionList = await this.sendRequest('GetSceneTransitionList')
		const currentTransition = await this.sendRequest('GetCurrentSceneTransition')

		if (sceneTransitionList) {
			if (Array.isArray(sceneTransitionList.transitions)) {
				for (const item of sceneTransitionList.transitions) {
					if (item.transitionName) {
						this.self.states.transitions.set(item.transitionName as string, item as any)
					}
				}
			}

			const transitionListVariable = this.self.obsState.transitionList?.map((item) => item.id) ?? []

			if (currentTransition) {
				const currentTransitionName = currentTransition.transitionName
				if (currentTransitionName) this.self.states.currentTransition = currentTransitionName
			}
			this.self.states.currentTransition = currentTransition?.transitionName ?? 'None'
			this.self.states.transitionDuration = currentTransition?.transitionDuration ?? 0

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
		const scene = await this.sendRequest('CreateScene', { sceneName: sceneName })
		if (scene) {
			this._addScene(scene.sceneUuid, sceneName)
			await this.buildSourceList(scene.sceneUuid)
			void this.self.updateActionsFeedbacksVariables()
		}
	}

	public async removeScene(sceneUuid: string): Promise<void> {
		this.self.states.scenes.delete(sceneUuid)
		this.self.states.sceneItems.delete(sceneUuid)
		void this.self.updateActionsFeedbacksVariables()
	}

	// Source Info
	public async getOBSMediaStatus(): Promise<void> {
		const mediaSourceList = this.self.obsState.mediaSourceList
		if (mediaSourceList.length === 0) return

		const batch = mediaSourceList.map((source) => ({
			requestId: source.id as string,
			requestType: 'GetMediaInputStatus',
			requestData: { inputUuid: source.id },
		}))

		const data = await this.sendBatch(batch)
		if (data) {
			const allValues: Record<string, string | number | boolean | undefined> = {}
			const currentMedia: Array<{ name: string; elapsed: string; remaining: string }> = []
			for (const response of data) {
				if (response.requestStatus.result) {
					const sourceUuid = response.requestId
					const source = this.self.states.sources.get(sourceUuid)
					if (!source) continue

					const sourceName = source.sourceName
					const validName = source.validName ?? sourceName
					const responseData = response.responseData

					source.OBSMediaStatus = responseData.mediaState
					source.mediaCursor = responseData.mediaCursor
					source.mediaDuration = responseData.mediaDuration

					const remainingValue = (responseData.mediaDuration ?? 0) - (responseData.mediaCursor ?? 0)
					source.timeElapsed = utils.formatTimecode(this.self, responseData.mediaCursor)
					source.timeRemaining = remainingValue > 0 ? utils.formatTimecode(this.self, remainingValue) : '--:--:--'

					if (responseData.mediaState === OBSMediaStatus.Playing || responseData.mediaState === OBSMediaStatus.Paused) {
						if (source.active) {
							currentMedia.push({
								name: sourceName,
								elapsed: source.timeElapsed,
								remaining: source.timeRemaining,
							})
						}
					}

					let status = OBSMediaStatus.Stopped
					if (responseData.mediaState === OBSMediaStatus.Playing) status = OBSMediaStatus.Playing
					else if (responseData.mediaState === OBSMediaStatus.Paused) status = OBSMediaStatus.Paused

					allValues[`media_status_${validName}`] = utils.getOBSMediaStatusLabel(status)
					allValues[`media_time_elapsed_${validName}`] = source.timeElapsed
					allValues[`media_time_remaining_${validName}`] = source.timeRemaining
				}
			}

			if (currentMedia.length > 0) {
				allValues.current_media_name = currentMedia.map((v) => v.name).join('\n')
				allValues.current_media_time_elapsed = currentMedia.map((v) => v.elapsed).join('\n')
				allValues.current_media_time_remaining = currentMedia.map((v) => v.remaining).join('\n')
			} else {
				allValues.current_media_name = 'None'
				allValues.current_media_time_elapsed = '--:--:--'
				allValues.current_media_time_remaining = '--:--:--'
			}

			this.self.setVariableValues(allValues)
			this.self.checkFeedbacks('media_playing', 'media_source_time_remaining')
		}
	}

	public buildInputSettings(sourceUuid: string, inputKind: string, inputSettings: Record<string, any>): void {
		const source = this.self.states.sources.get(sourceUuid)
		if (!source) return

		const kindList = this.self.states.inputKindList.get(inputKind)
		source.settings = kindList?.defaultInputSettings
			? { ...(kindList.defaultInputSettings as Record<string, any>), ...inputSettings }
			: inputSettings

		const name = source.validName ?? source.sourceName
		if (!source.settings) source.settings = {}
		const settings = source.settings

		if (inputKind.startsWith('text_')) {
			if (settings?.from_file || settings?.read_from_file) {
				source.text = `Text from file: ${settings.text_file ?? settings.file}`
			} else {
				source.text = settings.text ?? ''
			}
			this.self.setVariableValues({ [`current_text_${name}`]: source.text })
		} else if (inputKind === 'ffmpeg_source' || inputKind === 'vlc_source') {
			if (!this.self.mediaPoll) void this.startMediaPoll()
		} else if (inputKind === 'image_source') {
			source.imageFile = settings?.file ? (settings.file.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? '') : ''
			this.self.setVariableValues({ [`image_file_name_${name}`]: source.imageFile })
		}
	}

	public updateInputSettings(sourceUuid: string, inputSettings: unknown): void {
		const source = this.self.states.sources.get(sourceUuid)
		if (source) {
			if (!source.settings) source.settings = {}
			source.settings = { ...source.settings, ...(inputSettings as Record<string, unknown>) }
			this.buildInputSettings(sourceUuid, source.inputKind ?? '', source.settings)
		}
	}

	public async getSourceFilters(sourceUuid: string): Promise<void> {
		const data = await this.sendRequest('GetSourceFilterList', { sourceUuid: sourceUuid })
		if (data) {
			this.self.states.sourceFilters.set(sourceUuid, data.filters as any)
		}
	}

	public updateAudioPeak(data: {
		inputs: Array<{ inputUuid: string; inputLevelsMul: Array<[number, number, number]> }>
	}): void {
		this.self.states.audioPeak.clear()
		data.inputs.forEach((input) => {
			const channel = input.inputLevelsMul[0]
			if (channel) {
				const channelPeak = channel?.[1]
				const dbPeak = Math.round(20.0 * Math.log10(channelPeak))
				if (dbPeak) {
					this.self.states.audioPeak.set(input.inputUuid, dbPeak)
					this.self.checkFeedbacks('audioPeaking', 'audioMeter')
				}
			}
		})
	}
}
