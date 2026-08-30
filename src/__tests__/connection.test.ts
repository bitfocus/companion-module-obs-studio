import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { InstanceStatus } from '@companion-module/base'
import { EventSubscription } from 'obs-websocket-js'
import { POLL_INTERVALS } from '../constants.js'
import { makeMockInstance, type MockInstance } from './mock/instance.js'
import { getOutputFeedbacks } from '../feedbacks/outputs.js'
import { getAudioFeedbacks } from '../feedbacks/audio.js'
import { feedbackEvent } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks } from './loose-definitions.js'

/** The subscription mask `connectOBS` asks for when no meter feedback is on a button. */
const BASE_SUBSCRIPTIONS =
	EventSubscription.All | EventSubscription.InputActiveStateChanged | EventSubscription.InputShowStateChanged
const METER_SUBSCRIPTIONS = BASE_SUBSCRIPTIONS | EventSubscription.InputVolumeMeters

/**
 * Answers the requests `connectOBS` makes before it reports success. Only `GetVersion` has a shape
 * the module depends on; everything else tolerates an empty reply.
 */
function mockConnectSequence(self: MockInstance): void {
	self.socket.call.mockImplementation(async (requestType: string) => {
		if (requestType === 'GetVersion') {
			return {
				obsVersion: '30.0.0',
				obsWebSocketVersion: '5.3.0',
				platformDescription: 'test',
				supportedImageFormats: ['png', 'jpg'],
			}
		}
		if (requestType === 'GetStudioModeEnabled') return { studioModeEnabled: true }
		return {}
	})
}

describe('processWebSocketError', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
	})

	afterEach(() => {
		self.obs.stopReconnectionPoll()
		vi.useRealTimers()
	})

	test.each([
		['Server sent no subprotocol', [InstanceStatus.ConnectionFailure, 'Outdated OBS version'], false],
		['Socket is missing an `authentication` string', [InstanceStatus.BadConfig, 'Missing password'], false],
		['Authentication failed', [InstanceStatus.AuthenticationFailure], false],
		['connect ECONNREFUSED 127.0.0.1:4455', [InstanceStatus.ConnectionFailure], true],
		['something nobody anticipated', [InstanceStatus.UnknownError], true],
	])('maps %s onto its status', (message, expectedCall, shouldReconnect) => {
		self.obs.processWebSocketError(new Error(message))

		expect(self.updateStatus.mock.calls).toEqual([expectedCall])
		// Only the transient failures are worth retrying; a bad password never fixes itself.
		expect(self.reconnectionPoll !== undefined).toBe(shouldReconnect)
	})

	test('accepts a non-Error rejection', () => {
		self.obs.processWebSocketError('connect ECONNREFUSED 127.0.0.1:4455')

		expect(self.updateStatus.mock.calls).toEqual([[InstanceStatus.ConnectionFailure]])
	})

	test('stops a running poll once a terminal cause is known', () => {
		self.obs.startReconnectionPoll()

		self.obs.processWebSocketError(new Error('Authentication failed'))

		// The cause can only become knowable after the poll has started, so the status still has to be
		// reported and the retry loop stopped rather than left hammering OBS with a bad password.
		expect(self.updateStatus.mock.calls).toEqual([[InstanceStatus.AuthenticationFailure]])
		expect(self.reconnectionPoll).toBeUndefined()
	})

	test('keeps an existing poll while a transient failure repeats', () => {
		self.obs.startReconnectionPoll()
		const poll = self.reconnectionPoll

		self.obs.processWebSocketError(new Error('connect ECONNREFUSED 127.0.0.1:4455'))

		expect(self.updateStatus.mock.calls).toEqual([[InstanceStatus.ConnectionFailure]])
		expect(self.reconnectionPoll).toBe(poll)
	})

	test('a retry replaces the poll rather than stacking a second one', () => {
		self.obs.startReconnectionPoll()
		const poll = self.reconnectionPoll

		self.obs.startReconnectionPoll()

		expect(self.reconnectionPoll).not.toBe(poll)
	})
})

