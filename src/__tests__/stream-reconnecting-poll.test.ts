import { describe, expect, test } from 'vitest'
import type { OBSResponseTypes } from 'obs-websocket-js'
import { getOutputFeedbacks } from '../feedbacks/outputs.js'
import { looseFeedbacks } from './loose-definitions.js'
import { MockContext } from './mock-context.js'
import { feedbackEvent } from './mock/events.js'
import { makeMockInstance } from './mock/instance.js'

function streamStatus(outputReconnecting: boolean, outputActive: boolean): OBSResponseTypes['GetStreamStatus'] {
	return {
		outputActive,
		outputReconnecting,
		outputTimecode: '00:01:00.000',
		outputDuration: 60000,
		outputCongestion: 0,
		outputBytes: 1000,
		outputSkippedFrames: 0,
		outputTotalFrames: 100,
	}
}

describe('stream reconnection status polling', () => {
	test('reports reconnection when attaching to an already reconnecting stream', async () => {
		const self = makeMockInstance()
		self.socket.call.mockResolvedValue(streamStatus(true, true))

		await self.obs.getStreamStatus()

		expect(self.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ streaming: 'Reconnecting' }))
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		expect(
			await feedbacks.streamReconnecting.callback(feedbackEvent('streamReconnecting', {}), new MockContext('feedback')),
		).toBe(true)
		expect(self.checkFeedbacks).toHaveBeenCalledWith('streamReconnecting')
	})

	test.each([
		{ active: true, label: 'Live' },
		{ active: false, label: 'Off-Air' },
	])('clears stale reconnection status when the stream is $label', async ({ active, label }) => {
		const self = makeMockInstance()
		self.states.streaming = true
		self.states.streamReconnecting = true
		self.socket.call.mockResolvedValue(streamStatus(false, active))

		await self.obs.getStreamStatus()

		expect(self.setVariableValues).toHaveBeenCalledWith(expect.objectContaining({ streaming: label }))
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		expect(
			await feedbacks.streamReconnecting.callback(feedbackEvent('streamReconnecting', {}), new MockContext('feedback')),
		).toBe(false)
		expect(self.checkFeedbacks).toHaveBeenCalledWith('streamReconnecting')
	})

	test('does not recheck feedbacks when a reconnecting status is unchanged', async () => {
		const self = makeMockInstance()
		self.socket.call.mockResolvedValue(streamStatus(true, true))
		await self.obs.getStreamStatus()
		self.checkFeedbacks.mockClear()

		await self.obs.getStreamStatus()

		expect(self.checkFeedbacks).not.toHaveBeenCalled()
	})

	test('preserves reconnection status if the request fails', async () => {
		const self = makeMockInstance()
		self.states.streaming = true
		self.states.streamReconnecting = true
		self.socket.call.mockRejectedValue(new Error('OBS disconnected'))

		await self.obs.getStreamStatus()

		expect(self.states.streamReconnecting).toBe(true)
		expect(self.setVariableValues).not.toHaveBeenCalled()
		expect(self.checkFeedbacks).not.toHaveBeenCalled()
	})
})
