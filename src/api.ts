import { InstanceStatus, createModuleLogger } from '@companion-module/base'
import OBSWebSocket, { EventSubscription, OBSRequestTypes, OBSResponseTypes } from 'obs-websocket-js'
import { initOBSListeners } from './listeners.js'
import type OBSInstance from './main.js'
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

import { POLL_INTERVALS } from './constants.js'

const logger = createModuleLogger('OBSApi')

// ══════════════════════════════════════════════════════════════════════════
// ═══ OBS Api Class ════════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════════════════════════
export class OBSApi {
	private self: OBSInstance

	// Poll intervals (in milliseconds)
	private static readonly RECONNECTION_POLL_INTERVAL = POLL_INTERVALS.RECONNECTION
	private static readonly STATS_POLL_INTERVAL = POLL_INTERVALS.STATS
	private static readonly MEDIA_POLL_INTERVAL = POLL_INTERVALS.MEDIA

	// Guards against overlapping connection attempts
	private connecting = false

	// Volume meters are only subscribed while at least one audioPeaking/audioMeter
	// feedback exists. Keyed by feedback instance id so repeated subscribes (e.g. on a
	// definitions rebuild) are idempotent.
	private meterSubscribers = new Set<string>()
	private metersActive = false
	private lastMeterFeedbackCheck = 0
	private meterFeedbackPending = false
	private static readonly METER_FEEDBACK_THROTTLE_MS = 100

	// Everything except the high-frequency volume meters, which are toggled on demand.
	private get baseEventSubscriptions(): number {
		return EventSubscription.All | EventSubscription.InputActiveStateChanged | EventSubscription.InputShowStateChanged
	}

	constructor(self: OBSInstance) {
		this.self = self
	}

	// ═══ Initialization & Connection ═══
	public initializeStates(): void {
		this.self.obsState.resetSceneSourceStates()
		// Basic Info
		this.self.states.sceneCollectionChanging = false
	}

