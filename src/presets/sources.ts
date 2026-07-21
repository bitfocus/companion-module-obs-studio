import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleProgram, stylePreview } from './style.js'

/** Source presets: status template for tally, plus example action buttons. */
export function getSourcePresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['tmp_sourceStatus'] = {
		type: 'simple',
		name: 'Source Status (Program / Preview Tally)',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Source name' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			// Preview feedback runs first so program (red) wins if live in both.
			{
				feedbackId: 'scene_item_previewed',
				options: { source: { value: '$(local:source)', isExpression: true } },
				style: stylePreview(),
			},
			{
				feedbackId: 'scene_item_active',
				options: { anyScene: true, source: { value: '$(local:source)', isExpression: true } },
				style: styleProgram(),
			},
		],
	}

	// Example action presets (user selects specific source after dropping).
	presets['refreshBrowserSource'] = {
		type: 'simple',
		name: 'Refresh Browser Source (example)',
		style: baseStyle({ text: 'Refresh\nBrowser' }),
		steps: [{ down: [{ actionId: 'refresh_browser_source', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['resetCaptureDevice'] = {
		type: 'simple',
		name: 'Reset Capture Device (example)',
		style: baseStyle({ text: 'Reset\nCapture' }),
		steps: [{ down: [{ actionId: 'resetCaptureDevice', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['takeScreenshot'] = {
		type: 'simple',
		name: 'Take Screenshot (Program)',
		style: baseStyle({ text: 'Take\nScreenshot' }),
		steps: [
			{
				down: [
					{
						actionId: 'take_screenshot',
						options: {
							useProgramScene: true,
							format: 'png',
							compression: 0,
							customName: false,
							path: '',
							prefix: 'Screenshot_$(internal:date_iso)_$(internal:time_hms) ',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	const sourceValues = self.obsState.sourceChoices.map((s) => ({ name: s.label, value: s.id }))

	const sections: CompanionPresetSection[] = [
		{
			id: 'sources',
			name: 'Sources',
			definitions: [
				{
					id: 'sources-status',
					name: 'Status (Program / Preview Tally)',
					type: 'template',
					presetId: 'tmp_sourceStatus',
					templateVariableName: 'source',
					templateValues: sourceValues,
				},
				{
					id: 'sources-actions',
					name: 'Source Specific Actions',
					type: 'simple',
					presets: ['refreshBrowserSource', 'resetCaptureDevice', 'takeScreenshot'],
				},
			],
		},
	]

	return { presets, sections }
}
