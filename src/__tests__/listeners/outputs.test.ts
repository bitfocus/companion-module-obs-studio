import { beforeEach, describe, expect, test } from 'vitest'
import { initOBSListeners } from '../../listeners.js'
import { OBSRecordingState } from '../../types.js'
import { makeMockInstance, type MockInstance } from '../mock/instance.js'

describe('RecordStateChanged recorder mapping', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		initOBSListeners(self)
	})

	const emit = (outputActive: boolean, outputState: string, outputPath?: string) =>
		self.socket.emit('RecordStateChanged', { outputActive, outputState, outputPath })

	test('records a start', () => {
		emit(true, 'OBS_WEBSOCKET_OUTPUT_STARTED')

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'recording', options: { action: 'start' } })
	})

	test('records a resume rather than a start when coming out of pause', () => {
		self.states.recording = OBSRecordingState.Paused

		emit(true, 'OBS_WEBSOCKET_OUTPUT_RESUMED')

		expect(self.states.recording).toBe(OBSRecordingState.Recording)
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'recording', options: { action: 'resume' } })
		expect(self.sendToActionRecorder).not.toHaveBeenCalledWith({ actionId: 'recording', options: { action: 'start' } })
	})

	test('records a pause', () => {
		emit(false, 'OBS_WEBSOCKET_OUTPUT_PAUSED')

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'recording', options: { action: 'pause' } })
	})

	test('records a stop', () => {
		emit(false, 'OBS_WEBSOCKET_OUTPUT_STOPPED')

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'recording', options: { action: 'stop' } })
	})

	test('publishes the file name from the output path, extension stripped', () => {
		emit(false, 'OBS_WEBSOCKET_OUTPUT_STOPPED', '/Users/test/Movies/2026-08-24 15-00-00.mkv')

		expect(self.setVariableValues).toHaveBeenCalledWith({ recording_file_name: '2026-08-24 15-00-00' })
	})

	test('resets the timecode variables, since the event carries none', () => {
		emit(false, 'OBS_WEBSOCKET_OUTPUT_STOPPED')

		expect(self.setVariableValues).toHaveBeenCalledWith({
			recording: 'Stopped',
			recording_timecode: '00:00:00',
			recording_timecode_hh: '00',
			recording_timecode_mm: '00',
			recording_timecode_ss: '00',
		})
	})

	test('leaves the timecode variables alone when recording merely pauses', () => {
		emit(false, 'OBS_WEBSOCKET_OUTPUT_PAUSED')

		// Clearing here would blank the elapsed time on every pause.
		for (const [values] of self.setVariableValues.mock.calls) {
			expect(values).not.toHaveProperty('recording_timecode')
		}
	})
})

describe('StreamStateChanged recorder mapping', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		initOBSListeners(self)
	})

	test('records a start and a stop', () => {
		self.socket.emit('StreamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'streaming', options: { action: 'start' } })

		self.socket.emit('StreamStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' })
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({ actionId: 'streaming', options: { action: 'stop' } })
	})

	test.each(['OBS_WEBSOCKET_OUTPUT_RECONNECTING', 'OBS_WEBSOCKET_OUTPUT_RECONNECTED'])(
		'does not record %s as a user action',
		(outputState) => {
			// A dropped connection recovering on its own is not something the user did.
			self.socket.emit('StreamStateChanged', { outputActive: true, outputState })

			expect(self.sendToActionRecorder).not.toHaveBeenCalled()
		},
	)

	test('clears the stream timecode variables when the stream stops', () => {
		self.socket.emit('StreamStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' })

		expect(self.setVariableValues).toHaveBeenCalledWith({
			stream_timecode: '00:00:00',
			stream_timecode_hh: '00',
			stream_timecode_mm: '00',
			stream_timecode_ss: '00',
		})
	})
})

describe('replay buffer and virtual camera listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		initOBSListeners(self)
	})

	test('ReplayBufferStateChanged records a start', () => {
		self.socket.emit('ReplayBufferStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'replay_buffer',
			options: { action: 'start' },
		})
	})

	test('ReplayBufferSaved publishes the saved path', () => {
		self.socket.emit('ReplayBufferSaved', { savedReplayPath: '/tmp/replay.mkv' })

		expect(self.setVariableValues).toHaveBeenCalledWith({ replay_buffer_path: '/tmp/replay.mkv' })
	})

	test('VirtualcamStateChanged records against the virtualcam output', () => {
		self.states.outputs.set('virtualcam_output', { outputName: 'virtualcam_output', outputActive: false })

		self.socket.emit('VirtualcamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })

		expect(self.checkFeedbacks).toHaveBeenCalledWith('output_active')
		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'output',
			options: { action: 'start', output: 'virtualcam_output' },
		})
	})

	test('VirtualcamStateChanged still publishes the variable before the output list is known', () => {
		self.socket.emit('VirtualcamStateChanged', { outputActive: true, outputState: 'OBS_WEBSOCKET_OUTPUT_STARTED' })

		expect(self.setVariableValues).toHaveBeenCalledWith({ virtualcam_active: true })
	})

	test('RecordFileChanged publishes the new file name', () => {
		self.socket.emit('RecordFileChanged', { newOutputPath: 'C:\\Videos\\take-2.mkv' })

		expect(self.setVariableValues).toHaveBeenCalledWith({ recording_file_name: 'take-2' })
	})
})
