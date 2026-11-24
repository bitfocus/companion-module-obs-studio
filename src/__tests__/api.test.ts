import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'

describe('OBSApi.getStreamStatus bitrate', () => {
	let self: MockInstance
	let sampleTime: number

	beforeEach(() => {
		self = makeMockInstance()
		sampleTime = 0
		vi.spyOn(performance, 'now').mockImplementation(() => sampleTime)
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	async function sample(outputBytes: number, time: number, outputActive: boolean): Promise<void> {
		sampleTime = time
		self.socket.call.mockResolvedValue({
			outputActive,
			outputReconnecting: false,
			outputBytes,
			outputTimecode: '01:00:00.000',
			outputDuration: 3600000,
			outputCongestion: 0,
			outputSkippedFrames: 0,
			outputTotalFrames: 108000,
		})
		await self.obs.getStreamStatus()
	}

	function bitrate(): unknown {
		return self.setVariableValues.mock.lastCall?.[0].kbits_per_sec
	}

	test('does not report lifetime output bytes as the first bitrate sample', async () => {
		await sample(1000000000, 1000, true)

		expect(bitrate()).toBe(0)
	})

	test.each([
		[500, 375000],
		[1000, 750000],
		[2000, 1500000],
	])('reports 6000 kbps over a %i ms sample interval', async (interval, bytes) => {
		await sample(1000000000, 1000, true)
		await sample(1000000000 + bytes, 1000 + interval, true)

		expect(bitrate()).toBe(6000)
	})

	test('keeps the full sampling interval across a failed status request', async () => {
		await sample(1000000000, 1000, true)
		sampleTime = 2000
		self.socket.call.mockRejectedValueOnce(new Error('status request failed'))
		await self.obs.getStreamStatus()
		expect(self.setVariableValues).toHaveBeenCalledTimes(1)

		await sample(1002250000, 4000, true)

		expect(bitrate()).toBe(6000)
	})

	test('starts a new baseline when the output byte counter resets', async () => {
		await sample(1000000000, 1000, true)
		await sample(500, 2000, true)
		expect(bitrate()).toBe(0)

		await sample(750500, 3000, true)

		expect(bitrate()).toBe(6000)
	})

	test('starts a new baseline when connection state is initialized again', async () => {
		await sample(1000000000, 1000, true)
		await sample(1000750000, 2000, true)
		expect(bitrate()).toBe(6000)

		self.obs.initializeStates()
		await sample(2000000000, 10000, true)
		expect(bitrate()).toBe(0)

		await sample(2000750000, 11000, true)
		expect(bitrate()).toBe(6000)
	})

	test('reports zero while inactive and discards the sampling interval across a stop', async () => {
		await sample(1000000000, 1000, true)
		await sample(1000900000, 2500, false)
		expect(bitrate()).toBe(0)

		await sample(2000000, 10000, true)
		expect(bitrate()).toBe(0)
		await sample(2750000, 11000, true)
		expect(bitrate()).toBe(6000)
	})

	test('reports zero when two samples have no elapsed time', async () => {
		await sample(1000000000, 1000, true)
		await sample(1000750000, 1000, true)

		expect(bitrate()).toBe(0)
	})
})

describe('OBSApi.buildProfileList', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('populates profile state from the GetProfileList response', async () => {
		self.socket.call.mockResolvedValue({
			currentProfileName: 'Streaming',
			profiles: ['Streaming', 'Recording'],
		})

		await self.obs.buildProfileList()

		expect(self.socket.call).toHaveBeenCalledWith('GetProfileList', undefined)
		expect(self.states.currentProfile).toBe('Streaming')
		expect([...self.states.profiles.keys()]).toEqual(['Streaming', 'Recording'])
		expect(self.checkFeedbacks).toHaveBeenCalledWith('profile_active')
		expect(self.setVariableValues).toHaveBeenCalledWith({ profile: 'Streaming' })
	})

	test('falls back to "None" when the request fails', async () => {
		self.socket.call.mockRejectedValue(new Error('not connected'))

		await self.obs.buildProfileList()

		expect(self.states.currentProfile).toBe('None')
		expect(self.states.profiles.size).toBe(0)
	})
})

describe('OBSApi.reconcileMediaPoll', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
	})

	afterEach(() => {
		self.obs.stopMediaPoll()
		vi.useRealTimers()
	})

	test('starts the poll when the collection contains a media source', () => {
		seedFullState(self)
		expect(self.mediaPoll).toBeUndefined()

		self.obs.reconcileMediaPoll()

		expect(self.mediaPoll).toBeDefined()
	})

	test('starts the poll once a source first seen without a kind turns out to be media', () => {
		self.obs.addSource('Clip', 'Clip')
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeUndefined()

		self.obs.addSource('Clip', 'Clip', 'ffmpeg_source')
		self.obs.reconcileMediaPoll()

		expect(self.obsState.mediaSourceUuids).toEqual(['Clip'])
		expect(self.mediaPoll).toBeDefined()
	})

	test('does not start the poll for a collection with no media sources', () => {
		self.obs.addSource('Mic', 'Mic', 'wasapi_input_capture')

		self.obs.reconcileMediaPoll()

		expect(self.mediaPoll).toBeUndefined()
	})

	test('stops the poll when the last media source is removed', () => {
		seedFullState(self)
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeDefined()

		self.states.sources.delete('Clip')
		self.obsState.invalidateSourceNameIndex()
		self.obs.reconcileMediaPoll()

		expect(self.mediaPoll).toBeUndefined()
	})

	test('leaves a running poll alone when media sources remain', () => {
		seedFullState(self)
		self.obs.reconcileMediaPoll()
		const handle = self.mediaPoll

		self.obs.reconcileMediaPoll()

		// Restarting would reset the interval and drop a tick.
		expect(self.mediaPoll).toBe(handle)
	})

	test('restarts the poll after a scene collection reload clears state', () => {
		seedFullState(self)
		self.obs.reconcileMediaPoll()
		expect(self.mediaPoll).toBeDefined()

		// What CurrentSceneCollectionChanging does.
		self.obs.stopMediaPoll()
		self.obsState.resetSceneSourceStates()
		expect(self.mediaPoll).toBeUndefined()

		// The incoming collection also has a media source.
		self.obs.addSource('Clip 2', 'Clip 2', 'vlc_source')
		self.obs.reconcileMediaPoll()

		expect(self.mediaPoll).toBeDefined()
	})
})

describe('OBSApi.updateAudioPeak', () => {
	let self: MockInstance

	const meter = (inputLevelsMul: Array<[number, number, number]>): number | undefined => {
		self.obs.updateAudioPeak({ inputs: [{ inputUuid: 'Mic', inputLevelsMul }] })
		return self.states.sources.get('Mic')!.peak
	}

	beforeEach(() => {
		self = makeMockInstance()
		self.obs.addSource('Mic', 'Mic', 'wasapi_input_capture')
	})

	test('reads a stereo source with signal only on the right channel', () => {
		expect(
			meter([
				[0, 0, 0],
				[0.5, 1, 1],
			]),
		).toBe(0)
	})

	test('reads the loudest channel of a multichannel source', () => {
		expect(
			meter([
				[0, 0.1, 0.1],
				[0, 0, 0],
				[0, 0, 0],
				[0.4, 0.5, 0.5],
			]),
		).toBe(-6)
	})

	test('floors a silent source to -100', () => {
		expect(
			meter([
				[0, 0, 0],
				[0, 0, 0],
			]),
		).toBe(-100)
	})

	test('floors a source reporting no channels to -100', () => {
		expect(meter([])).toBe(-100)
	})
})
