import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionPresetDefinition, CompanionSomePresetDefinition } from '@companion-module/base'
import { getPresets } from '../presets.js'
import { getActions } from '../actions.js'
import { getFeedbacks } from '../feedbacks.js'
import type { OBSInstanceTypes } from '../main.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { Style } from '../presets/style.js'

/** Narrows away the `alternatives` grouping, leaving the simple/layered button presets. */
function isButtonPreset(
	preset: CompanionSomePresetDefinition<OBSInstanceTypes> | undefined,
): preset is CompanionPresetDefinition<OBSInstanceTypes> {
	return !!preset && preset.type !== 'alternatives'
}

/** Narrows to the simple presets, which are the only ones carrying a flat button `style`. */
function isSimplePreset(
	preset: CompanionSomePresetDefinition<OBSInstanceTypes> | undefined,
): preset is Extract<CompanionPresetDefinition<OBSInstanceTypes>, { type: 'simple' }> {
	return !!preset && preset.type === 'simple'
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
			// `alternatives` entries group variants and carry no name of their own.
			if (!isButtonPreset(preset)) continue
			expect(typeof preset.name).toBe('string')
			expect(preset.name.length).toBeGreaterThan(0)
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
			// Validate that every preset ID referenced in the structure exists.
			for (const definition of section.definitions) {
				if (typeof definition === 'string') {
					if (!(definition in presets)) missing.push(`${section.id} -> ${definition}`)
					continue
				}
				if (definition.type === 'template') {
					if (!(definition.presetId in presets)) {
						missing.push(`${section.id}/${definition.id} -> ${definition.presetId}`)
					}
				} else {
					for (const ref of definition.presets) {
						if (!(ref in presets)) missing.push(`${section.id}/${definition.id} -> ${ref}`)
					}
				}
			}
		}
		expect(missing).toEqual([])
	})

	test('every template group references a preset that declares its template variable', () => {
		const mismatched: string[] = []
		for (const section of structure) {
			for (const definition of section.definitions) {
				if (typeof definition === 'string' || definition.type !== 'template') continue
				const preset = presets[definition.presetId]
				const localVars = (preset as { localVariables?: { variableName: string }[] } | undefined)?.localVariables
				const hasVar = localVars?.some((v) => v.variableName === definition.templateVariableName)
				if (!hasVar) mismatched.push(`${section.id}/${definition.id} -> ${definition.templateVariableName}`)
			}
		}
		expect(mismatched).toEqual([])
	})

	test('every preset style uses a color from the semantic palette', () => {
		const stray: string[] = []
		const palette = new Set<number>(Object.values(Style))
		for (const [id, preset] of Object.entries(presets)) {
			if (!isSimplePreset(preset)) continue
			for (const [key, style] of [
				['style', preset.style],
				['previewStyle', preset.previewStyle],
			] as const) {
				if (!style) continue
				if (style.bgcolor !== undefined && !palette.has(style.bgcolor)) stray.push(`${id}.${key}.bgcolor`)
				if (style.color !== undefined && !palette.has(style.color)) stray.push(`${id}.${key}.color`)
			}
			for (const feedback of preset.feedbacks ?? []) {
				const style = (feedback as { style?: { bgcolor?: number; color?: number } }).style
				if (!style) continue
				if (style.bgcolor !== undefined && !palette.has(style.bgcolor)) stray.push(`${id}.feedback.bgcolor`)
				if (style.color !== undefined && !palette.has(style.color)) stray.push(`${id}.feedback.color`)
			}
		}
		expect(stray).toEqual([])
	})

	test('no preset line mixes ALL-CAPS and Title Case words', () => {
		// Catches drift like `ENABLE\nStudio Mode`. Source/output labels are interpolated at runtime and
		// keep whatever case OBS reports, so only lines made purely of literal words are checked.
		const mixed: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			if (!isSimplePreset(preset)) continue
			for (const line of (preset.style?.text ?? '').split('\n')) {
				if (line.includes('$(')) continue
				const words: string[] = line.match(/[A-Za-z]{3,}/g) ?? []
				const shouting = words.filter((w) => w === w.toUpperCase())
				const titled = words.filter((w) => /^[A-Z][a-z]/.test(w))
				if (shouting.length > 0 && titled.length > 0) mixed.push(`${id}: ${line}`)
			}
		}
		expect(mixed).toEqual([])
	})

	// Actions and feedbacks that intentionally have no preset: config-shaped or free-form escape
	// hatches where a preset would be noise rather than a starting point. Anything else appearing
	// here means a new action shipped without a preset to discover it by.
	const PRESETLESS_ACTIONS = [
		'SendStreamCaption',
		'audio_balance',
		'audio_offset',
		'custom_command',
		'setFilterSettings',
		'setTextProperties',
		'set_stream_settings',
		'source_properties',
		'toggle_all_scene_items',
		'updateMediaLocalFile',
		'vendorRequest',
	]
	const PRESETLESS_FEEDBACKS = ['scenePrevious', 'vendorEvent']

	test('every action and feedback is reachable from a preset, or listed as deliberately not', () => {
		const usedActions = new Set<string>()
		const usedFeedbacks = new Set<string>()
		for (const preset of Object.values(presets)) {
			if (!isButtonPreset(preset)) continue
			for (const step of preset.steps ?? []) {
				for (const set of Object.values(step)) {
					for (const action of set as { actionId: string }[]) usedActions.add(action.actionId)
				}
			}
			for (const feedback of preset.feedbacks ?? []) usedFeedbacks.add(feedback.feedbackId)
		}
		expect([...actionIds].filter((id) => !usedActions.has(id)).sort()).toEqual(PRESETLESS_ACTIONS)
		expect([...feedbackIds].filter((id) => !usedFeedbacks.has(id)).sort()).toEqual(PRESETLESS_FEEDBACKS)
	})
})
