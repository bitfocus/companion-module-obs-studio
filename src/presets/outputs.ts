import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Custom output presets (Virtual Camera, Decklink, etc.) templates. */
export function getOutputPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['tmp_outputToggle'] = {
		type: 'simple',
		name: 'Toggle Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: '$(local:output)' }),
		steps: [
			{
				down: [
					{
						actionId: 'output',
						options: { action: 'toggle', output: { value: '$(local:output)', isExpression: true } },
					},
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

	presets['tmp_outputStart'] = {
		type: 'simple',
		name: 'Start Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: 'START\n$(local:output)' }),
		steps: [
			{
				down: [
					{
						actionId: 'output',
						options: { action: 'start', output: { value: '$(local:output)', isExpression: true } },
					},
				],
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

	presets['tmp_outputStop'] = {
		type: 'simple',
		name: 'Stop Output',
		localVariables: [{ variableType: 'simple', variableName: 'output', startupValue: '', headline: 'Output name' }],
		style: baseStyle({ text: 'STOP\n$(local:output)' }),
		steps: [
			{
				down: [
					{ actionId: 'output', options: { action: 'stop', output: { value: '$(local:output)', isExpression: true } } },
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['tmp_outputStatus'] = {
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

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'outputs',
			name: 'Custom Outputs',
			definitions: [
				{
					id: 'outputs-control',
					name: 'Toggle',
					type: 'template',
					presetId: 'tmp_outputToggle',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-start',
					name: 'Start',
					type: 'template',
					presetId: 'tmp_outputStart',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-stop',
					name: 'Stop',
					type: 'template',
					presetId: 'tmp_outputStop',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
				{
					id: 'outputs-status',
					name: 'Status',
					type: 'template',
					presetId: 'tmp_outputStatus',
					templateVariableName: 'output',
					templateValues: outputValues,
				},
			],
		},
	]

	return { presets, sections }
}
