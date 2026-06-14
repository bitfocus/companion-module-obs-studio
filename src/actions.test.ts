import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionActionDefinition, CompanionActionEvent, CompanionOptionValues } from '@companion-module/base'
import { getActions } from './actions.js'
import { makeMockInstance, seedFullState, type MockInstance } from './__tests__/mock/instance.js'
import { MockContext } from './__tests__/mock-context.js'

/** Build an options object from each option's declared default. */
function defaultOptions(def: CompanionActionDefinition): CompanionOptionValues {
	const options: CompanionOptionValues = {}
	for (const option of def.options) {
		if ('id' in option && 'default' in option) {
			options[option.id] = option.default
		}
	}
	return options
}

function event(actionId: string, options: CompanionOptionValues): CompanionActionEvent {
	return { id: 'test', controlId: 'control', actionId, options } as unknown as CompanionActionEvent
}

describe('actions', () => {
	let self: MockInstance
	let actions: ReturnType<typeof getActions>

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		actions = getActions.call(self)
	})

	test('produces a non-empty action set', () => {
		expect(Object.keys(actions).length).toBeGreaterThan(0)
	})

	describe('every action definition is well-formed', () => {
		test.each(Object.keys(getActions.call(makeMockInstanceSeeded())))('%s', (id) => {
			const def = actions[id]!
			expect(def).toBeDefined()
			expect(typeof def.name).toBe('string')
			expect(def.name.length).toBeGreaterThan(0)
			expect(Array.isArray(def.options)).toBe(true)
			expect(typeof def.callback).toBe('function')
			expect(def.learn === undefined || typeof def.learn === 'function').toBe(true)
		})
	})

	describe('every action callback runs without throwing', () => {
		test.each(Object.keys(getActions.call(makeMockInstanceSeeded())))('%s', async (id) => {
			const def = actions[id]!
			await expect(
				Promise.resolve(def.callback(event(id, defaultOptions(def)), new MockContext())),
			).resolves.not.toThrow()
		})
	})

	describe('every learn callback runs without throwing', () => {
		const seeded = getActions.call(makeMockInstanceSeeded())
		const withLearn = Object.keys(seeded).filter((id) => seeded[id]!.learn !== undefined)
		test.each(withLearn)('%s', async (id) => {
			const def = actions[id]!
			await expect(
				Promise.resolve(def.learn!(event(id, defaultOptions(def)), new MockContext())),
			).resolves.not.toThrow()
		})
	})
})

/** Helper so the `test.each` id lists can be computed at collection time. */
function makeMockInstanceSeeded(): MockInstance {
	const self = makeMockInstance()
	seedFullState(self)
	return self
}
