import { beforeEach, describe, expect, test } from 'vitest'
import { getFeedbacks } from '../feedbacks.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { defaultOptions, feedbackEvent } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseFeedbacks, type LooseFeedbacks } from './loose-definitions.js'

/** Built once at collection time, since `test.each` needs the ids before `beforeEach` runs. */
const FEEDBACK_IDS = (() => {
	const self = makeMockInstance()
	seedFullState(self)
	return Object.keys(looseFeedbacks(getFeedbacks.call(self)))
})()

describe('feedbacks', () => {
	let self: MockInstance
	let feedbacks: LooseFeedbacks

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		feedbacks = looseFeedbacks(getFeedbacks.call(self))
	})

	test('produces a non-empty feedback set', () => {
		expect(FEEDBACK_IDS.length).toBeGreaterThan(0)
	})

	// `CompanionFeedbackDefinitions<OBSFeedbackSchemas>` statically enforces the rest of the shape,
	// including `defaultStyle` being required on boolean feedbacks.
	test('every feedback has a non-empty name', () => {
		const unnamed = FEEDBACK_IDS.filter((id) => feedbacks[id].name.length === 0)
		expect(unnamed).toEqual([])
	})

	describe('every feedback callback runs without throwing and returns a valid shape', () => {
		test.each(FEEDBACK_IDS)('%s', async (id) => {
			const def = feedbacks[id]
			const result = await Promise.resolve(def.callback(feedbackEvent(id, defaultOptions(def)), new MockContext()))
			const expectedType = def.type === 'boolean' ? 'boolean' : def.type === 'value' ? 'number' : 'object'
			expect(typeof result).toBe(expectedType)
		})
	})
})