	public async connectOBS(): Promise<void> {
		// Skip if a previous attempt is still in flight
		if (this.connecting) {
			logger.debug('Connection attempt already in progress, skipping')
			return
		}
		this.connecting = true
		try {
			// Disconnecting is inside the try so a rejected disconnect can't leave
			// `connecting` stuck true (which would wedge every future reconnect attempt).
			if (this.self.socket) {
				this.self.socket.removeAllListeners()
				await this.self.socket.disconnect()
			} else {
				this.self.socket = new OBSWebSocket()
			}
			const metersNeeded = this.meterSubscribers.size > 0
			const { obsWebSocketVersion } = await this.self.socket.connect(
				`${this.self.config.scheme ?? 'ws'}://${this.self.config.host}:${this.self.config.port}`,
				this.self.secrets.pass,
				{
					// SceneItemTransformChanged is intentionally skipped
					eventSubscriptions: metersNeeded
						? this.baseEventSubscriptions | EventSubscription.InputVolumeMeters
						: this.baseEventSubscriptions,
					rpcVersion: 1,
				},
			)
			this.metersActive = metersNeeded
			if (obsWebSocketVersion) {
				this.self.updateStatus(InstanceStatus.Ok)
				this.stopReconnectionPoll()
				logger.info('Connected to OBS')

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
					this.startStatsPoll()

					//Build General Parameters
					await this.buildProfileList()
					await this.buildSceneCollectionList()

					//Build Scene Collection Parameters
					await this.buildSceneTransitionList()
					// Registers all inputs (via GetInputList) and all scene containment
					await this.buildSceneList()
				} else {
					//throw an error if initial info returns false.
					throw new Error('could not get OBS info')
				}
			}
		} catch (error) {
			this.processWebSocketError(error)
		} finally {
			this.connecting = false
		}
	}

	public processWebSocketError(error: unknown): void {
		if (!this.self.reconnectionPoll) {
			let tryReconnect: boolean
			const errorMessage = error instanceof Error ? error.message : String(error)
			if (errorMessage.match(/(Server sent no subprotocol)/i)) {
				tryReconnect = false
				logger.error('Failed to connect to OBS. Please upgrade OBS to version 28 or above')
				this.self.updateStatus(InstanceStatus.ConnectionFailure, 'Outdated OBS version')
			} else if (errorMessage.match(/(missing an `authentication` string)/i)) {
				tryReconnect = false
				logger.error(`Failed to connect to OBS. Please enter your WebSocket Server password in the module settings`)
				this.self.updateStatus(InstanceStatus.BadConfig, 'Missing password')
			} else if (errorMessage.match(/(Authentication failed)/i)) {
				tryReconnect = false
				logger.error(
					`Failed to connect to OBS. Please ensure your WebSocket Server password is correct in the module settings`,
				)
				this.self.updateStatus(InstanceStatus.AuthenticationFailure)
			} else if (errorMessage.match(/(ECONNREFUSED)/i)) {
				tryReconnect = true
				logger.error(`Failed to connect to OBS. Please ensure OBS is open and reachable via your network`)
				this.self.updateStatus(InstanceStatus.ConnectionFailure)
			} else {
				tryReconnect = true
				logger.error(`Failed to connect to OBS (${errorMessage})`)
				this.self.updateStatus(InstanceStatus.UnknownError)
			}
			if (tryReconnect) {
				this.startReconnectionPoll()
			}
		}
	}

	public async disconnectOBS(): Promise<void> {
		// Always stop the reconnection poll, even without a socket — otherwise a config
		// change made while reconnecting leaves the old poll hammering a stale address.
		this.stopReconnectionPoll()
		this.metersActive = false
		if (this.self.socket) {
			//Clear all active polls
			this.stopStatsPoll()
			this.stopMediaPoll()
			//Remove listeners, will recreate on connection
			this.self.socket.removeAllListeners()
			//Disconnect from OBS
			await this.self.socket.disconnect()
		}
	}

	// ═══ Volume Meter Subscription (audioPeaking / audioMeter feedbacks) ═══
	public addMeterSubscriber(feedbackId: string): void {
		const wasEmpty = this.meterSubscribers.size === 0
		this.meterSubscribers.add(feedbackId)
		if (wasEmpty) this.applyMeterSubscription(true)
	}

	public removeMeterSubscriber(feedbackId: string): void {
		this.meterSubscribers.delete(feedbackId)
		if (this.meterSubscribers.size === 0) this.applyMeterSubscription(false)
	}

	private applyMeterSubscription(enable: boolean): void {
		if (!this.self.socket || this.metersActive === enable) return
		this.metersActive = enable
		const subscriptions = enable
			? this.baseEventSubscriptions | EventSubscription.InputVolumeMeters
			: this.baseEventSubscriptions
		void this.self.socket.reidentify({ eventSubscriptions: subscriptions }).catch((error: any) => {
			logger.debug(`Failed to update meter subscription (${error?.message ?? error})`)
		})
	}

	public async connectionLost(): Promise<void> {
		if (!this.self.reconnectionPoll) {
			logger.error('Connection lost to OBS')
			this.self.updateStatus(InstanceStatus.Disconnected)
			await this.disconnectOBS()

			this.startReconnectionPoll()
		}
	}

	// ═══ OBS WebSocket Commands ═══
	private async _call<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		try {
			return (await this.self.socket.call(requestType as any, requestData)) as OBSResponseTypes[T]
		} catch (error: any) {
			logger.debug(`Request ${requestType} failed (${error?.message ?? error})`)
			return undefined
		}
	}

	public async sendRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		return this._call(requestType, requestData)
	}

	public async sendCustomRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		const data = await this._call(requestType, requestData)
		if (data) {
			logger.debug(
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
				logger.debug(`Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error: any) {
			logger.debug(`Batch request failed (${error?.message ?? error})`)
			return undefined
		}
	}

	// Upserts a source: creates it if unknown, otherwise backfills identity fields the
	// caller has fresher knowledge of (a source first seen via a scene item may lack its
	// kind; a group flag may arrive later). Never downgrades existing information.
	public addSource(sourceUuid: string, sourceName: string, inputKind?: string | null, isGroup?: boolean): OBSSource {
		let source = this.self.states.sources.get(sourceUuid)
		if (!source) {
			source = {
				sourceName,
				sourceUuid,
				validName: utils.validName(sourceName),
				isGroup: !!isGroup,
				inputKind: inputKind ?? undefined,
			}
			this.self.states.sources.set(sourceUuid, source)
			this.self.obsState.invalidateSourceNameIndex()
		} else {
			if (sourceName && source.sourceName !== sourceName) {
				source.sourceName = sourceName
				source.validName = utils.validName(sourceName)
				this.self.obsState.invalidateSourceNameIndex()
			}
			if (inputKind && !source.inputKind) source.inputKind = inputKind
			if (isGroup) source.isGroup = true
		}
		return source
	}

	public registerScene(sceneUuid: string, sceneName: string, sceneIndex?: number): void {
		this.self.states.scenes.set(sceneUuid, {
			sceneName: sceneName,
			sceneUuid: sceneUuid,
			sceneIndex: sceneIndex ?? Number(this.self.states.scenes.size),
		})
		this.self.obsState.invalidateSceneNameIndex()
	}

	// ═══ Polls ═══
	public startReconnectionPoll(): void {
		this.stopReconnectionPoll()
		this.self.reconnectionPoll = setInterval(() => {
			void this.connectOBS()
		}, OBSApi.RECONNECTION_POLL_INTERVAL)
	}

	public stopReconnectionPoll(): void {
		if (this.self.reconnectionPoll) {
			clearInterval(this.self.reconnectionPoll)
			delete this.self.reconnectionPoll
		}
	}

	public startStatsPoll(): void {
		this.stopStatsPoll()
		if (this.self.socket) {
			this.self.statsPoll = setInterval(() => {
				// Build array of promises for parallel execution
				const promises: Promise<void>[] = [this.getStats()]

				// Conditionally add streaming and recording status
				if (this.self.states.streaming) {
					promises.push(this.getStreamStatus())
				}
				if (this.self.states.recording === OBSRecordingState.Recording) {
					promises.push(this.getRecordStatus())
				}

				// Batch all output status requests
				if (this.self.states.outputs.size > 0 && !this.self.states.sceneCollectionChanging) {
					promises.push(this.getAllOutputStatuses())
				}

				// Execute all requests in parallel
				void Promise.all(promises)
			}, OBSApi.STATS_POLL_INTERVAL)
		}
	}

	public stopStatsPoll(): void {
		if (this.self.statsPoll) {
			clearInterval(this.self.statsPoll)
			delete this.self.statsPoll
		}
	}

	public startMediaPoll(): void {
		this.stopMediaPoll()
		this.self.mediaPoll = setInterval(() => {
			void this.getOBSMediaStatus()
		}, OBSApi.MEDIA_POLL_INTERVAL)
	}

	public stopMediaPoll(): void {
		if (this.self.mediaPoll) {
			clearInterval(this.self.mediaPoll)
			this.self.mediaPoll = null
		}
	}

	// ═══ General OBS Project Info ═══
	public async obsInfo(): Promise<boolean> {
		try {
			const version = await this.sendRequest('GetVersion')
			if (!version) return false

			this.self.states.version = version
			logger.debug(
				`OBS Version: ${version.obsVersion} // OBS WebSocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			this.self.states.imageFormats = []
			version.supportedImageFormats.forEach((format: string) => {
				this.self.states.imageFormats.push({ id: format, label: format })
			})

			const studioMode = await this.sendRequest('GetStudioModeEnabled')
			if (studioMode) {
				this.self.states.studioMode = studioMode.studioModeEnabled ?? false
			}

			// Parallelize independent operations for better performance
			await Promise.all([
				this.buildHotkeyList(),
				this.buildOutputList(),
				this.buildMonitorList(),
				this.getVideoSettings(),
				this.getReplayBufferStatus(),
				this.getInputKindList(),
			])

			return true
		} catch (error) {
			logger.debug(error as any)
			return false
		}
	}

	public async buildHotkeyList(): Promise<void> {
		const hotkeyList = await this.sendRequest('GetHotkeyList')
		this.self.states.hotkeyNames = []
		hotkeyList?.hotkeys?.forEach((hotkey: string) => {
			this.self.states.hotkeyNames.push({ id: hotkey, label: hotkey })
		})
		void this.self.updateActionsFeedbacksVariables()
	}

	public async getInputKindList(): Promise<void> {
		const inputKindList = await this.sendRequest('GetInputKindList')
		if (inputKindList && inputKindList.inputKinds) {
			await Promise.all(
				inputKindList.inputKinds.map(async (inputKind: string) => {
					this.self.states.inputKindList.set(inputKind, {})
					const defaultSettings = await this.sendRequest('GetInputDefaultSettings', { inputKind: inputKind })
					if (defaultSettings) {
						this.self.states.inputKindList.set(inputKind, defaultSettings.defaultInputSettings)
					}
				}),
			)
		}
	}

	public async buildProfileList(): Promise<void> {
		const profiles = await this.sendRequest('GetProfileList')
		this.self.states.profiles.clear()

		this.self.states.currentProfile = profiles?.currentProfileName ?? 'None'

		profiles?.profiles.forEach((profile: string) => {
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
		collections?.sceneCollections.forEach((sceneCollection: string) => {
			this.self.states.sceneCollections.set(sceneCollection, {})
		})

		this.self.checkFeedbacks('scene_collection_active')
		this.self.setVariableValues({ scene_collection: this.self.states.currentSceneCollection })

		void this.self.updateActionsFeedbacksVariables()
	}

	// Registers every input from the authoritative GetInputList (name, uuid, and kind in
	// one request). This covers global audio devices and inputs not placed in any scene,
	// which never appear in scene item walks. Returns the registered input UUIDs, or an
	// empty list if the state was reset while the request was in flight.
	private async buildInputList(): Promise<string[]> {
		const epoch = this.self.obsState.epoch
		const data = await this.sendRequest('GetInputList')
		if (!data || this.self.obsState.epoch !== epoch) return []

		const uuids: string[] = []
		for (const input of (data.inputs ?? []) as any[]) {
			if (input?.inputUuid && input?.inputName) {
				this.addSource(input.inputUuid, input.inputName, input.inputKind)
				uuids.push(input.inputUuid)
			}
		}
		return uuids
	}

	public async buildOutputList(): Promise<void> {
		this.self.states.outputs.clear()

		const outputData = await this.sendRequest('GetOutputList')

		if (outputData) {
			outputData.outputs?.forEach((output: any) => {
				if (output) this.self.states.outputs.set(output.outputName, output)
			})
			// One batched status request instead of N individual GetOutputStatus calls.
			void this.getAllOutputStatuses()
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
		// Note: sendRequest swallows errors and returns undefined, so connection loss is
		// handled via the ConnectionClosed listener, not a catch here.
		const data = await this.sendRequest('GetStats')
		if (data) {
			this.self.states.stats = data as any

			const freeSpaceMB = utils.roundNumber(data.availableDiskSpace, 0)
			let freeSpace: number | string = freeSpaceMB
			if (freeSpace > 1000) {
				freeSpace = `${utils.roundNumber(freeSpace / 1000, 0)} GB`
			} else {
				freeSpace = `${utils.roundNumber(freeSpace, 0)} MB`
			}

			this.self.setVariableValues({
				fps: utils.roundNumber(data.activeFps, 2),
				render_total_frames: data.renderTotalFrames,
				render_missed_frames: data.renderSkippedFrames,
				output_total_frames: data.outputTotalFrames,
				output_skipped_frames: data.outputSkippedFrames,
				average_frame_time: utils.roundNumber(data.averageFrameRenderTime, 2),
				cpu_usage: `${utils.roundNumber(data.cpuUsage, 2)}%`,
				memory_usage: `${utils.roundNumber(data.memoryUsage, 0)} MB`,
				free_disk_space: freeSpace,
				free_disk_space_mb: freeSpaceMB,
			})
			this.self.checkFeedbacks('freeDiskSpaceRemaining')
		}
	}

	public async getVideoSettings(): Promise<void> {
		const videoSettings = await this.sendRequest('GetVideoSettings')

		if (videoSettings) {
			this.self.states.resolution = `${videoSettings.baseWidth}x${videoSettings.baseHeight}`
			this.self.states.outputResolution = `${videoSettings.outputWidth}x${videoSettings.outputHeight}`
			this.self.states.framerate = `${utils.roundNumber(
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

	// ═══ Outputs, Streams, Recordings ═══
	public async getStreamStatus(): Promise<void> {
		const batch = [
			{ requestType: 'GetStreamStatus', requestId: 'status' },
			{ requestType: 'GetStreamServiceSettings', requestId: 'settings' },
		]
		const data = await this.sendBatch(batch)

		if (data) {
			const streamStatus = data.find((res) => res.requestId === 'status')?.responseData
			const streamService = data.find((res) => res.requestId === 'settings')?.responseData

			if (streamStatus) {
				const timecodeMatch = streamStatus.outputTimecode?.match(/\d\d:\d\d:\d\d/i)
				const timecode = timecodeMatch?.[0] ?? '00:00:00'
				this.self.states.streaming = streamStatus.outputActive
				this.self.states.streamingTimecode = timecode
				const streamingTimecodeSplit = utils.splitTimecode(timecode)

				this.self.states.streamCongestion = streamStatus.outputCongestion

				let kbits = 0
				if (streamStatus.outputBytes > this.self.states.outputBytes) {
					kbits = Math.round(((streamStatus.outputBytes - this.self.states.outputBytes) * 8) / 1000)
					this.self.states.outputBytes = streamStatus.outputBytes
				} else {
					this.self.states.outputBytes = streamStatus.outputBytes
				}

				// Preserve the reconnecting label set by StreamStateChanged
				const streamingState = this.self.states.streamReconnecting
					? OBSStreamingState.Reconnecting
					: this.self.states.streaming
						? OBSStreamingState.Streaming
						: OBSStreamingState.OffAir

				this.self.checkFeedbacks('streaming', 'streamCongestion')
				this.self.setVariableValues({
					streaming: utils.getOBSStreamingStateLabel(streamingState),
					stream_timecode: timecode,
					stream_timecode_hh: streamingTimecodeSplit.hh,
					stream_timecode_mm: streamingTimecodeSplit.mm,
					stream_timecode_ss: streamingTimecodeSplit.ss,
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
			const recordStatus = data.find((res) => res.requestId === 'status')?.responseData
			const recordDirectory = data.find((res) => res.requestId === 'directory')?.responseData

			if (recordStatus) {
				if (recordStatus.outputActive === true && recordStatus.outputPaused === false) {
					this.self.states.recording = OBSRecordingState.Recording
				} else {
					this.self.states.recording = recordStatus.outputPaused ? OBSRecordingState.Paused : OBSRecordingState.Stopped
				}

				this.self.states.recordDirectory = recordDirectory?.recordDirectory

				this.self.checkFeedbacks('recording', 'recordingPaused')
				this.updateRecordingTimecode(recordStatus)
				this.self.setVariableValues({ recording: utils.getOBSRecordingStateLabel(this.self.states.recording) })
			}
		}
	}

	public updateRecordingTimecode(data: unknown): void {
		const outputTimecode = (data as any)?.outputTimecode
		if (outputTimecode) {
			const timecode = String(outputTimecode).split('.')[0]
			this.self.states.recordingTimecode = timecode
			const recordingTimecodeSplit = utils.splitTimecode(timecode)
			this.self.setVariableValues({
				recording: utils.getOBSRecordingStateLabel(this.self.states.recording),
				recording_timecode: timecode,
				recording_timecode_hh: recordingTimecodeSplit.hh,
				recording_timecode_mm: recordingTimecodeSplit.mm,
				recording_timecode_ss: recordingTimecodeSplit.ss,
			})
		} else if (this.self.states.recording === OBSRecordingState.Stopped) {
			this.self.setVariableValues({
				recording: utils.getOBSRecordingStateLabel(this.self.states.recording),
				recording_timecode: '00:00:00',
				recording_timecode_hh: '00',
				recording_timecode_mm: '00',
				recording_timecode_ss: '00',
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

	public async getAllOutputStatuses(): Promise<void> {
		if (this.self.states.outputs.size === 0 || this.self.states.sceneCollectionChanging) {
			return
		}

		// Batch all output status requests into a single batch call
		const outputNames = Array.from(this.self.states.outputs.keys())
		const batch: OBSBatchRequest[] = outputNames.map((outputName) => ({
			requestType: 'GetOutputStatus',
			requestData: { outputName },
			requestId: outputName,
		}))

		const responses = await this.sendBatch(batch)
		if (responses) {
			for (const res of responses) {
				if (res.requestStatus.result && res.responseData) {
					const outputName = res.requestId
					this.self.states.outputs.set(outputName, res.responseData)
				}
			}
			this.self.checkFeedbacks('output_active')
		}
	}

	public async getReplayBufferStatus(): Promise<void> {
		const replayBuffer = await this.sendRequest('GetReplayBufferStatus')

		if (replayBuffer) {
			this.self.states.replayBuffer = replayBuffer.outputActive
			this.self.checkFeedbacks('replayBufferActive')
		} else {
			logger.debug('GetReplayBufferStatus failed or returned no data')
		}
	}

	// ═══ Scene Collection Specific Info ═══
	public async buildSceneList(): Promise<void> {
		// Reset bumps the state epoch: any responses still in flight from before this
		// point are discarded by the fetchers below rather than written into fresh state.
		this.self.obsState.resetSceneSourceStates()
		const epoch = this.self.obsState.epoch

		const sceneList = await this.sendRequest('GetSceneList')
		if (!sceneList || this.self.obsState.epoch !== epoch) return

		if (Array.isArray(sceneList.scenes)) {
			for (const scene of sceneList.scenes) {
				this.registerScene(scene.sceneUuid as string, scene.sceneName as string, scene.sceneIndex as number)
			}
		}

		this.self.states.previewScene = sceneList.currentPreviewSceneName ?? 'None'
		this.self.states.previewSceneUuid = sceneList.currentPreviewSceneUuid ?? ''
		if (sceneList.currentProgramSceneName) {
			this.self.states.programScene = sceneList.currentProgramSceneName ?? 'None'
		}
		this.self.states.programSceneUuid = sceneList.currentProgramSceneUuid ?? ''

		this.self.setVariableValues({
			scene_preview: this.self.states.previewScene,
			scene_active: this.self.states.programScene,
		})

		// Register every input from the authoritative input list first (covers global
		// audio devices and inputs not placed in any scene), then walk scene items for
		// containment. Scene items still register nested scenes and groups via addSource.
		const allSourceUuids = new Set<string>(await this.buildInputList())
		if (this.self.obsState.epoch !== epoch) return

		// Walk scenes for containment first; that reveals which sources are groups, whose
		// own contents are then fetched. Scenes and groups land in the same sceneItems map.
		const sceneUuids = Array.from(this.self.states.scenes.keys())
		await this.fetchContainerItems(sceneUuids, false, allSourceUuids)
		if (this.self.obsState.epoch !== epoch) return

		const groupUuids = Array.from(this.self.states.sources.values())
			.filter((s) => s.isGroup)
			.map((s) => s.sourceUuid)

		await this.fetchContainerItems(groupUuids, true, allSourceUuids)
		if (this.self.obsState.epoch !== epoch) return

		await this.fetchSourcesData(Array.from(allSourceUuids))

		void this.self.updateActionsFeedbacksVariables()
	}

	// Fetches the item lists for a batch of containers (all scenes, or all groups) into the
	// unified sceneItems map. A group's items get their parentGroupUuid stamped so consumers
	// can resolve a grouped source back to its container.
	private async fetchContainerItems(
		containerUuids: string[],
		isGroup: boolean,
		allSourceUuids: Set<string>,
	): Promise<void> {
		if (containerUuids.length === 0) return
		const epoch = this.self.obsState.epoch

		const requestType = isGroup ? 'GetGroupSceneItemList' : 'GetSceneItemList'
		const batch: OBSBatchRequest[] = containerUuids.map((uuid) => ({
			requestType,
			requestData: { sceneUuid: uuid },
			requestId: uuid,
		}))

		const response = await this.sendBatch(batch)
		if (!response || this.self.obsState.epoch !== epoch) return

		for (const res of response) {
			if (!res.requestStatus.result) continue
			const containerUuid = res.requestId
			const items = (res.responseData?.sceneItems ?? []) as OBSSceneItem[]
			this.self.states.sceneItems.set(containerUuid, items)
			for (const item of items) {
				allSourceUuids.add(item.sourceUuid)
				const source = this.addSource(item.sourceUuid, item.sourceName, item.inputKind, item.isGroup)
				if (isGroup) source.parentGroupUuid = containerUuid
			}
		}
	}

	public async fetchSourcesData(sourceUuids: string[]): Promise<void> {
		if (sourceUuids.length === 0) return
		const epoch = this.self.obsState.epoch

		const batch = this.buildSourceDataBatchRequests(sourceUuids)
		const responses = await this.sendBatch(batch)
		if (this.self.obsState.epoch !== epoch) return

		if (responses) {
			this.processSourceDataBatchResponses(responses)
		}

		this.self.checkFeedbacks('scene_item_active', 'audio_muted', 'volume', 'audio_monitor_type')
	}

	private buildSourceDataBatchRequests(sourceUuids: string[]): OBSBatchRequest[] {
		const batch: OBSBatchRequest[] = []
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
		return batch
	}

	private processSourceDataBatchResponses(responses: OBSBatchResponse[]): void {
		for (const res of responses) {
			if (!res.requestStatus.result) continue

			const requestIdParts = res.requestId.split(':')
			if (requestIdParts.length < 2) continue
			const [uuid, type] = requestIdParts
			const source = this.self.states.sources.get(uuid)
			if (!source) continue

			const data = res.responseData
			const validName = source.validName ?? utils.validName(source.sourceName)
			if (!source.validName) source.validName = validName

			this.processSingleSourceDataResponse(uuid, type, data, source)
		}
	}

	private processSingleSourceDataResponse(uuid: string, type: string, data: any, source: OBSSource): void {
		switch (type) {
			case 'active':
				source.active = data.videoActive
				source.videoShowing = data.videoShowing
				break
			case 'filters':
				this.self.states.sourceFilters.set(uuid, data.filters)
				break
			case 'settings':
				// buildInputSettings already merges the input kind's default settings,
				// so a single call is sufficient (a second call with only defaults would
				// overwrite the real settings).
				this.buildInputSettings(uuid, data.inputKind ?? '', data.inputSettings)
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

	private _updateSourceMute(source: OBSSource, muted: boolean): void {
		source.inputMuted = muted
		this.self.setVariableValues({ [`mute_${source.validName}`]: muted ? 'Muted' : 'Unmuted' })
	}

	private _updateSourceVolume(source: OBSSource, volumeDb: number): void {
		source.inputVolume = utils.roundNumber(volumeDb, 1)
		this.self.setVariableValues({ [`volume_${source.validName}`]: source.inputVolume + ' dB' })
	}

	private _updateSourceBalance(source: OBSSource, balance: number): void {
		source.inputAudioBalance = utils.roundNumber(balance, 1)
		this.self.setVariableValues({ [`balance_${source.validName}`]: source.inputAudioBalance })
	}

	private _updateSourceSyncOffset(source: OBSSource, offset: number): void {
		source.inputAudioSyncOffset = offset
		this.self.setVariableValues({ [`sync_offset_${source.validName}`]: offset + 'ms' })
	}

	private _updateSourceMonitorType(source: OBSSource, monitorType: ObsAudioMonitorType): void {
		source.monitorType = monitorType
		this.self.setVariableValues({ [`monitor_${source.validName}`]: utils.getMonitorTypeLabel(monitorType) })
	}

	// Refreshes a single container's item list (routing to the group or scene request based
	// on whether the UUID is a known group) and returns the contained source UUIDs. This is
	// what lets SceneItemCreated inside a group work — it needs GetGroupSceneItemList, which
	// GetSceneItemList rejects. Returns undefined if the request failed or state was reset.
	private async refreshContainerItemList(containerUuid: string): Promise<string[] | undefined> {
		const epoch = this.self.obsState.epoch
		const isGroup = this.self.states.sources.get(containerUuid)?.isGroup ?? false
		const requestType = isGroup ? 'GetGroupSceneItemList' : 'GetSceneItemList'
		const data = await this.sendRequest(requestType, { sceneUuid: containerUuid })
		if (!data || this.self.obsState.epoch !== epoch) return undefined

		const items = (data.sceneItems ?? []) as OBSSceneItem[]
		this.self.states.sceneItems.set(containerUuid, items)
		const sourceUuids: string[] = []
		for (const item of items) {
			sourceUuids.push(item.sourceUuid)
			// addSource upserts, so known sources are refreshed, not duplicated.
			const source = this.addSource(item.sourceUuid, item.sourceName, item.inputKind, item.isGroup)
			if (isGroup) source.parentGroupUuid = containerUuid
		}
		return sourceUuids
	}

	public async buildSourceList(containerUuid: string): Promise<void> {
		const sourceUuids = await this.refreshContainerItemList(containerUuid)
		if (sourceUuids) await this.fetchSourcesData(sourceUuids)
	}

	// Handles a single SceneItemCreated: refresh the container's item list (one request) but
	// only fetch full source data for the new source, instead of re-fetching every source in
	// the container as buildSourceList does. Matters when adding one item to a large scene.
	public async addSceneItem(containerUuid: string, sourceUuid: string): Promise<void> {
		const sourceUuids = await this.refreshContainerItemList(containerUuid)
		if (sourceUuids) await this.fetchSourcesData([sourceUuid])
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
			this.registerScene(scene.sceneUuid, sceneName)
			await this.buildSourceList(scene.sceneUuid)
			void this.self.updateActionsFeedbacksVariables()
		}
	}

	public async removeScene(sceneUuid: string): Promise<void> {
		this.self.states.scenes.delete(sceneUuid)
		this.self.states.sceneItems.delete(sceneUuid)
		this.self.obsState.invalidateSceneNameIndex()
		void this.self.updateActionsFeedbacksVariables()
	}

	// Source Info
	public async getOBSMediaStatus(): Promise<void> {
		const mediaSourceList = this.self.obsState.mediaSourceList
		if (mediaSourceList.length === 0) return

		const batch = mediaSourceList.map((source) => ({
			requestId: source.id as string,
			requestType: 'GetMediaInputStatus',
			requestData: { inputName: source.id },
		}))

		const data = await this.sendBatch(batch)
		if (data) {
			const allValues: Record<string, string | number | boolean | undefined> = {}
			const currentMedia: Array<{ name: string; elapsed: string; remaining: string }> = []
			for (const response of data) {
				if (response.requestStatus.result) {
					this.processMediaStatusResponse(response, allValues, currentMedia)
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

	private processMediaStatusResponse(
		response: OBSBatchResponse,
		allValues: Record<string, string | number | boolean | undefined>,
		currentMedia: Array<{ name: string; elapsed: string; remaining: string }>,
	): void {
		const sourceName = response.requestId
		const source = this.self.obsState.findSourceByName(sourceName)
		if (!source) return

		const validName = source.validName ?? sourceName
		const responseData = response.responseData

		source.OBSMediaStatus = responseData.mediaState
		source.mediaCursor = responseData.mediaCursor
		source.mediaDuration = responseData.mediaDuration

		const remainingValue = (responseData.mediaDuration ?? 0) - (responseData.mediaCursor ?? 0)
		source.timeElapsed = utils.formatTimecode(responseData.mediaCursor)
		source.timeRemaining = remainingValue > 0 ? utils.formatTimecode(remainingValue) : '--:--:--'

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

	public buildInputSettings(sourceUuid: string, inputKind: string, inputSettings: Record<string, any>): void {
		const source = this.self.states.sources.get(sourceUuid)
		if (!source) return

		const kindList = this.self.states.inputKindList.get(inputKind)
		source.settings = kindList?.defaultInputSettings
			? { ...kindList.defaultInputSettings, ...inputSettings }
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
			// Keep the media file name variable in sync when settings change, rather than
			// waiting for the next full definitions rebuild.
			let file = ''
			if (settings?.playlist) {
				file = settings.playlist[0]?.value?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
			} else if (settings?.local_file) {
				file = settings.local_file.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
			}
			this.self.setVariableValues({ [`media_file_name_${name}`]: file })
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
		const epoch = this.self.obsState.epoch
		const data = await this.sendRequest('GetSourceFilterList', { sourceUuid: sourceUuid })
		if (data && this.self.obsState.epoch === epoch) {
			this.self.states.sourceFilters.set(sourceUuid, data.filters as any)
		}
	}

	public updateAudioPeak(data: {
		inputs: Array<{ inputUuid: string; inputLevelsMul: Array<[number, number, number]> }>
	}): void {
		this.self.states.audioPeak.clear()
		let changed = false
		data.inputs.forEach((input) => {
			const channel = input.inputLevelsMul[0]
			// Floor silent/absent inputs to the bottom of the range so a source that goes
			// quiet resets instead of keeping its last loud peak (which left audioPeaking on).
			let dbPeak = -100
			const channelPeak = channel?.[1]
			if (channelPeak && channelPeak > 0) {
				const computed = Math.round(20.0 * Math.log10(channelPeak))
				if (isFinite(computed)) dbPeak = computed
			}
			this.self.states.audioPeak.set(input.inputUuid, dbPeak)
			const source = this.self.states.sources.get(input.inputUuid)
			if (source) {
				if (source.peak !== dbPeak) changed = true
				source.peak = dbPeak
			}
		})
		// Meters arrive ~20×/second; only re-evaluate feedbacks when a level actually
		// changed, and throttle to ~10Hz. Meters keep firing (even in silence) so a pending
		// change always flushes on a later tick.
		if (changed) this.meterFeedbackPending = true
		const now = Date.now()
		if (this.meterFeedbackPending && now - this.lastMeterFeedbackCheck >= OBSApi.METER_FEEDBACK_THROTTLE_MS) {
			this.lastMeterFeedbackCheck = now
			this.meterFeedbackPending = false
			this.self.checkFeedbacks('audioPeaking', 'audioMeter')
		}
	}

	public async setSourceVisibility(
		sourceName: string,
		visible: string,
		options: { anyScene: boolean; useCurrentScene: boolean; scene: string },
	): Promise<void> {
		const source = this.self.obsState.findSourceByName(sourceName)
		if (!source) return

		const sources = this.findSourceInstances(source.sourceUuid, options)
		if (sources.length > 0) {
			const requests = this.buildSourceVisibilityRequests(sources, visible)
			await this.sendBatch(requests)
		}
	}

	private findSourceInstances(
		sourceUuid: string,
		options: { anyScene: boolean; useCurrentScene: boolean; scene: string },
	): { containerUuid: string; sceneItemId: number }[] {
		const instances: { containerUuid: string; sceneItemId: number }[] = []

		if (options.anyScene) {
			// Scenes and groups share one map, so a single walk covers both.
			for (const [containerUuid, items] of this.self.states.sceneItems) {
				const item = items.find((i) => i.sourceUuid === sourceUuid)
				if (item) instances.push({ containerUuid, sceneItemId: item.sceneItemId })
			}
		} else {
			const scene = options.useCurrentScene
				? this.self.states.scenes.get(this.self.states.programSceneUuid)
				: this.self.obsState.findSceneByName(options.scene)

			if (!scene) return instances

			// A grouped source lives in its group's container, not directly in the scene.
			const source = this.self.states.sources.get(sourceUuid)
			const containerUuid = source?.parentGroupUuid ?? scene.sceneUuid
			const item = this.self.states.sceneItems.get(containerUuid)?.find((i) => i.sourceUuid === sourceUuid)
			if (item) instances.push({ containerUuid, sceneItemId: item.sceneItemId })
		}

		return instances
	}

	private buildSourceVisibilityRequests(
		instances: { containerUuid: string; sceneItemId: number }[],
		visible: string,
	): OBSBatchRequest[] {
		return instances.map((instance) => {
			let enabled: boolean
			if (visible === 'toggle') {
				const item = this.self.states.sceneItems
					.get(instance.containerUuid)
					?.find((i) => i.sceneItemId === instance.sceneItemId)
				enabled = item ? !item.sceneItemEnabled : false
			} else {
				enabled = visible === 'true'
			}

			return {
				requestType: 'SetSceneItemEnabled',
				requestData: {
					// SetSceneItemEnabled accepts a group UUID in its sceneUuid field.
					sceneUuid: instance.containerUuid,
					sceneItemId: instance.sceneItemId,
					sceneItemEnabled: enabled,
				},
			}
		})
	}

	public async setFilterVisibility(
		filterName: string,
		visible: string,
		options: { allSources: boolean; source: string },
	): Promise<void> {
		if (options.allSources) {
			const requests: OBSBatchRequest[] = []
			this.self.states.sourceFilters.forEach((filters, sourceUuid) => {
				const filter = filters.find((f: any) => f.filterName === filterName)
				if (filter) {
					let filterVisibility: boolean
					if (visible === 'toggle') {
						filterVisibility = !filter.filterEnabled
					} else {
						filterVisibility = visible === 'true'
					}
					requests.push({
						requestType: 'SetSourceFilterEnabled',
						requestData: {
							sourceUuid: sourceUuid,
							filterName: filterName,
							filterEnabled: filterVisibility,
						},
					})
				}
			})

			await this.sendBatch(requests)
		} else {
			const source = this.self.obsState.findSourceByName(options.source)
			if (!source) return
			const sourceUuid = source.sourceUuid
			let filterVisibility: boolean
			if (visible === 'toggle') {
				const filters = this.self.states.sourceFilters.get(sourceUuid)
				const filter = filters?.find((f) => f.filterName === filterName)
				if (filter) {
					filterVisibility = !filter.filterEnabled
				} else {
					return
				}
			} else {
				filterVisibility = visible === 'true'
			}

			await this.sendRequest('SetSourceFilterEnabled', {
				sourceUuid: sourceUuid,
				filterName: filterName,
				filterEnabled: filterVisibility,
			})
		}
	}
}
