import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Transition presets: Auto button, transitions templates, and duration controls. */
export function getTransitionPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['transitionAuto'] = {
		type: 'simple',
		keywords: ['auto', 'take', 'mix'],
		name: 'Transition (Preview to Program)',
		style: baseStyle({ text: 'Transition' }),
		steps: [{ down: [{ actionId: 'do_transition', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'transition_active', options: {}, style: styleActive() }],
	}

	presets['tmp_setTransition'] = {
		type: 'simple',
		name: 'Set Transition Type',
		localVariables: [
			{ variableType: 'simple', variableName: 'transition', startupValue: '', headline: 'Transition name' },
		],
		style: baseStyle({ text: '$(local:transition)' }),
		// Uses the (historically plural) option key 'transitions'.
		steps: [
			{
				down: [
					{
						actionId: 'transition_type',
						options: { mode: 'set', transitions: { value: '$(local:transition)', isExpression: true } },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'current_transition',
				options: { transition: { value: '$(local:transition)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	presets['tmp_quickTransition'] = {
		type: 'simple',
		name: 'Quick Transition',
		localVariables: [
			{ variableType: 'simple', variableName: 'transition', startupValue: '', headline: 'Transition name' },
		],
		style: baseStyle({ text: '$(local:transition)' }),
		steps: [
			{
				down: [
					{
						actionId: 'quick_transition',
						options: {
							transition: { value: '$(local:transition)', isExpression: true },
							customDuration: false,
							transition_time: 500,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [{ feedbackId: 'transition_active', options: {}, style: styleActive() }],
	}

	presets['transitionNext'] = {
		type: 'simple',
		name: 'Next Transition Type',
		style: baseStyle({ text: 'Next\nTransition' }),
		steps: [{ down: [{ actionId: 'transition_type', options: { mode: 'next', transitions: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['transitionPrevious'] = {
		type: 'simple',
		name: 'Previous Transition Type',
		style: baseStyle({ text: 'Previous\nTransition' }),
		steps: [{ down: [{ actionId: 'transition_type', options: { mode: 'previous', transitions: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['transitionCurrentInfo'] = {
		type: 'simple',
		name: 'Current Transition Info',
		style: baseStyle({ text: 'Transition:\n$(obs:current_transition)\n$(obs:transition_duration) ms' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['transitionDecreaseDuration'] = {
		type: 'simple',
		name: 'Decrease Transition Time (-50ms)',
		style: baseStyle({ text: 'Duration\n-50 ms' }),
		steps: [
			{ down: [{ actionId: 'transition_duration', options: { mode: 'adjust', value: 500, amount: -50 } }], up: [] },
		],
		feedbacks: [],
	}

	presets['transitionIncreaseDuration'] = {
		type: 'simple',
		name: 'Increase Transition Time (+50ms)',
		style: baseStyle({ text: 'Duration\n+50 ms' }),
		steps: [
			{ down: [{ actionId: 'transition_duration', options: { mode: 'adjust', value: 500, amount: 50 } }], up: [] },
		],
		feedbacks: [],
	}

	presets['tmp_transitionDuration'] = {
		type: 'simple',
		name: 'Set Transition Duration',
		localVariables: [
			{ variableType: 'simple', variableName: 'duration', startupValue: 500, headline: 'Duration (ms)' },
		],
		style: baseStyle({ text: '$(local:duration) ms' }),
		steps: [
			{
				down: [
					{
						actionId: 'transition_duration',
						options: { mode: 'set', value: { value: '$(local:duration)', isExpression: true }, amount: 50 },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'transition_duration',
				options: { duration: { value: '$(local:duration)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	const durationValues: { name: string; value: number }[] = []
	for (let time = 500; time < 5100; time += 500) {
		durationValues.push({ name: `${time} ms`, value: time })
	}

	const transitionValues = self.obsState.transitionList.map((t) => ({ name: t.label, value: t.id }))

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'transitions',
			name: 'Transitions',
			keywords: ['transition', 'auto', 'take', 'fade', 'cut', 'stinger', 'duration'],
			definitions: [
				{ id: 'transitions-do', name: 'Transition', type: 'simple', presets: ['transitionAuto'] },
				{
					id: 'transitions-type',
					name: 'Set Type',
					type: 'template',
					presetId: 'tmp_setTransition',
					templateVariableName: 'transition',
					templateValues: transitionValues,
				},
				{
					id: 'transitions-quick',
					name: 'Quick Transition',
					type: 'template',
					presetId: 'tmp_quickTransition',
					templateVariableName: 'transition',
					templateValues: transitionValues,
				},
				{
					id: 'transitions-type-nav',
					name: 'Navigation',
					type: 'simple',
					presets: ['transitionNext', 'transitionPrevious'],
				},
				{
					id: 'transitions-duration',
					name: 'Duration',
					type: 'simple',
					presets: ['transitionCurrentInfo', 'transitionDecreaseDuration', 'transitionIncreaseDuration'],
				},
				{
					id: 'transitions-duration-set',
					name: 'Set Duration',
					type: 'template',
					presetId: 'tmp_transitionDuration',
					templateVariableName: 'duration',
					templateValues: durationValues,
				},
			],
		},
	]

	return { presets, sections }
}
