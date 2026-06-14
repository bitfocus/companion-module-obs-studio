import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionButtonPresetDefinition } from '@companion-module/base'
import { getPresets } from './presets.js'
import { getActions } from './actions.js'
import { getFeedbacks } from './feedbacks.js'
import { makeMockInstance, seedFullState, type MockInstance } from './__tests__/mock/instance.js'

function isButtonPreset(preset: unknown): preset is CompanionButtonPresetDefinition {
	return !!preset && typeof preset === 'object' && (preset as { type?: string }).type !== 'text'
}

describe('presets', () => {
	let self: MockInstance
	let presets: ReturnType<typeof getPresets>['presets']
	let structure: ReturnType<typeof getPresets>['structure']
	let actionIds: Set<string>
	let feedbackIds: Set<string>

	beforeEach(() => {
		self = makeMockInstance()
		seedFullState(self)
		const result = getPresets.call(self)
		presets = result.presets
		structure = result.structure
		actionIds = new Set(Object.keys(getActions.call(self)))
		feedbackIds = new Set(Object.keys(getFeedbacks.call(self)))
	})

	test('seeded state produces presets', () => {
		expect(Object.keys(presets).length).toBeGreaterThan(0)
	})

	test('every preset has a type and non-empty name', () => {
		for (const preset of Object.values(presets)) {
			expect(preset).toBeDefined()
			expect(typeof preset!.type).toBe('string')
			expect(typeof preset!.name).toBe('string')
			expect(preset!.name.length).toBeGreaterThan(0)
		}
	})

	test('every preset action references an action that exists', () => {
		const missing: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			if (!isButtonPreset(preset)) continue
			for (const step of preset.steps ?? []) {
				for (const set of Object.values(step)) {
					for (const action of set as { actionId: string }[]) {
						if (!actionIds.has(action.actionId)) missing.push(`${id} -> ${action.actionId}`)
					}
				}
			}
		}
		expect(missing).toEqual([])
	})

	test('every preset feedback references a feedback that exists', () => {
		const missing: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			if (!isButtonPreset(preset)) continue
			for (const feedback of preset.feedbacks ?? []) {
				if (!feedbackIds.has(feedback.feedbackId)) missing.push(`${id} -> ${feedback.feedbackId}`)
			}
		}
		expect(missing).toEqual([])
	})

	test('every structure section references presets that exist', () => {
		const missing: string[] = []
		for (const section of structure) {
			expect(typeof section.id).toBe('string')
			expect(typeof section.name).toBe('string')
			// definitions are either preset-reference strings or nested group objects;
			// this module uses plain string references
			for (const definition of section.definitions) {
				if (typeof definition !== 'string') continue
				if (!(definition in presets)) missing.push(`${section.id} -> ${definition}`)
			}
		}
		expect(missing).toEqual([])
	})
})