describe('connectOBS', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		mockConnectSequence(self)
	})

	afterEach(() => {
		self.obs.stopReconnectionPoll()
		self.obs.stopStatsPoll()
		self.obs.stopMediaPoll()
		vi.useRealTimers()
	})

	test('connects with the configured address, password and rpc version', async () => {
		self.config.scheme = 'wss'
		self.config.host = 'obs.local'
		self.config.port = 4460
		self.secrets.pass = 'hunter2'

		await self.obs.connectOBS()

		expect(self.socket.connect).toHaveBeenCalledWith('wss://obs.local:4460', 'hunter2', {
			eventSubscriptions: BASE_SUBSCRIPTIONS,
			rpcVersion: 1,
		})
	})

	test('defaults the scheme to ws', async () => {
		await self.obs.connectOBS()

		expect(self.socket.connect).toHaveBeenCalledWith('ws://127.0.0.1:4455', undefined, expect.anything())
	})

	test('reports Ok, starts the stats poll and registers listeners', async () => {
		await self.obs.connectOBS()

		expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok)
		expect(self.statsPoll).toBeDefined()
		expect(self.socket.listenerCount('CurrentProgramSceneChanged')).toBe(1)
	})

	test('clears a running reconnection poll once connected', async () => {
		self.obs.startReconnectionPoll()

		await self.obs.connectOBS()

		expect(self.reconnectionPoll).toBeUndefined()
	})

	test('subscribes to volume meters when a meter feedback is already on a button', async () => {
		// Base 2.1 has no subscribe hook — the feedback registers itself from its callback.
		const feedbacks = looseFeedbacks(getAudioFeedbacks(self))
		void feedbacks['audioPeaking'].callback(
			feedbackEvent('audioPeaking', { source: 'Mic', threshold: -60 }),
			new MockContext(),
		)

		await self.obs.connectOBS()

		expect(self.socket.connect).toHaveBeenCalledWith(expect.any(String), undefined, {
			eventSubscriptions: METER_SUBSCRIPTIONS,
			rpcVersion: 1,
		})
	})

	test('tears down the previous socket before reconnecting', async () => {
		await self.obs.connectOBS()
		await self.obs.connectOBS()

		// Listeners are removed first, so a reconnect leaves one handler per event, not two.
		expect(self.socket.listenerCount('CurrentProgramSceneChanged')).toBe(1)
		expect(self.socket.disconnect).toHaveBeenCalledTimes(2)
	})

	test('fails the connection when OBS capabilities cannot be read', async () => {
		self.socket.call.mockResolvedValue({})

		await self.obs.connectOBS()

		// `Ok` is reported as soon as the socket identifies, before capabilities are read, so a
		// connection that cannot initialise shows green briefly and then fails.
		expect(self.updateStatus.mock.calls).toEqual([[InstanceStatus.Ok], [InstanceStatus.UnknownError]])
		expect(self.statsPoll).toBeUndefined()
		expect(self.reconnectionPoll).toBeDefined()
	})

	test('survives a profile or scene-collection reply that omits its list', async () => {
		self.socket.call.mockImplementation(async (requestType: string) => {
			if (requestType === 'GetVersion') {
				return {
					obsVersion: '30.0.0',
					obsWebSocketVersion: '5.3.0',
					platformDescription: 'test',
					supportedImageFormats: ['png'],
				}
			}
			// OBS answered, but without the array the module walks.
			if (requestType === 'GetProfileList') return { currentProfileName: 'Streaming' }
			if (requestType === 'GetSceneCollectionList') return { currentSceneCollectionName: 'Untitled' }
			return {}
		})

		await self.obs.connectOBS()

		expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Ok)
		expect(self.updateStatus).not.toHaveBeenCalledWith(InstanceStatus.UnknownError)
		expect(self.states.currentProfile).toBe('Streaming')
		expect(self.states.profiles.size).toBe(0)
		expect(self.statsPoll).toBeDefined()
	})

	test('routes a refused connection through the error mapping', async () => {
		self.socket.connect.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4455'))

		await self.obs.connectOBS()

		expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.ConnectionFailure)
		expect(self.reconnectionPoll).toBeDefined()
	})

	test('skips a second attempt while one is still in flight', async () => {
		let release: (value: unknown) => void = () => {}
		self.socket.connect.mockImplementation(async () => new Promise((resolve) => (release = resolve)))

		const first = self.obs.connectOBS()
		await self.obs.connectOBS()

		expect(self.socket.connect).toHaveBeenCalledTimes(1)

		release({ obsWebSocketVersion: '5.3.0' })
		await first
	})

	test('clears the in-flight guard after a failed attempt', async () => {
		self.socket.connect.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:4455'))
		await self.obs.connectOBS()

		self.socket.connect.mockResolvedValue({ obsWebSocketVersion: '5.3.0' })
		await self.obs.connectOBS()

		expect(self.socket.connect).toHaveBeenCalledTimes(2)
	})
})

