import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleProgram, stylePreview } from './style.js'

/**
 * Source presets. A per-source status template shows program/preview tally (across any
 * scene), plus a few example action buttons the user points at a specific source.
 * Filter and scene-item-visibility families are intentionally omitted — they need an
 * extra argument (scene / source+filter) a single template variable can't supply.
 */
export function getSourcePresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['tpl_sourceStatus'] = {
		type: 'simple',
		name: 'Source Status (tally)',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Source name' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			// Preview first so program (red) wins when a source is live in both.
			{ feedbackId: 'scene_item_previewed', options: { source: '$(local:source)' }, style: stylePreview() },
			{
				feedbackId: 'scene_item_active',
				options: { anyScene: true, source: '$(local:source)' },
				style: styleProgram(),
			},
		],
	}

	// Example action presets — the user selects the specific source after dropping them.
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
					name: 'Status (tally)',
					type: 'template',
					presetId: 'tpl_sourceStatus',
					templateVariableName: 'source',
					templateValues: sourceValues,
				},
				{
					id: 'sources-actions',
					name: 'Actions',
					type: 'simple',
					presets: ['refreshBrowserSource', 'resetCaptureDevice', 'takeScreenshot'],
				},
			],
		},
	]

	return { presets, sections }
}
