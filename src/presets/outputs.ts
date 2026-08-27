import { CompanionPresetDefinitions, CompanionPresetGroup, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, generateSlug, styleActive } from './style.js'

/** Custom output presets (Virtual Cam, Decklink, etc.), grouped by output. */
export function getOutputPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}
	const groups: CompanionPresetGroup<OBSInstanceTypes>[] = []
	const slugFor = generateSlug()

	for (const output of self.obsState.outputList) {
		const outputId = String(output.id)
		const slug = slugFor(outputId)
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
			style: baseStyle({ text: `${output.label}\nToggle` }),
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
			style: baseStyle({ text: `Start\n${output.label}` }),
			steps: [{ down: [{ actionId: 'output', options: { action: 'start', output: value } }], up: [] }],
			feedbacks: [{ feedbackId: 'output_active', options: { output: value }, style: styleActive() }],
		}

		presets[ids.stop] = {
			type: 'simple',
			name: 'Stop Output',
			style: baseStyle({ text: `Stop\n${output.label}` }),
			steps: [{ down: [{ actionId: 'output', options: { action: 'stop', output: value } }], up: [] }],
			feedbacks: [],
		}

		presets[ids.status] = {
			type: 'simple',
			name: 'Output Status',
			style: baseStyle({ text: `${output.label}\nStopped` }),
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
			keywords: [output.label, 'output', 'start', 'stop'],
			presets: [ids.toggle, ids.start, ids.stop, ids.status],
		})
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = groups.length
		? [
				{
					id: 'outputs',
					name: 'Custom Outputs',
					keywords: ['output', 'virtual camera', 'virtualcam', 'decklink', 'sdi', 'ndi'],
					definitions: groups,
				},
			]
		: []

	return { presets, sections }
}