describe('disconnectOBS', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		mockConnectSequence(self)
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	test('stops every poll and detaches from the socket', async () => {
		await self.obs.connectOBS()
		self.obs.startReconnectionPoll()
		self.obs.startMediaPoll()
		expect(self.statsPoll).toBeDefined()

		await self.obs.disconnectOBS()

		expect(self.reconnectionPoll).toBeUndefined()
		expect(self.statsPoll).toBeUndefined()
		expect(self.mediaPoll).toBeUndefined()
		// Listeners must go before the socket does, or a reconnect double-registers them.
		expect(self.socket.listenerCount('CurrentProgramSceneChanged')).toBe(0)
		expect(self.socket.disconnect).toHaveBeenCalled()
	})
})

describe('connectionLost', () => {
	let self: MockInstance

	beforeEach(() => {
		vi.useFakeTimers()
		self = makeMockInstance()
		mockConnectSequence(self)
	})

	afterEach(() => {
		self.obs.stopReconnectionPoll()
		vi.useRealTimers()
	})

	test('reports Disconnected, tears down and starts retrying', async () => {
		await self.obs.connectOBS()
		self.updateStatus.mockClear()

		await self.obs.connectionLost()

		expect(self.updateStatus).toHaveBeenCalledWith(InstanceStatus.Disconnected)
		expect(self.statsPoll).toBeUndefined()
		expect(self.reconnectionPoll).toBeDefined()
	})

	test('is a no-op while already retrying', async () => {
		self.obs.startReconnectionPoll()
		const poll = self.reconnectionPoll

		await self.obs.connectionLost()

		expect(self.updateStatus).not.toHaveBeenCalled()
		expect(self.reconnectionPoll).toBe(poll)
	})

	test('the reconnection poll retries the connection on each tick', async () => {
		self.socket.connect.mockRejectedValue(new Error('connect ECONNREFUSED 127.0.0.1:4455'))
		await self.obs.connectOBS()
		expect(self.reconnectionPoll).toBeDefined()

		self.socket.connect.mockClear()
		await vi.advanceTimersByTimeAsync(POLL_INTERVALS.RECONNECTION)

		expect(self.socket.connect).toHaveBeenCalled()
	})
})

describe('volume meter subscription', () => {
	let self: MockInstance

	beforeEach(async () => {
		vi.useFakeTimers()
		self = makeMockInstance()
		mockConnectSequence(self)
		await self.obs.connectOBS()
		self.socket.reidentify.mockClear()
	})

	afterEach(() => {
		self.obs.stopStatsPoll()
		self.obs.stopMediaPoll()
		vi.useRealTimers()
	})

	test('the first subscriber turns meters on and later ones do not re-identify', () => {
		self.obs.addMeterSubscriber('feedback-1')

		expect(self.socket.reidentify).toHaveBeenCalledWith({ eventSubscriptions: METER_SUBSCRIPTIONS })

		self.socket.reidentify.mockClear()
		self.obs.addMeterSubscriber('feedback-2')

		// Re-identifying per button would restart the event stream every time a page loads.
		expect(self.socket.reidentify).not.toHaveBeenCalled()
	})

	test('meters stay on until the last subscriber goes away', () => {
		self.obs.addMeterSubscriber('feedback-1')
		self.obs.addMeterSubscriber('feedback-2')
		self.socket.reidentify.mockClear()

		self.obs.removeMeterSubscriber('feedback-1')
		expect(self.socket.reidentify).not.toHaveBeenCalled()

		self.obs.removeMeterSubscriber('feedback-2')
		expect(self.socket.reidentify).toHaveBeenCalledWith({ eventSubscriptions: BASE_SUBSCRIPTIONS })
	})

	test('a reidentify failure is swallowed', async () => {
		self.socket.reidentify.mockRejectedValue(new Error('not connected'))

		expect(() => self.obs.addMeterSubscriber('feedback-1')).not.toThrow()
		await vi.advanceTimersByTimeAsync(0)
	})
})

describe('output status subscription', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		self.states.outputs.set('adv_stream', { outputName: 'adv_stream', outputActive: false })
	})

	test('subscribing does not re-identify — output status is polled, not evented', () => {
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		void feedbacks['output_active'].callback(
			feedbackEvent('output_active', { output: 'adv_stream' }),
			new MockContext(),
		)

		expect(self.socket.reidentify).not.toHaveBeenCalled()
	})
})
