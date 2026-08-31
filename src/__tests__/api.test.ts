import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'

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
