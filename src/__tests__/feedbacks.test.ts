import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionFeedbackDefinition, CompanionFeedbackInfo, CompanionOptionValues } from '@companion-module/base'
import { getFeedbacks } from '../feedbacks.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { MockContext } from './mock-context.js'

function defaultOptions(def: CompanionFeedbackDefinition): CompanionOptionValues {
	const options: CompanionOptionValues = {}
	for (const option of def.options) {
		if ('id' in option && 'default' in option) {
			options[option.id] = option.default
		}
	}
	return options
}

function feedbackInfo(feedbackId: string, options: CompanionOptionValues): CompanionFeedbackInfo {
	return { id: 'test', controlId: 'control', feedbackId, options } as unknown as CompanionFeedbackInfo
}

function makeMockInstanceSeeded(): MockInstance {
	const self = makeMockInstance()
	seedFullState(self)
	return self
}

describe('feedbacks', () => {
	let self: MockInstance
	let feedbacks: ReturnType<typeof getFeedbacks>

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		feedbacks = getFeedbacks.call(self)
	})

	test('produces a non-empty feedback set', () => {
		expect(Object.keys(feedbacks).length).toBeGreaterThan(0)
	})

	describe('every feedback definition is well-formed', () => {
		test.each(Object.keys(getFeedbacks.call(makeMockInstanceSeeded())))('%s', (id) => {
			const def = feedbacks[id]!
			expect(def).toBeDefined()
			expect(['boolean', 'advanced']).toContain(def.type)
			expect(typeof def.name).toBe('string')
			expect(def.name.length).toBeGreaterThan(0)
			expect(Array.isArray(def.options)).toBe(true)
			expect(typeof def.callback).toBe('function')
			// Boolean feedbacks must declare a default style
			expect(def.type !== 'boolean' || def.defaultStyle !== undefined).toBe(true)
		})
	})

	describe('every feedback callback runs without throwing and returns a valid shape', () => {
		test.each(Object.keys(getFeedbacks.call(makeMockInstanceSeeded())))('%s', async (id) => {
			const def = feedbacks[id]!
			const result = await Promise.resolve(def.callback(feedbackInfo(id, defaultOptions(def)), new MockContext()))
			const expectedType = def.type === 'boolean' ? 'boolean' : 'object'
			expect(typeof result).toBe(expectedType)
		})
	})
})
