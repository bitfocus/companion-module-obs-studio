import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Custom output presets (Virtual Cam, Decklink, etc.), grouped by output. */
export function getOutputPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = []

	for (const output of self.obsState.outputList) {
		const outputId = String(output.id)
		const slug = outputId.replace(/[^a-zA-Z0-9]+/g, '_')
		const value = { value: outputId, isExpression: false as const }
		const ids = {
			toggle: `output_${slug}_toggle`,
			start: `output_${slug}_start`,
			stop: `output_${slug}_stop`,
			status: `output_${slug}_status`,
		}

		presets[ids.toggle] = {
			type: 'simple',
			name: 'Toggle Output',
			style: baseStyle({ text: output.label }),
			steps: [{ down: [{ actionId: 'output', options: { action: 'toggle', output: value } }], up: [] }],
			feedbacks: [
				{
					feedbackId: 'output_active',
					options: { output: value },
					style: { ...styleActive(), text: `${output.label}\nActive` },
				},
			],
		}

		presets[ids.start] = {
			type: 'simple',
			name: 'Start Output',
			style: baseStyle({ text: `START\n${output.label}` }),
			steps: [{ down: [{ actionId: 'output', options: { action: 'start', output: value } }], up: [] }],
			feedbacks: [{ feedbackId: 'output_active', options: { output: value }, style: styleActive() }],
		}

		presets[ids.stop] = {
			type: 'simple',
			name: 'Stop Output',
			style: baseStyle({ text: `STOP\n${output.label}` }),
			steps: [{ down: [{ actionId: 'output', options: { action: 'stop', output: value } }], up: [] }],
			feedbacks: [],
		}

		presets[ids.status] = {
			type: 'simple',
			name: 'Output Status',
			style: baseStyle({ text: output.label }),
			steps: [{ down: [], up: [] }],
			feedbacks: [
				{
					feedbackId: 'output_active',
					options: { output: value },
					style: { ...styleActive(), text: `${output.label}\nActive` },
				},
			],
		}

		groups.push({
			id: `outputs-${slug}`,
			type: 'simple',
			name: output.label,
			presets: [ids.toggle, ids.start, ids.stop, ids.status],
		})
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'outputs',
			name: 'Custom Outputs',
			definitions: groups,
		},
	]

	return { presets, sections }
}
