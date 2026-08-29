import { InstanceStatus, createModuleLogger, type JsonObject } from '@companion-module/base'
import OBSWebSocket, {
	EventSubscription,
	OBSRequestTypes,
	OBSResponseTypes,
	RequestBatchExecutionType,
} from 'obs-websocket-js'
import { initOBSListeners } from './listeners.js'
import type OBSInstance from './main.js'
import * as utils from './utils.js'
import {
	OBSMediaStatus,
	OBSRecordingState,
	ObsAudioMonitorType,
	OBSSource,
	OBSBatchRequest,
	OBSBatchResponse,
	type ContainerItemsBatchSpec,
	type InputKindDefaultsBatchSpec,
	type MediaStatusBatchSpec,
	type OBSInputListEntry,
	type OBSMonitorListEntry,
	type OBSOutput,
	type OutputStatusBatchSpec,
	type SceneFilterBatchSpec,
	type OBSTransition,
	type SourceDataBatchSpec,
	type OBSFilter,
} from './types.js'
import { BatchBuilder, successfulEntry, type BatchEntry, type BatchSpec, type SuccessfulBatchEntry } from './batch.js'
import type { SceneItemMatch } from './state.js'

import {
	INPUT_KIND_IMAGE_SOURCE,
	POLL_INTERVALS,
	FADE_STEP_MS,
	isMediaInputKind,
	isSelectableOutput,
	isTextInputKind,
	VIRTUALCAM_OUTPUT_NAME,
} from './constants.js'

const logger = createModuleLogger('OBSApi')

// OBS Api Class
export class OBSApi {
	private self: OBSInstance

	// Poll intervals in milliseconds.
	private static readonly RECONNECTION_POLL_INTERVAL = POLL_INTERVALS.RECONNECTION
	private static readonly STATS_POLL_INTERVAL = POLL_INTERVALS.STATS
	private static readonly MEDIA_POLL_INTERVAL = POLL_INTERVALS.MEDIA

	// Guard against overlapping connection attempts.
	private connecting = false

	// Subscription tracking for volume meters (keyed by feedback ID).
	private meterSubscribers = new Set<string>()
	private metersActive = false
	private lastMeterFeedbackCheck = 0
	private meterFeedbackPending = false
	private static readonly METER_FEEDBACK_THROTTLE_MS = 100

	// Last seen free disk space, so the threshold feedback isn't re-evaluated every poll tick.
	private lastFreeDiskSpaceMB?: number

	// Source names with a volume fade batch currently executing in OBS.
	private fadesInFlight = new Set<string>()

	// Subscription tracking for output-status polling (keyed by feedback ID).
	private outputStatusSubscribers = new Set<string>()
	// Outputs with a dedicated state-changed event don't need polling.
	private static readonly OUTPUTS_WITH_DEDICATED_EVENTS = new Set([VIRTUALCAM_OUTPUT_NAME])

	// Event subscriptions except high-frequency volume meters.
	private get baseEventSubscriptions(): number {
		return EventSubscription.All | EventSubscription.InputActiveStateChanged | EventSubscription.InputShowStateChanged
	}

	constructor(self: OBSInstance) {
		this.self = self
	}

	// Initialization and Connection
	public initializeStates(): void {
		this.self.obsState.resetSceneSourceStates()
		// Reset state
		this.self.states.sceneCollectionChanging = false
	}

