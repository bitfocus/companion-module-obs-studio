import { beforeEach, describe, expect, test } from 'vitest'
import { getVariables, updateVariableValues } from '../variables.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'

describe('variables', () => {
	let self: MockInstance

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
	})

	test('every variable definition has a non-empty name', () => {
		const variables = getVariables.call(self)
		const ids = Object.keys(variables)
		expect(ids.length).toBeGreaterThan(0)
		for (const id of ids) {
			expect(typeof variables[id].name).toBe('string')
			expect(variables[id].name.length).toBeGreaterThan(0)
		}
	})

	test('source- and scene-specific variables are generated from state', () => {
		const variables = getVariables.call(self)
		// Audio source -> volume var, media source -> status var, text -> text var, image -> file var
		expect(variables).toHaveProperty('volume_Mic')
		expect(variables).toHaveProperty('media_status_Clip')
		expect(variables).toHaveProperty('current_text_Title')
		expect(variables).toHaveProperty('image_file_name_Logo')
		expect(variables).toHaveProperty('scene_1')
	})

	test('updateVariableValues only sets variables that are defined', () => {
		const defined = new Set(Object.keys(getVariables.call(self)))

		updateVariableValues.call(self)

		expect(self.setVariableValues).toHaveBeenCalledTimes(1)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>
		const undefinedVars = Object.keys(updates).filter((key) => !defined.has(key))
		expect(undefinedVars).toEqual([])
	})

	test('updateVariableValues reflects seeded scene state', () => {
		updateVariableValues.call(self)
		const updates = self.setVariableValues.mock.calls[0][0] as Record<string, unknown>
		expect(updates.scene_active).toBe('Scene A')
		expect(updates.scene_preview).toBe('Scene B')
	})
})
