import { beforeEach, describe, expect, test } from 'vitest'
import { getOutputFeedbacks } from '../../feedbacks/outputs.js'
import { makeMockInstance, type MockInstance } from '../mock/instance.js'
import { feedbackEvent } from '../mock/events.js'
import { MockContext } from '../mock-context.js'
import { looseFeedbacks } from '../loose-definitions.js'

describe('streamCongestionLevel', () => {
	let self: MockInstance

	const check = (): unknown => {
		const feedbacks = looseFeedbacks(getOutputFeedbacks(self))
		return feedbacks['streamCongestionLevel'].callback(feedbackEvent('streamCongestionLevel', {}), new MockContext())
	}

	beforeEach(() => {
		self = makeMockInstance()
	})

	test('is 0 when not streaming, whatever the last reported congestion was', () => {
		self.states.streaming = false
		self.states.streamCongestion = 0.9
		expect(check()).toBe(0)
	})

	test('reports congestion as a percentage while streaming', () => {
		self.states.streaming = true
		self.states.streamCongestion = 0.42
		expect(check()).toBe(42)
	})

	test('is 100 at full congestion', () => {
		self.states.streaming = true
		self.states.streamCongestion = 1
		expect(check()).toBe(100)
	})
})
