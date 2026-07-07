import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Transition presets: Auto button, transitions templates, and duration controls. */
export function getTransitionPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['transitionAuto'] = {
		type: 'simple',
		name: 'Send previewed scene to program',
		style: baseStyle({ text: 'AUTO' }),
		steps: [{ down: [{ actionId: 'do_transition', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'transition_active', options: {}, style: styleActive() }],
	}

	presets['tpl_setTransition'] = {
		type: 'simple',
		name: 'Set Transition Type',
		localVariables: [
			{ variableType: 'simple', variableName: 'transition', startupValue: '', headline: 'Transition name' },
		],
		style: baseStyle({ text: '$(local:transition)' }),
		// Uses the (historically plural) option key 'transitions'.
		steps: [{ down: [{ actionId: 'set_transition_type', options: { transitions: '$(local:transition)' } }], up: [] }],
		feedbacks: [
			{ feedbackId: 'current_transition', options: { transition: '$(local:transition)' }, style: styleActive() },
		],
	}

	presets['tpl_quickTransition'] = {
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
						options: { transition: '$(local:transition)', customDuration: false, transition_time: 500 },
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
		steps: [{ down: [{ actionId: 'adjustTransitionType', options: { adjust: 'next' } }], up: [] }],
		feedbacks: [],
	}

	presets['transitionPrevious'] = {
		type: 'simple',
		name: 'Previous Transition Type',
		style: baseStyle({ text: 'Previous\nTransition' }),
		steps: [{ down: [{ actionId: 'adjustTransitionType', options: { adjust: 'previous' } }], up: [] }],
		feedbacks: [],
	}

	presets['transitionCurrentInfo'] = {
		type: 'simple',
		name: 'Current Transition Info',
		style: baseStyle({ text: 'Transition\n$(obs:current_transition)\n$(obs:transition_duration)ms' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['transitionDecreaseDuration'] = {
		type: 'simple',
		name: 'Decrease transition time (-50ms)',
		style: baseStyle({ text: 'Duration\n-50ms' }),
		steps: [{ down: [{ actionId: 'adjust_transition_duration', options: { amount: -50 } }], up: [] }],
		feedbacks: [],
	}

	presets['transitionIncreaseDuration'] = {
		type: 'simple',
		name: 'Increase transition time (+50ms)',
		style: baseStyle({ text: 'Duration\n+50ms' }),
		steps: [{ down: [{ actionId: 'adjust_transition_duration', options: { amount: 50 } }], up: [] }],
		feedbacks: [],
	}

	const durationIds: string[] = []
	for (let time = 500; time < 5100; time += 500) {
		const id = `transitionDurationSet${time}`
		durationIds.push(id)
		presets[id] = {
			type: 'simple',
			name: `Transition Set ${time}ms`,
			style: baseStyle({ text: `${time}ms` }),
			steps: [{ down: [{ actionId: 'set_transition_duration', options: { duration: time } }], up: [] }],
			feedbacks: [{ feedbackId: 'transition_duration', options: { duration: time }, style: styleActive() }],
		}
	}

	const transitionValues = self.obsState.transitionList.map((t) => ({ name: t.label, value: t.id }))

	const sections: CompanionPresetSection[] = [
		{
			id: 'transitions',
			name: 'Transitions',
			definitions: [
				{ id: 'transitions-do', name: 'Auto', type: 'simple', presets: ['transitionAuto'] },
				{
					id: 'transitions-type',
					name: 'Set Type',
					type: 'template',
					presetId: 'tpl_setTransition',
					templateVariableName: 'transition',
					templateValues: transitionValues,
				},
				{
					id: 'transitions-quick',
					name: 'Quick Transition',
					type: 'template',
					presetId: 'tpl_quickTransition',
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
					presets: [
						'transitionCurrentInfo',
						'transitionDecreaseDuration',
						'transitionIncreaseDuration',
						...durationIds,
					],
				},
			],
		},
	]

	return { presets, sections }
}
