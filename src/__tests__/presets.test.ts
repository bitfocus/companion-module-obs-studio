import { beforeEach, describe, expect, test } from 'vitest'
import type { CompanionPresetDefinition, CompanionSomePresetDefinition } from '@companion-module/base'
import { getPresets } from '../presets.js'
import { getActions } from '../actions.js'
import { getFeedbacks } from '../feedbacks.js'
import type { OBSInstanceTypes } from '../main.js'
import { makeMockInstance, seedFullState, type MockInstance } from './mock/instance.js'
import { Style } from '../presets/style.js'

/** Flattens a preset entry to the button presets it contains, expanding `alternatives` to its variants. */
function buttonVariants(
	preset: CompanionSomePresetDefinition<OBSInstanceTypes> | undefined,
): CompanionPresetDefinition<OBSInstanceTypes>[] {
	if (!preset) return []
	return preset.type === 'alternatives' ? preset.variants : [preset]
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

	// The definition shape is enforced statically; only the non-empty name needs asserting.
	// `alternatives` entries group variants and carry no name of their own.
	test('every preset has a non-empty name', () => {
		const unnamed = Object.entries(presets)
			.filter(([, preset]) => buttonVariants(preset).some((variant) => variant.name.length === 0))
			.map(([id]) => id)
		expect(unnamed).toEqual([])
	})

	test('every preset action references an action that exists', () => {
		const missing: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			for (const variant of buttonVariants(preset)) {
				for (const step of variant.steps ?? []) {
					for (const set of Object.values(step)) {
						for (const action of set as { actionId: string }[]) {
							if (!actionIds.has(action.actionId)) missing.push(`${id} -> ${action.actionId}`)
						}
					}
				}
			}
		}
		expect(missing).toEqual([])
	})

	// Unlike element properties and options, a style override's value is not accepted in the bare form:
	// Companion filters overrides on `isExpressionOrValue` and drops the whole feedback when none survive,
	// so a bare value silently disables the feedback rather than failing loudly.
	test('every style override value is in the expression-or-value form', () => {
		const bare: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			for (const variant of buttonVariants(preset)) {
				if (variant.type !== 'layered') continue
				for (const feedback of variant.feedbacks ?? []) {
					for (const override of feedback.styleOverrides ?? []) {
						const value: unknown = override.override
						if (!value || typeof value !== 'object' || !('isExpression' in value)) {
							bare.push(`${id} -> ${override.elementId}.${override.elementProperty}`)
						}
					}
				}
			}
		}
		expect(bare).toEqual([])
	})

	test('every preset feedback references a feedback that exists', () => {
		const missing: string[] = []
		for (const [id, preset] of Object.entries(presets)) {
			for (const variant of buttonVariants(preset)) {
				for (const feedback of variant.feedbacks ?? []) {
					if (!feedbackIds.has(feedback.feedbackId)) missing.push(`${id} -> ${feedback.feedbackId}`)
				}
			}
		}
		expect(missing).toEqual([])
	})

	test('every structure section references presets that exist', () => {
		const missing: string[] = []
		for (const section of structure) {
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

	test('preset and group ids are unique across all builders', () => {
		const groupIds = new Set<string>()
		const duplicates: string[] = []
		for (const section of structure) {
			for (const definition of section.definitions) {
				if (typeof definition === 'string') continue
				if (groupIds.has(definition.id)) duplicates.push(definition.id)
				groupIds.add(definition.id)
			}
		}
		expect(duplicates).toEqual([])
	})

	test('sources whose names slug identically still get distinct presets', () => {
		// `Cam 1` and `Cam-1` both reduce to `Cam_1`, which would silently overwrite one another.
		const collide = makeMockInstance()
		seedFullState(collide)
		for (const name of ['Cam 1', 'Cam-1']) {
			collide.states.sources.set(name, {
				sourceName: name,
				sourceUuid: name,
				validName: name.replace(/[^a-zA-Z0-9]/g, '_'),
				isGroup: false,
				inputKind: 'wasapi_input_capture',
				inputMuted: false,
				inputVolume: 0,
				inputAudioTracks: { '1': true },
			})
		}
		const result = getPresets.call(collide)
		const muteGroups = result.structure
			.find((section) => section.id === 'audio')
			?.definitions.filter((d): d is Exclude<typeof d, string> => typeof d !== 'string')
			.filter((d) => d.name === 'Cam 1' || d.name === 'Cam-1')
		expect(muteGroups).toHaveLength(2)
		expect(new Set(muteGroups?.map((g) => g.id)).size).toBe(2)
		const referenced = muteGroups?.flatMap((g) => (g.type === 'simple' ? g.presets : []))
		expect(new Set(referenced).size).toBe(referenced?.length)
		for (const id of referenced ?? []) expect(result.presets[id]).toBeDefined()
	})

	test('sections with no items are omitted rather than left empty', () => {
		const empty = makeMockInstance()
		const result = getPresets.call(empty)
		// `media` always survives: its "Current Media" group is static rather than per-source.
		expect(result.structure.map((section) => section.id)).not.toContain('audio')
		expect(result.structure.map((section) => section.id)).not.toContain('outputs')
		for (const section of result.structure) expect(section.definitions.length).toBeGreaterThan(0)
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
		'custom_command',
		'setFilterSettings',
		'setTextProperties',
		'set_stream_settings',
		'source_properties',
		'updateMediaLocalFile',
		'vendorRequest',
	]
	const PRESETLESS_FEEDBACKS = ['scenePrevious', 'sourceSyncOffset', 'vendorEvent', 'volume']

	test('every action and feedback is reachable from a preset, or listed as deliberately not', () => {
		const usedActions = new Set<string>()
		const usedFeedbacks = new Set<string>()
		for (const preset of Object.values(presets)) {
			for (const variant of buttonVariants(preset)) {
				for (const step of variant.steps ?? []) {
					for (const set of Object.values(step)) {
						for (const action of set as { actionId: string }[]) usedActions.add(action.actionId)
					}
				}
				for (const feedback of variant.feedbacks ?? []) usedFeedbacks.add(feedback.feedbackId)
				for (const local of variant.localVariables ?? []) {
					if (local.variableType === 'feedback') usedFeedbacks.add(local.feedbackId)
				}
			}
		}
		expect([...actionIds].filter((id) => !usedActions.has(id)).sort()).toEqual(PRESETLESS_ACTIONS)
		expect([...feedbackIds].filter((id) => !usedFeedbacks.has(id)).sort()).toEqual(PRESETLESS_FEEDBACKS)
	})
})
