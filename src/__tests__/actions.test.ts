import { beforeEach, describe, expect, test } from 'vitest'
import { getActions } from '../actions.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { actionEvent, defaultOptions } from './mock/events.js'
import { MockContext } from './mock-context.js'
import { looseActions, type LooseActions } from './loose-definitions.js'

/**
 * The id lists drive `test.each`, so they have to exist at collection time — before any `beforeEach`
 * has run. Built once here rather than per `test.each` call.
 */
const SEEDED_ACTIONS = (() => {
	const self = makeMockInstance()
	seedFullState(self)
	return looseActions(getActions.call(self))
})()
const ACTION_IDS = Object.keys(SEEDED_ACTIONS)
const LEARN_ACTION_IDS = ACTION_IDS.filter((id) => SEEDED_ACTIONS[id].learn !== undefined)

describe('actions', () => {
	let self: MockInstance
	let actions: LooseActions

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = looseActions(getActions.call(self))
	})

	test('produces a non-empty action set', () => {
		expect(ACTION_IDS.length).toBeGreaterThan(0)
	})

	// The rest of the definition shape (option array, callback, optional learn) is enforced statically
	// by `CompanionActionDefinitions<OBSActionSchemas>`, so only the non-empty name needs asserting.
	test('every action has a non-empty name', () => {
		const unnamed = ACTION_IDS.filter((id) => actions[id].name.length === 0)
		expect(unnamed).toEqual([])
	})

	describe('every action callback runs without throwing', () => {
		test.each(ACTION_IDS)('%s', async (id) => {
			const def = actions[id]
			await expect(
				Promise.resolve(def.callback(actionEvent(id, defaultOptions(def)), new MockContext())),
			).resolves.not.toThrow()
		})
	})

	describe('every learn callback runs without throwing', () => {
		test.each(LEARN_ACTION_IDS)('%s', async (id) => {
			const def = actions[id]
			await expect(
				Promise.resolve(def.learn!(actionEvent(id, defaultOptions(def)), new MockContext())),
			).resolves.not.toThrow()
		})
	})
})
