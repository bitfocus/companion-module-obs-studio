import { beforeEach, describe, expect, test, vi } from 'vitest'
import { initOBSListeners } from '../../listeners.js'
import { OBSMediaInputAction, OBSMediaStatus } from '../../types.js'
import { makeMockInstance, seedSource, type MockInstance } from '../mock/instance.js'

describe('media listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.isRecordingActions = true
		seedSource(self, 'My Clip', 'clip-uuid', 'ffmpeg_source')
		initOBSListeners(self)
	})

	test('MediaInputPlaybackStarted marks the source playing and stamps when it started', () => {
		self.socket.emit('MediaInputPlaybackStarted', { inputName: 'My Clip', inputUuid: 'clip-uuid' })

		const source = self.states.sources.get('clip-uuid')!
		expect(source.OBSMediaStatus).toBe(OBSMediaStatus.Playing)
		// Orders the "newest" media target, so it has to be set whenever playback begins.
		expect(source.mediaStartedAt).toBeGreaterThan(0)
		expect(self.setVariableValues).toHaveBeenCalledWith({ media_status_My_Clip: 'Playing' })
	})

	test('MediaInputPlaybackEnded marks the source ended and drops its start time', () => {
		self.socket.emit('MediaInputPlaybackStarted', { inputName: 'My Clip', inputUuid: 'clip-uuid' })
		self.socket.emit('MediaInputPlaybackEnded', { inputName: 'My Clip', inputUuid: 'clip-uuid' })

		expect(self.states.sources.get('clip-uuid')!.OBSMediaStatus).toBe(OBSMediaStatus.Ended)
		expect(self.states.sources.get('clip-uuid')!.mediaStartedAt).toBeUndefined()
		expect(self.setVariableValues).toHaveBeenCalledWith({ media_status_My_Clip: 'Ended' })
	})

	test('a playback event for an unknown input is ignored', () => {
		self.socket.emit('MediaInputPlaybackStarted', { inputName: 'Ghost', inputUuid: 'ghost' })

		expect(self.setVariableValues).not.toHaveBeenCalled()
	})

	test.each([
		[OBSMediaInputAction.Pause, OBSMediaStatus.Paused],
		[OBSMediaInputAction.Play, OBSMediaStatus.Playing],
	])('MediaInputActionTriggered %s sets the status', (mediaAction, expected) => {
		self.socket.emit('MediaInputActionTriggered', { inputName: 'My Clip', inputUuid: 'clip-uuid', mediaAction })

		expect(self.states.sources.get('clip-uuid')!.OBSMediaStatus).toBe(expected)
	})

	test.each([
		[OBSMediaInputAction.Play, 'play'],
		[OBSMediaInputAction.Pause, 'pause'],
		[OBSMediaInputAction.Stop, 'stop'],
		[OBSMediaInputAction.Restart, 'restart'],
		[OBSMediaInputAction.Next, 'next'],
		[OBSMediaInputAction.Previous, 'previous'],
	])('MediaInputActionTriggered %s records the matching media_control choice', (mediaAction, action) => {
		self.socket.emit('MediaInputActionTriggered', { inputName: 'My Clip', inputUuid: 'clip-uuid', mediaAction })

		expect(self.sendToActionRecorder).toHaveBeenCalledWith({
			actionId: 'media_control',
			options: { source: 'My Clip', target: 'source', action },
		})
	})

	test('the None action maps onto no recorded action', () => {
		self.socket.emit('MediaInputActionTriggered', {
			inputName: 'My Clip',
			inputUuid: 'clip-uuid',
			mediaAction: OBSMediaInputAction.None,
		})

		expect(self.sendToActionRecorder).not.toHaveBeenCalled()
	})
})

describe('config listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('CurrentSceneCollectionChanged clears the changing flag and rebuilds the collection', () => {
		self.states.sceneCollectionChanging = true

		self.socket.emit('CurrentSceneCollectionChanged', { sceneCollectionName: 'Show B' })

		expect(self.states.currentSceneCollection).toBe('Show B')
		expect(self.states.sceneCollectionChanging).toBe(false)
		expect(self.setVariableValues).toHaveBeenCalledWith({ scene_collection: 'Show B' })
		// A new collection means new scenes, new transitions and new profile-scoped settings.
		const requests = self.socket.call.mock.calls.map((call: unknown[]) => call[0])
		expect(requests).toContain('GetSceneList')
		expect(requests).toContain('GetSceneTransitionList')
		expect(requests).toContain('GetVideoSettings')
	})

	test('CurrentProfileChanged refreshes profile-scoped settings only', () => {
		self.socket.emit('CurrentProfileChanged', { profileName: 'Streaming' })

		expect(self.states.currentProfile).toBe('Streaming')
		expect(self.setVariableValues).toHaveBeenCalledWith({ profile: 'Streaming' })
		const requests = self.socket.call.mock.calls.map((call: unknown[]) => call[0])
		expect(requests).toContain('GetRecordDirectory')
		// The scene collection is unchanged, so the scene list must not be refetched.
		expect(requests).not.toContain('GetSceneList')
	})

	test('ProfileListChanged and SceneCollectionListChanged refetch their lists', () => {
		self.socket.emit('ProfileListChanged', { profiles: ['A', 'B'] })
		self.socket.emit('SceneCollectionListChanged', { sceneCollections: ['X'] })

		const requests = self.socket.call.mock.calls.map((call: unknown[]) => call[0])
		expect(requests).toContain('GetProfileList')
		expect(requests).toContain('GetSceneCollectionList')
	})
})

describe('connection and vendor listeners', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		initOBSListeners(self)
	})

	test('ConnectionClosed starts the reconnection poll', async () => {
		self.socket.emit('ConnectionClosed', new Error('closed'))
		await vi.advanceTimersByTimeAsync(0)

		expect(self.reconnectionPoll).toBeDefined()
		self.obs.stopReconnectionPoll()
		vi.useRealTimers()
	})

	test('VendorEvent publishes the name, type and serialized payload', () => {
		vi.useRealTimers()
		self.socket.emit('VendorEvent', {
			vendorName: 'AdvancedSceneSwitcher',
			eventType: 'macro',
			eventData: { name: 'Go' },
		})

		expect(self.setVariableValues).toHaveBeenCalledWith({
			vendor_event_name: 'AdvancedSceneSwitcher',
			vendor_event_type: 'macro',
			vendor_event_data: '{"name":"Go"}',
		})
		expect(self.checkFeedbacks).toHaveBeenCalledWith('vendorEvent')
	})

	test('a payload that cannot be serialized still publishes the name and type', () => {
		vi.useRealTimers()
		const circular: Record<string, unknown> = {}
		circular.self = circular

		self.socket.emit('VendorEvent', { vendorName: 'v', eventType: 't', eventData: circular })

		expect(self.setVariableValues).toHaveBeenCalledWith({
			vendor_event_name: 'v',
			vendor_event_type: 't',
			vendor_event_data: '',
		})
	})
})
