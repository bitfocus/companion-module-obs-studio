import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Custom output presets (Virtual Camera, Decklink, etc.) templates. */
export function getOutputPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['tpl_outputToggle'] = {
		type: 'simple',
		name: 'Toggle Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: '$(local:output)' }),
		steps: [
			{
				down: [
					{ actionId: 'start_stop_output', options: { output: { value: '$(local:output)', isExpression: true } } },
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'output_active',
				options: { output: { value: '$(local:output)', isExpression: true } },
				style: { ...styleActive(), text: '$(local:output)\nActive' },
			},
		],
	}

	presets['tpl_outputStart'] = {
		type: 'simple',
		name: 'Start Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: 'START\n$(local:output)' }),
		steps: [
			{
				down: [{ actionId: 'start_output', options: { output: { value: '$(local:output)', isExpression: true } } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'output_active',
				options: { output: { value: '$(local:output)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	presets['tpl_outputStop'] = {
		type: 'simple',
		name: 'Stop Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: 'STOP\n$(local:output)' }),
		steps: [
			{
				down: [{ actionId: 'stop_output', options: { output: { value: '$(local:output)', isExpression: true } } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['tpl_outputStatus'] = {
		type: 'simple',
		name: 'Output Status',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: '$(local:output)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{
				feedbackId: 'output_active',
				options: { output: { value: '$(local:output)', isExpression: true } },
				style: { ...styleActive(), text: '$(local:output)\nActive' },
			},
		],
	}

	const outputValues = self.obsState.outputList.map((o) => ({ name: o.label, value: o.id }))

	const sections: CompanionPresetSection[] = [
		{
			id: 'outputs',
			name: 'Custom Outputs',
			definitions: [
				{
					id: 'outputs-control',
					name: 'Toggle',
					type: 'template',
					presetId: 'tpl_outputToggle',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-start',
					name: 'Start',
					type: 'template',
					presetId: 'tpl_outputStart',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-stop',
					name: 'Stop',
					type: 'template',
					presetId: 'tpl_outputStop',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-status',
					name: 'Status',
					type: 'template',
					presetId: 'tpl_outputStatus',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
			],
		},
	]

	return { presets, sections }
}