	public async connectOBS(): Promise<void> {
		// Skip if connection attempt is in flight.
		if (this.connecting) {
			logger.debug('Connection attempt already in progress, skipping')
			return
		}
		this.connecting = true
		try {
			// Run disconnect inside try so connecting flag isn't wedged on failure.
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
					// Skip SceneItemTransformChanged.
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

				// Setup initial state.
				this.initializeStates()

				// Get capabilities that only depend on the OBS installation, not the loaded profile.
				const capabilities = await this.getObsCapabilities()

				if (capabilities) {
					// Start listeners.
					initOBSListeners(this.self)

					// None of these depend on one another, so fetch them together.
					await Promise.all([
						this.getStats(),
						this.getRecordStatus(),
						this.getStreamStatus(),
						this.profileInfo(),
						this.buildProfileList(),
						this.buildSceneCollectionList(),
						this.buildSceneTransitionList(),
					])
					this.startStatsPoll()

					// Build scene list (registers inputs and scene containment).
					await this.buildSceneList()
				} else {
					// Fail connection if OBS capabilities could not be fetched.
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
		// A terminal failure stops the retry loop even if it started before the cause was known.
		if (tryReconnect) {
			if (!this.self.reconnectionPoll) this.startReconnectionPoll()
		} else {
			this.stopReconnectionPoll()
		}
	}

	public async disconnectOBS(): Promise<void> {
		// Stop reconnection poll to prevent hammering stale address on config change.
		this.stopReconnectionPoll()
		this.metersActive = false
		if (this.self.socket) {
			// Clear active polls.
			this.stopStatsPoll()
			this.stopMediaPoll()
			// Remove event listeners.
			this.self.socket.removeAllListeners()
			// Disconnect socket.
			await this.self.socket.disconnect()
		}
	}

	// Volume Meter Subscription
	public addMeterSubscriber(feedbackId: string): void {
		const wasEmpty = this.meterSubscribers.size === 0
		this.meterSubscribers.add(feedbackId)
		if (wasEmpty) this.applyMeterSubscription(true)
	}

	public removeMeterSubscriber(feedbackId: string): void {
		this.meterSubscribers.delete(feedbackId)
		if (this.meterSubscribers.size === 0) this.applyMeterSubscription(false)
	}

	// Output-status polling only runs while an output_active feedback is on a button.
	public addOutputStatusSubscriber(feedbackId: string): void {
		this.outputStatusSubscribers.add(feedbackId)
	}

	public removeOutputStatusSubscriber(feedbackId: string): void {
		this.outputStatusSubscribers.delete(feedbackId)
	}

	private applyMeterSubscription(enable: boolean): void {
		if (!this.self.socket || this.metersActive === enable) return
		this.metersActive = enable
		const subscriptions = enable
			? this.baseEventSubscriptions | EventSubscription.InputVolumeMeters
			: this.baseEventSubscriptions
		void this.self.socket.reidentify({ eventSubscriptions: subscriptions }).catch((error: unknown) => {
			logger.debug(`Failed to update meter subscription (${utils.describeError(error)})`)
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

	// OBS WebSocket Commands
	public async sendRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		try {
			return await this.self.socket.call(requestType, requestData)
		} catch (error) {
			logger.debug(`Request ${requestType} failed (${utils.describeError(error)})`)
			return undefined
		}
	}

	public async sendCustomRequest<T extends keyof OBSRequestTypes>(
		requestType: T,
		requestData?: OBSRequestTypes[T],
	): Promise<OBSResponseTypes[T] | undefined> {
		const data = await this.sendRequest(requestType, requestData)
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

	/**
	 * Sends a fire-and-forget batch. Callers that need the responses correlated back to what they asked
	 * for should build the batch with a {@link BatchBuilder} and use {@link runBatch} instead.
	 */
	public async sendBatch(batch: OBSBatchRequest[]): Promise<void> {
		await this._callBatch(batch, () => false)
	}

	/**
	 * Sends a batch built by a {@link BatchBuilder} and returns each response paired with the metadata
	 * recorded for it, so responses are correlated without parsing meaning back out of request IDs.
	 */
	public async runBatch<TSpec extends BatchSpec>(
		builder: BatchBuilder<TSpec>,
	): Promise<BatchEntry<TSpec>[] | undefined> {
		const data = await this._callBatch(builder.requests, (requestId) => builder.isOptional(requestId))
		return data ? builder.resolve(data) : undefined
	}

	private async _callBatch(
		batch: OBSBatchRequest[],
		isOptional: (requestId: string) => boolean,
	): Promise<OBSBatchResponse[] | undefined> {
		if (batch.length === 0) return []
		try {
			// `callBatch` is typed against a union of concrete request shapes; our batches are built
			// dynamically from string request types, which that union cannot represent.
			//
			// Always serial: with `Parallel`, obs-websocket returns each result's `responseData` in
			// completion order while leaving `requestId`/`requestType` in request order, so responses get
			// paired with the wrong request. Serial execution keeps a batch correlatable.
			const data = (await this.self.socket.callBatch(batch as Parameters<OBSWebSocket['callBatch']>[0], {
				executionType: RequestBatchExecutionType.SerialRealtime,
			})) as unknown as OBSBatchResponse[]

			const errors = data.filter((request) => !request.requestStatus.result && !isOptional(request.requestId))
			if (errors.length > 0) {
				const errorMessages = errors.map((error) => `${error.requestType}: ${error.requestStatus.comment}`).join(' // ')
				logger.debug(`Partial batch request failure (${errorMessages})`)
			}
			return data
		} catch (error) {
			logger.debug(`Batch request failed (${utils.describeError(error)})`)
			return undefined
		}
	}

	// Upserts a source, preserving existing information.
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

	// Polls
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
				// Build parallel requests array.
				const promises: Promise<void>[] = [this.getStats()]

				// Add stream/record status if active.
				if (this.self.states.streaming) {
					promises.push(this.getStreamStatus())
				}
				if (this.self.states.recording === OBSRecordingState.Recording) {
					promises.push(this.getRecordStatus())
				}

				// getAllOutputStatuses no-ops when there is nothing to poll or no subscriber.
				promises.push(this.getAllOutputStatuses())

				// Run poll requests in parallel.
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

	/**
	 * The media poll should run exactly when the collection contains media sources.
	 *
	 * Derived from state rather than started as a side effect of parsing an input's settings, so the
	 * poll stops when the last media source goes away and restarts on its own after a bulk reload,
	 * instead of depending on which unrelated request happens to run next.
	 */
	public reconcileMediaPoll(): void {
		const needed = this.self.obsState.mediaSourceUuids.length > 0
		if (needed && !this.self.mediaPoll) {
			this.startMediaPoll()
		} else if (!needed && this.self.mediaPoll) {
			this.stopMediaPoll()
		}
	}

	public stopMediaPoll(): void {
		if (this.self.mediaPoll) {
			clearInterval(this.self.mediaPoll)
			delete this.self.mediaPoll
		}
	}

	// General OBS Project Info

	// Data that only changes with the OBS installation itself, not the loaded profile or scene
	// collection — fetched once per connection.
	public async getObsCapabilities(): Promise<boolean> {
		try {
			// None of these depend on one another, so pay one round trip rather than three.
			const [version, studioMode] = await Promise.all([
				this.sendRequest('GetVersion'),
				this.sendRequest('GetStudioModeEnabled'),
				this.buildMonitorList(),
				this.getInputKindList(),
			])
			if (!version) return false

			this.self.states.version = version
			logger.debug(
				`OBS Version: ${version.obsVersion} // OBS WebSocket Version: ${version.obsWebSocketVersion} // Platform: ${version.platformDescription}`,
			)
			this.self.states.imageFormats = version.supportedImageFormats.map((format: string) => ({
				id: format,
				label: format,
			}))

			if (studioMode) {
				this.self.states.studioMode = studioMode.studioModeEnabled ?? false
			}

			return true
		} catch (error) {
			logger.debug(utils.describeError(error))
			return false
		}
	}

	// Data scoped to the current profile / scene collection — refreshed on connect and again
	// whenever the profile or scene collection changes.
	public async profileInfo(): Promise<void> {
		await Promise.all([
			this.buildHotkeyList(),
			this.buildOutputList(),
			this.getVideoSettings(),
			this.getReplayBufferStatus(),
			this.getRecordDirectory(),
			this.getStreamServiceSettings(),
		])
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
		const kinds = inputKindList?.inputKinds
		if (!kinds || kinds.length === 0) return

		for (const inputKind of kinds) {
			this.self.states.inputKindList.set(inputKind, {})
		}

		const builder = new BatchBuilder<InputKindDefaultsBatchSpec>()
		for (const inputKind of kinds) {
			builder.add('defaults', 'GetInputDefaultSettings', { inputKind }, { inputKind }, false)
		}

		const entries = await this.runBatch(builder)
		if (!entries) return

		for (const entry of entries) {
			const successful = successfulEntry<InputKindDefaultsBatchSpec>(entry)
			if (!successful) continue
			this.self.states.inputKindList.set(successful.meta.inputKind, successful.responseData.defaultInputSettings)
		}
	}

	public async buildProfileList(): Promise<void> {
		const profiles = await this.sendRequest('GetProfileList')
		this.self.states.profiles.clear()

		this.self.states.currentProfile = profiles?.currentProfileName ?? 'None'

		profiles?.profiles?.forEach((profile: string) => {
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
		collections?.sceneCollections?.forEach((sceneCollection: string) => {
			this.self.states.sceneCollections.set(sceneCollection, {})
		})

		this.self.checkFeedbacks('scene_collection_active')
		this.self.setVariableValues({ scene_collection: this.self.states.currentSceneCollection })

		void this.self.updateActionsFeedbacksVariables()
	}

	// Register all inputs from authoritative list.
	private async buildInputList(): Promise<string[]> {
		const epoch = this.self.obsState.epoch
		const data = await this.sendRequest('GetInputList')
		if (!data || this.self.obsState.epoch !== epoch) return []

		const uuids: string[] = []
		for (const input of (data.inputs ?? []) as unknown as OBSInputListEntry[]) {
			if (!input?.inputUuid || !input?.inputName) continue
			this.addSource(input.inputUuid, input.inputName, input.inputKind)
			uuids.push(input.inputUuid)
		}
		return uuids
	}

	public async buildOutputList(): Promise<void> {
		this.self.states.outputs.clear()

		const outputData = await this.sendRequest('GetOutputList')
		if (!outputData) return

		for (const output of (outputData.outputs ?? []) as unknown as OBSOutput[]) {
			if (output) this.self.states.outputs.set(output.outputName, output)
		}
		// Fetch statuses for all outputs in one request.
		void this.getAllOutputStatuses()
		void this.self.updateActionsFeedbacksVariables()
	}

	public async buildMonitorList(): Promise<void> {
		const monitorList = await this.sendRequest('GetMonitorList')

		if (monitorList && Array.isArray(monitorList.monitors)) {
			this.self.states.monitors = (monitorList.monitors as unknown as OBSMonitorListEntry[]).map((monitor) => {
				const monitorName = monitor.monitorName ?? `Display ${monitor.monitorIndex}`

				return {
					id: monitor.monitorIndex,
					label: `${monitorName} (${monitor.monitorWidth}x${monitor.monitorHeight})`,
				}
			})
		}
	}

	public async getStats(): Promise<void> {
		// Connection loss is handled via listener, not a catch block.
		const data = await this.sendRequest('GetStats')
		if (data) {
			this.self.states.stats = data

			const freeSpaceMB = utils.roundNumber(data.availableDiskSpace, 0)
			const freeSpace = freeSpaceMB > 1000 ? `${utils.roundNumber(freeSpaceMB / 1000, 0)} GB` : `${freeSpaceMB} MB`
			const diskSpaceChanged = freeSpaceMB !== this.lastFreeDiskSpaceMB
			this.lastFreeDiskSpaceMB = freeSpaceMB

			this.self.setVariableValues({
				fps: utils.roundNumber(data.activeFps, 2),
				render_total_frames: data.renderTotalFrames,
				render_missed_frames: data.renderSkippedFrames,
				output_total_frames: data.outputTotalFrames,
				output_skipped_frames: data.outputSkippedFrames,
				average_frame_time: utils.roundNumber(data.averageFrameRenderTime, 2),
				cpu_usage: utils.roundNumber(data.cpuUsage, 2),
				memory_usage: utils.roundNumber(data.memoryUsage, 0),
				free_disk_space: freeSpace,
				free_disk_space_mb: freeSpaceMB,
			})
			// Threshold feedback, polled once a second: only worth re-evaluating when the value moved.
			if (diskSpaceChanged) this.self.checkFeedbacks('freeDiskSpaceRemaining')
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

	// Outputs, Streams, Recordings
	public async getStreamStatus(): Promise<void> {
		const streamStatus = await this.sendRequest('GetStreamStatus')

		if (streamStatus) {
			const timecodeMatch = streamStatus.outputTimecode?.match(/\d\d:\d\d:\d\d/i)
			const timecode = timecodeMatch?.[0] ?? '00:00:00'
			const previousStreaming = this.self.states.streaming
			this.self.states.streaming = streamStatus.outputActive
			const streamingTimecodeSplit = utils.splitTimecode(timecode)

			const streamingChanged = this.self.states.streaming !== previousStreaming
			const congestionChanged = streamStatus.outputCongestion !== this.self.states.streamCongestion
			this.self.states.streamCongestion = streamStatus.outputCongestion

			const newBytes = streamStatus.outputBytes - this.self.states.outputBytes
			const kbits = newBytes > 0 ? Math.round((newBytes * 8) / 1000) : 0
			this.self.states.outputBytes = streamStatus.outputBytes

			const streamingState = utils.getStreamingState(this.self.states)

			if (streamingChanged) this.self.checkFeedbacks('streaming')
			if (congestionChanged) this.self.checkFeedbacks('streamCongestion')
			this.self.setVariableValues({
				streaming: utils.getOBSStreamingStateLabel(streamingState),
				stream_timecode: timecode,
				stream_timecode_hh: streamingTimecodeSplit.hh,
				stream_timecode_mm: streamingTimecodeSplit.mm,
				stream_timecode_ss: streamingTimecodeSplit.ss,
				stream_output_skipped_frames: streamStatus.outputSkippedFrames,
				stream_output_total_frames: streamStatus.outputTotalFrames,
				kbits_per_sec: kbits,
			})
		}
	}

	// The active stream service only changes on profile switch or Set Stream Settings; not worth polling.
	public async getStreamServiceSettings(): Promise<void> {
		const streamService = await this.sendRequest('GetStreamServiceSettings')
		this.self.setVariableValues({ stream_service: streamService?.streamServiceSettings?.service ?? 'Custom' })
	}

	public async getRecordStatus(): Promise<void> {
		const recordStatus = await this.sendRequest('GetRecordStatus')

		if (recordStatus) {
			const previousRecording = this.self.states.recording
			this.self.states.recording = recordStatus.outputPaused
				? OBSRecordingState.Paused
				: recordStatus.outputActive
					? OBSRecordingState.Recording
					: OBSRecordingState.Stopped

			if (this.self.states.recording !== previousRecording) {
				this.self.checkFeedbacks('recording', 'recordingPaused')
			}
			this.updateRecordingTimecode(recordStatus)
			this.self.setVariableValues({ recording: utils.getOBSRecordingStateLabel(this.self.states.recording) })
		}
	}

	// The record directory only changes on profile switch; not worth polling every second.
	public async getRecordDirectory(): Promise<void> {
		const recordDirectory = await this.sendRequest('GetRecordDirectory')
		this.self.states.recordDirectory = recordDirectory?.recordDirectory ?? ''
		this.self.setVariableValues({ recording_path: this.self.states.recordDirectory || 'None' })
	}

	public updateRecordingTimecode(data: { outputTimecode?: string } | undefined): void {
		const outputTimecode = data?.outputTimecode
		if (outputTimecode) {
			const timecode = String(outputTimecode).split('.')[0]
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

	public async getAllOutputStatuses(): Promise<void> {
		if (this.self.states.outputs.size === 0 || this.self.states.sceneCollectionChanging) {
			return
		}
		// Nothing reads output_active, so there's nothing to keep fresh.
		if (this.outputStatusSubscribers.size === 0) return

		// Skip outputs with a dedicated state-changed event, and any that aren't offered as feedback
		// targets in the first place — isSelectableOutput is the same rule state.outputList applies.
		const outputNames = Array.from(this.self.states.outputs.keys()).filter(
			(name) => !OBSApi.OUTPUTS_WITH_DEDICATED_EVENTS.has(name) && isSelectableOutput(name),
		)
		if (outputNames.length === 0) return

		const builder = new BatchBuilder<OutputStatusBatchSpec>()
		for (const outputName of outputNames) {
			builder.add('status', 'GetOutputStatus', { outputName }, { outputName }, false)
		}

		const entries = await this.runBatch(builder)
		if (entries) {
			for (const entry of entries) {
				const successful = successfulEntry<OutputStatusBatchSpec>(entry)
				if (!successful) continue
				this.self.states.outputs.set(successful.meta.outputName, successful.responseData)
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

	// Scene Collection Specific Info
	public async buildSceneList(): Promise<void> {
		// Reset state epoch to discard older in-flight responses.
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

		// Register inputs from input list, then scene items for containment.
		const allSourceUuids = new Set<string>(await this.buildInputList())
		if (this.self.obsState.epoch !== epoch) return

		// Walking the scenes pulls in their groups' contents too.
		const sceneUuids = Array.from(this.self.states.scenes.keys())
		const contained = await this.fetchContainers(sceneUuids)
		if (!contained) return
		for (const sourceUuid of contained) allSourceUuids.add(sourceUuid)

		await this.fetchSourcesData(Array.from(allSourceUuids))
		if (this.self.obsState.epoch !== epoch) return

		// Scenes can carry filters too, and are not part of the source map.
		await this.fetchSceneFilters(sceneUuids)

		this.reconcileMediaPoll()
		void this.self.updateActionsFeedbacksVariables()
	}

	// A GetSourceFilterList reply can succeed without carrying a filters array; storing that as-is
	// leaves a non-iterable value in the map that every filter consumer then trips over.
	private setSourceFilters(uuid: string, filters: OBSFilter[] | undefined): void {
		this.self.states.sourceFilters.set(uuid, filters ?? [])
	}

	// Fetch filter lists for scenes, which fetchSourcesData does not cover.
	public async fetchSceneFilters(sceneUuids: string[]): Promise<void> {
		if (sceneUuids.length === 0) return
		const epoch = this.self.obsState.epoch

		const builder = new BatchBuilder<SceneFilterBatchSpec>()
		for (const sceneUuid of sceneUuids) {
			builder.add('filters', 'GetSourceFilterList', { sourceUuid: sceneUuid }, { sceneUuid }, false)
		}

		const entries = await this.runBatch(builder)
		if (!entries || this.self.obsState.epoch !== epoch) return

		for (const entry of entries) {
			const successful = successfulEntry<SceneFilterBatchSpec>(entry)
			if (!successful) continue
			this.setSourceFilters(successful.meta.sceneUuid, successful.responseData.filters)
		}
	}

	/**
	 * Fetches the item lists of the given containers and registers everything they hold.
	 *
	 * Scenes and groups share one item map and differ only in the request that reads them, so the
	 * request is chosen per container from what the source map already knows rather than being passed
	 * in. Groups found inside a container are fetched in a follow-up round; OBS does not nest groups
	 * any further, so the loop settles after one.
	 *
	 * Returns every contained source UUID, or undefined if the state was reset while in flight.
	 */
	private async fetchContainers(containerUuids: string[]): Promise<Set<string> | undefined> {
		const contained = new Set<string>()
		const epoch = this.self.obsState.epoch
		let pending = containerUuids

		while (pending.length > 0) {
			const builder = new BatchBuilder<ContainerItemsBatchSpec>()
			for (const containerUuid of pending) {
				// Scenes are absent from the source map, so anything unknown here is a scene.
				const isGroup = this.self.states.sources.get(containerUuid)?.isGroup ?? false
				const requestType = isGroup ? 'GetGroupSceneItemList' : 'GetSceneItemList'
				builder.add('items', requestType, { sceneUuid: containerUuid }, { containerUuid, isGroup }, false)
			}

			const entries = await this.runBatch(builder)
			if (!entries || this.self.obsState.epoch !== epoch) return undefined

			const nested: string[] = []
			for (const entry of entries) {
				if (!entry.requestStatus.result) continue
				const { containerUuid, isGroup } = entry.meta
				const items = entry.responseData?.sceneItems ?? []
				this.self.states.sceneItems.set(containerUuid, items)
				for (const item of items) {
					contained.add(item.sourceUuid)
					// addSource upserts, so known sources are refreshed, not duplicated.
					const source = this.addSource(item.sourceUuid, item.sourceName, item.inputKind, item.isGroup)
					if (isGroup) source.parentGroupUuid = containerUuid
					if (item.isGroup && !isGroup) nested.push(item.sourceUuid)
				}
			}
			pending = nested
		}

		return contained
	}

	public async fetchSourcesData(sourceUuids: string[]): Promise<void> {
		if (sourceUuids.length === 0) return
		const epoch = this.self.obsState.epoch

		const builder = this.buildSourceDataBatch(sourceUuids)
		const entries = await this.runBatch(builder)
		if (this.self.obsState.epoch !== epoch) return

		if (entries) {
			this.processSourceDataBatchResponses(entries)
		}

		this.self.checkFeedbacks('scene_item_active', 'audio_muted', 'volume', 'audio_monitor_type')
		this.reconcileMediaPoll()
	}

	private buildSourceDataBatch(sourceUuids: string[]): BatchBuilder<SourceDataBatchSpec> {
		const builder = new BatchBuilder<SourceDataBatchSpec>()
		for (const uuid of sourceUuids) {
			const meta = { uuid }
			builder.add('active', 'GetSourceActive', { sourceUuid: uuid }, meta, false)
			builder.add('filters', 'GetSourceFilterList', { sourceUuid: uuid }, meta, false)

			const source = this.self.states.sources.get(uuid)
			if (source?.inputKind) {
				builder.add('settings', 'GetInputSettings', { inputUuid: uuid }, meta, false)

				// Optimistically fetch input audio info: asking every input is cheaper than a round trip
				// to discover which ones have audio, so these failures are expected rather than logged.
				builder.add('mute', 'GetInputMute', { inputUuid: uuid }, meta, true)
				builder.add('volume', 'GetInputVolume', { inputUuid: uuid }, meta, true)
				builder.add('balance', 'GetInputAudioBalance', { inputUuid: uuid }, meta, true)
				builder.add('sync_offset', 'GetInputAudioSyncOffset', { inputUuid: uuid }, meta, true)
				builder.add('monitor', 'GetInputAudioMonitorType', { inputUuid: uuid }, meta, true)
				builder.add('tracks', 'GetInputAudioTracks', { inputUuid: uuid }, meta, true)
			}
		}
		return builder
	}

	private processSourceDataBatchResponses(entries: BatchEntry<SourceDataBatchSpec>[]): void {
		for (const entry of entries) {
			const successful = successfulEntry<SourceDataBatchSpec>(entry)
			if (!successful) continue

			const source = this.self.states.sources.get(successful.meta.uuid)
			if (!source) continue

			this.processSingleSourceDataResponse(successful, source)
		}
	}

	private processSingleSourceDataResponse(entry: SuccessfulBatchEntry<SourceDataBatchSpec>, source: OBSSource): void {
		const uuid = entry.meta.uuid
		switch (entry.kind) {
			case 'active':
				source.active = entry.responseData.videoActive
				source.videoShowing = entry.responseData.videoShowing
				break
			case 'filters':
				this.setSourceFilters(uuid, entry.responseData.filters)
				break
			case 'settings':
				// buildInputSettings merges default settings.
				this.buildInputSettings(uuid, entry.responseData.inputKind ?? '', entry.responseData.inputSettings)
				break
			case 'mute':
				this.updateSourceMute(source, entry.responseData.inputMuted)
				break
			case 'volume':
				this.updateSourceVolume(source, entry.responseData.inputVolumeDb)
				break
			case 'balance':
				this.updateSourceBalance(source, entry.responseData.inputAudioBalance)
				break
			case 'sync_offset':
				this.updateSourceSyncOffset(source, entry.responseData.inputAudioSyncOffset)
				break
			case 'monitor':
				this.updateSourceMonitorType(source, entry.responseData.monitorType)
				break
			case 'tracks':
				source.inputAudioTracks = entry.responseData.inputAudioTracks
				break
		}
	}

	/**
	 * Ramps a source to `targetVolume` over `duration`, as one batch of SetInputVolume steps separated
	 * by Sleep entries (only honoured by serial batch execution).
	 *
	 * The starting volume is read from OBS rather than taken from module state: state may be stale, or
	 * absent entirely for a source whose audio data was never fetched, and guessing there makes the
	 * fade jump before it ramps.
	 */
	public async fadeSourceVolume(sourceName: string, targetVolume: number, duration: number): Promise<void> {
		if (this.fadesInFlight.has(sourceName)) {
			logger.debug(`Ignoring fade for ${sourceName}, one is already in progress`)
			return
		}

		// Claimed before the first await, or two presses in the same tick both get past the check.
		// Tracked here rather than on the source object: a scene collection change clears the source map
		// mid-fade, which would drop the flag and let a second fade start while this batch still runs.
		this.fadesInFlight.add(sourceName)
		try {
			const current = await this.sendRequest('GetInputVolume', { inputName: sourceName })
			if (current?.inputVolumeDb === undefined) {
				logger.debug(`Cannot fade ${sourceName}, its current volume could not be read`)
				return
			}
			const currentVolume = current.inputVolumeDb

			const frames = Math.max(1, Math.floor(duration / FADE_STEP_MS))
			const volStep = (targetVolume - currentVolume) / frames
			const fadeBatch: OBSBatchRequest[] = []

			for (let i = 1; i <= frames; i++) {
				if (i > 1) {
					fadeBatch.push({ requestType: 'Sleep', requestData: { sleepMillis: FADE_STEP_MS } })
				}
				fadeBatch.push({
					requestType: 'SetInputVolume',
					requestData: { inputName: sourceName, inputVolumeDb: utils.roundNumber(currentVolume + volStep * i, 1) },
				})
			}

			await this.sendBatch(fadeBatch)
		} finally {
			this.fadesInFlight.delete(sourceName)
		}
	}

	public updateSourceMute(source: OBSSource, muted: boolean): void {
		source.inputMuted = muted
		this.self.setVariableValues({ [`mute_${source.validName}`]: muted ? 'Muted' : 'Unmuted' })
	}

	public updateSourceVolume(source: OBSSource, volumeDb: number): void {
		source.inputVolume = utils.roundNumber(volumeDb, 1)
		this.self.setVariableValues({ [`volume_${source.validName}`]: source.inputVolume })
	}

	public updateSourceBalance(source: OBSSource, balance: number): void {
		source.inputAudioBalance = utils.roundNumber(balance, 1)
		this.self.setVariableValues({ [`balance_${source.validName}`]: source.inputAudioBalance })
	}

	public updateSourceSyncOffset(source: OBSSource, offset: number): void {
		source.inputAudioSyncOffset = offset
		this.self.setVariableValues({ [`sync_offset_${source.validName}`]: offset })
	}

	public updateSourceMonitorType(source: OBSSource, monitorType: ObsAudioMonitorType | string): void {
		source.monitorType = monitorType
		this.self.setVariableValues({
			[`monitor_${source.validName}`]: utils.getMonitorTypeLabel(monitorType),
			[`monitor_active_${source.validName}`]: utils.isMonitoringEnabled(monitorType),
		})
	}

	public async buildSourceList(containerUuid: string): Promise<void> {
		const contained = await this.fetchContainers([containerUuid])
		if (contained) await this.fetchSourcesData(Array.from(contained))
	}

	// Refresh container item list and fetch data for the new source plus any group contents it pulled in.
	public async addSceneItem(containerUuid: string, sourceUuid: string): Promise<void> {
		const contained = await this.fetchContainers([containerUuid])
		if (!contained) return
		// A newly added group contributes its children, which have no data cached yet.
		const groupChildren = Array.from(contained).filter((uuid) => this.self.states.sources.get(uuid)?.parentGroupUuid)
		await this.fetchSourcesData(Array.from(new Set([sourceUuid, ...groupChildren])))
	}

	public async buildSceneTransitionList(): Promise<void> {
		const [sceneTransitionList, currentTransition] = await Promise.all([
			this.sendRequest('GetSceneTransitionList'),
			this.sendRequest('GetCurrentSceneTransition'),
		])

		// Each response stands on its own: a reply that did not arrive must leave the known state alone
		// rather than blanking it, or a single failed refresh permanently erases the transition list.
		const transitions = sceneTransitionList?.transitions as unknown as OBSTransition[] | undefined
		if (Array.isArray(transitions)) {
			this.self.states.transitions.clear()
			for (const item of transitions) {
				if (item.transitionName) {
					this.self.states.transitions.set(item.transitionName, item)
				}
			}
		} else {
			logger.debug('GetSceneTransitionList returned no transitions, keeping the previously known list')
		}

		if (currentTransition?.transitionName) {
			this.self.states.currentTransition = currentTransition.transitionName
			this.self.states.transitionDuration = currentTransition.transitionDuration ?? 0
		} else {
			logger.debug('GetCurrentSceneTransition returned no transition, keeping the previously known transition')
		}

		this.self.checkFeedbacks('transition_duration', 'current_transition')
		this.self.setVariableValues({
			current_transition: this.self.states.currentTransition,
			transition_duration: this.self.states.transitionDuration,
			transition_active: this.self.states.transitionActive,
			transition_list: this.self.obsState.transitionList.map((item) => item.id),
		})
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
		// Groups aren't shared across scenes, so a group contained in the removed scene is gone too;
		// clean up its item list and source entry rather than leaving them orphaned.
		const items = this.self.states.sceneItems.get(sceneUuid)
		if (items) {
			for (const item of items) {
				if (item.isGroup) {
					this.self.states.sceneItems.delete(item.sourceUuid)
					this.self.states.sources.delete(item.sourceUuid)
					this.self.states.sourceFilters.delete(item.sourceUuid)
				}
			}
		}

		this.self.states.scenes.delete(sceneUuid)
		this.self.states.sceneItems.delete(sceneUuid)
		// Scenes carry filters of their own, keyed by scene UUID (see fetchSceneFilters).
		this.self.states.sourceFilters.delete(sceneUuid)
		this.self.obsState.invalidateSceneNameIndex()
		this.self.obsState.invalidateSourceNameIndex()
		this.reconcileMediaPoll()
		void this.self.updateActionsFeedbacksVariables()
	}

	// Source Info
	public async getOBSMediaStatus(): Promise<void> {
		const mediaSourceUuids = this.self.obsState.mediaSourceUuids
		if (mediaSourceUuids.length === 0) return

		const builder = new BatchBuilder<MediaStatusBatchSpec>()
		for (const sourceUuid of mediaSourceUuids) {
			builder.add('status', 'GetMediaInputStatus', { inputUuid: sourceUuid }, { sourceUuid }, false)
		}

		const entries = await this.runBatch(builder)
		if (entries) {
			const allValues: Record<string, string | number | boolean | string[] | undefined> = {}
			const currentMedia: Array<{ name: string; elapsed: string; remaining: string }> = []
			for (const entry of entries) {
				const successful = successfulEntry<MediaStatusBatchSpec>(entry)
				if (successful) {
					this.processMediaStatusResponse(successful, allValues, currentMedia)
				}
			}

			allValues.current_media_name = currentMedia.map((v) => v.name)
			allValues.current_media_time_elapsed = currentMedia.map((v) => v.elapsed)
			allValues.current_media_time_remaining = currentMedia.map((v) => v.remaining)

			this.self.setVariableValues(allValues)
			this.self.checkFeedbacks('media_playing', 'media_source_time_remaining')
		}
	}

	private processMediaStatusResponse(
		entry: SuccessfulBatchEntry<MediaStatusBatchSpec>,
		allValues: Record<string, string | number | boolean | string[] | undefined>,
		currentMedia: Array<{ name: string; elapsed: string; remaining: string }>,
	): void {
		const source = this.self.states.sources.get(entry.meta.sourceUuid)
		if (!source) return

		const sourceName = source.sourceName
		const validName = source.validName
		const responseData = entry.responseData

		const { mediaState } = responseData
		const mediaCursor = responseData.mediaCursor ?? 0
		const mediaDuration = responseData.mediaDuration ?? 0

		source.OBSMediaStatus = mediaState
		source.mediaCursor = mediaCursor
		source.mediaDuration = mediaDuration

		const remainingValue = mediaDuration - mediaCursor
		source.timeElapsed = utils.formatTimecode(mediaCursor)
		source.timeRemaining = remainingValue > 0 ? utils.formatTimecode(remainingValue) : '--:--:--'

		const isPlayingOrPaused = mediaState === OBSMediaStatus.Playing || mediaState === OBSMediaStatus.Paused
		if (isPlayingOrPaused && source.active) {
			currentMedia.push({
				name: sourceName,
				elapsed: source.timeElapsed,
				remaining: source.timeRemaining,
			})
		}

		// Reported as-is, matching the state this poll just stored: collapsing ended/buffering/error into
		// stopped here made the variable disagree with the MediaInputPlaybackEnded event's own write.
		allValues[`media_status_${validName}`] = utils.getOBSMediaStatusLabel(mediaState)
		allValues[`media_time_elapsed_${validName}`] = source.timeElapsed
		allValues[`media_time_remaining_${validName}`] = source.timeRemaining
	}

	public buildInputSettings(sourceUuid: string, inputKind: string, inputSettings: JsonObject): void {
		const source = this.self.states.sources.get(sourceUuid)
		if (!source) return

		// inputKindList holds the default settings object itself, keyed by kind.
		const defaultSettings = this.self.states.inputKindList.get(inputKind)
		const settings = defaultSettings ? { ...defaultSettings, ...inputSettings } : inputSettings
		source.settings = settings

		const name = source.validName

		if (isTextInputKind(inputKind)) {
			source.text = utils.readTextSourceValue(settings)
			this.self.setVariableValues({ [`current_text_${name}`]: source.text })
			return
		}

		if (isMediaInputKind(inputKind)) {
			// Sync media file name variable when settings change.
			this.self.setVariableValues({ [`media_file_name_${name}`]: utils.readMediaFileName(settings) })
			return
		}

		if (inputKind === INPUT_KIND_IMAGE_SOURCE) {
			source.imageFile = utils.extractFileName(settings.file)
			this.self.setVariableValues({ [`image_file_name_${name}`]: source.imageFile })
		}
	}

	public updateInputSettings(sourceUuid: string, inputSettings: JsonObject): void {
		const source = this.self.states.sources.get(sourceUuid)
		if (!source) return

		const mergedSettings: JsonObject = { ...source.settings, ...inputSettings }
		source.settings = mergedSettings
		this.buildInputSettings(sourceUuid, source.inputKind ?? '', mergedSettings)
	}

	public async getSourceFilters(sourceUuid: string): Promise<void> {
		const epoch = this.self.obsState.epoch
		const data = await this.sendRequest('GetSourceFilterList', { sourceUuid: sourceUuid })
		if (data && this.self.obsState.epoch === epoch) {
			this.setSourceFilters(sourceUuid, data.filters as unknown as OBSFilter[] | undefined)
		}
	}

	public updateAudioPeak(data: {
		inputs: Array<{ inputUuid: string; inputLevelsMul: Array<[number, number, number]> }>
	}): void {
		let changed = false
		data.inputs.forEach((input) => {
			const channel = input.inputLevelsMul[0]
			// Floor silent inputs to -100 so quiet sources reset correctly.
			let dbPeak = -100
			const channelPeak = channel?.[1]
			if (channelPeak && channelPeak > 0) {
				const computed = Math.round(20.0 * Math.log10(channelPeak))
				if (isFinite(computed)) dbPeak = computed
			}
			const source = this.self.states.sources.get(input.inputUuid)
			if (source) {
				if (source.peak !== dbPeak) changed = true
				source.peak = dbPeak
			}
		})
		// Re-evaluate level feedbacks only when changed, throttled to 10Hz.
		if (changed) this.meterFeedbackPending = true
		const now = Date.now()
		if (this.meterFeedbackPending && now - this.lastMeterFeedbackCheck >= OBSApi.METER_FEEDBACK_THROTTLE_MS) {
			this.lastMeterFeedbackCheck = now
			this.meterFeedbackPending = false
			this.self.checkFeedbacks('audioPeaking', 'audioMeter', 'audioPeakLevel')
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

	public async setAllSourcesVisibility(
		visible: string,
		options: { useCurrentScene: boolean; scene: string; except: string[] },
	): Promise<void> {
		const scene = this.resolveTargetScene(options.useCurrentScene, options.scene)
		if (!scene) return

		const items = this.self.obsState.getContainerItems(scene.sceneUuid)
		if (!items || items.length === 0) return

		const except = new Set(Array.isArray(options.except) ? options.except : [])
		const nonExcepted = items.filter((item) => !except.has(item.sourceName))
		const excepted = items.filter((item) => except.has(item.sourceName))

		const toInstances = (list: typeof items) =>
			list.map((item) => ({ containerUuid: scene.sceneUuid, sceneItemId: item.sceneItemId }))

		const requests = this.buildSourceVisibilityRequests(toInstances(nonExcepted), visible)
		if (visible !== 'toggle') {
			const oppositeVisible = visible === 'true' ? 'false' : 'true'
			requests.push(...this.buildSourceVisibilityRequests(toInstances(excepted), oppositeVisible))
		}

		if (requests.length > 0) {
			await this.sendBatch(requests)
		}
	}

	/** Resolves the scene an action targets: either the live program scene, or one named explicitly. */
	private resolveTargetScene(useCurrentScene: boolean, sceneName: string) {
		return useCurrentScene
			? this.self.states.scenes.get(this.self.states.programSceneUuid)
			: this.self.obsState.findSceneByName(sceneName)
	}

	private findSourceInstances(
		sourceUuid: string,
		options: { anyScene: boolean; useCurrentScene: boolean; scene: string },
	): { containerUuid: string; sceneItemId: number }[] {
		const toInstance = ({ containerUuid, item }: SceneItemMatch) => ({
			containerUuid,
			sceneItemId: item.sceneItemId,
		})

		if (options.anyScene) {
			return this.self.obsState.findSceneItemsAnywhere(sourceUuid).map(toInstance)
		}

		const scene = this.resolveTargetScene(options.useCurrentScene, options.scene)
		if (!scene) return []

		const match = this.self.obsState.findSceneItem(scene.sceneUuid, sourceUuid)
		return match ? [toInstance(match)] : []
	}

	private buildSourceVisibilityRequests(
		instances: { containerUuid: string; sceneItemId: number }[],
		visible: string,
	): OBSBatchRequest[] {
		return instances.map((instance) => {
			const item = this.self.states.sceneItems
				.get(instance.containerUuid)
				?.find((i) => i.sceneItemId === instance.sceneItemId)
			const enabled = utils.resolveVisibility(visible, item?.sceneItemEnabled)

			return {
				requestType: 'SetSceneItemEnabled',
				requestData: {
					// setSceneItemEnabled accepts group UUID in sceneUuid.
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
				const filter = filters.find((f) => f.filterName === filterName)
				if (!filter) return
				requests.push({
					requestType: 'SetSourceFilterEnabled',
					requestData: {
						sourceUuid,
						filterName,
						filterEnabled: utils.resolveVisibility(visible, filter.filterEnabled),
					},
				})
			})

			await this.sendBatch(requests)
		} else {
			const sourceUuid = this.self.obsState.findFilterTargetUuid(options.source)
			if (!sourceUuid) return

			const filter = this.self.states.sourceFilters.get(sourceUuid)?.find((f) => f.filterName === filterName)
			// Toggling a filter that isn't known would guess at its state, so do nothing instead.
			if (visible === 'toggle' && !filter) return

			await this.sendRequest('SetSourceFilterEnabled', {
				sourceUuid,
				filterName,
				filterEnabled: utils.resolveVisibility(visible, filter?.filterEnabled),
			})
		}
	}
}
