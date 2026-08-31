import { describe, expect, test } from 'vitest'
import { getActions } from '../actions.js'
import { getFeedbacks } from '../feedbacks.js'
import { makeMockInstance, seedFullState } from './mock/instance.js'
import { looseActions, looseFeedbacks } from './loose-definitions.js'

/**
 * A structural snapshot of every option field on every action and feedback.
 *
 * This exists to make refactors of the option layer provably inert: converting hand-written dropdown
 * literals to a shared builder must not move a single default, choice or visibility expression, and
 * the snapshot is what says so. It is deliberately dumb — it asserts nothing about what the values
 * *should* be, only that they do not change without someone intending it.
 *
 * Functions are recorded as a marker rather than serialized, so an unrelated edit to a callback body
 * does not churn the snapshot.
 */
function describeValue(value: unknown): unknown {
	if (typeof value === 'function') return '[function]'
	if (Array.isArray(value)) return value.map(describeValue)
	if (value && typeof value === 'object') {
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([key, entry]) => [key, describeValue(entry)]),
		)
	}
	return value
}

function optionShape(definitions: Record<string, { options?: unknown[] }>): Record<string, unknown> {
	return Object.fromEntries(
		Object.keys(definitions)
			.sort()
			.map((id) => [id, describeValue(definitions[id].options ?? [])]),
	)
}

describe('option shape', () => {
	const self = makeMockInstance()
	seedFullState(self)
	const actions = looseActions(getActions.call(self))
	const feedbacks = looseFeedbacks(getFeedbacks.call(self))

	test('action options are unchanged', () => {
		expect(optionShape(actions)).toMatchSnapshot()
	})

	test('feedback options are unchanged', () => {
		expect(optionShape(feedbacks)).toMatchSnapshot()
	})
})
