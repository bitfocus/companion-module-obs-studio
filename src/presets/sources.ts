import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive, styleProgram, stylePreview } from './style.js'

/** Source presets: status template for tally, plus example action buttons. */
export function getSourcePresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

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
				options: {
					anyScene: true,
					useCurrentScene: false,
					scene: '',
					source: { value: '$(local:source)', isExpression: true },
				},
				style: styleProgram(),
			},
		],
	}

	// Visibility and filters are scoped to the program scene, so the button and its feedback always
	// describe the same scene item.
	presets['tmp_sourceVisibility'] = {
		type: 'simple',
		name: 'Source Visibility (Current Scene)',
		localVariables: [{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Source name' }],
		style: baseStyle({ text: '$(local:source)' }),
		steps: [
			{
				down: [
					{
						actionId: 'toggle_scene_item',
						options: {
							anyScene: false,
							useCurrentScene: true,
							scene: '',
							source: { value: '$(local:source)', isExpression: true },
							visible: 'toggle',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'scene_item_active_in_scene',
				options: {
					scene: { value: '$(obs:scene_active)', isExpression: true },
					any: false,
					source: { value: '$(local:source)', isExpression: true },
				},
				style: styleActive(),
			},
		],
	}

	presets['tmp_filterToggle'] = {
		type: 'simple',
		name: 'Toggle Filter (All Sources)',
		localVariables: [{ variableType: 'simple', variableName: 'filter', startupValue: '', headline: 'Filter name' }],
		style: baseStyle({ text: '$(local:filter)' }),
		steps: [
			{
				down: [
					{
						actionId: 'toggle_filter',
						options: {
							allSources: true,
							source: '',
							filter: { value: '$(local:filter)', isExpression: true },
							visible: 'toggle',
						},
					},
				],
				up: [],
			},
		],
		// No feedback: with All Sources there is no single source whose filter state could be shown.
		feedbacks: [],
	}

	presets['filterToggleSingle'] = {
		type: 'simple',
		name: 'Toggle Filter on One Source (example)',
		style: baseStyle({ text: 'Toggle\nFilter' }),
		steps: [
			{
				down: [
					{ actionId: 'toggle_filter', options: { allSources: false, source: '', filter: '', visible: 'toggle' } },
				],
				up: [],
			},
		],
		feedbacks: [{ feedbackId: 'filter_enabled', options: { source: '', filter: '' }, style: styleActive() }],
	}

	presets['tmp_setText'] = {
		type: 'simple',
		name: 'Set Text Source',
		localVariables: [
			{ variableType: 'simple', variableName: 'source', startupValue: '', headline: 'Text source name' },
		],
		style: baseStyle({ text: '$(local:source)' }),
		// The replacement text is left blank so the user types it after dropping the preset.
		steps: [
			{
				down: [
					{ actionId: 'setText', options: { source: { value: '$(local:source)', isExpression: true }, text: '' } },
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// Example action presets (user selects specific source after dropping).
	presets['refreshBrowserSource'] = {
		type: 'simple',
		name: 'Refresh Browser Source (example)',
		style: baseStyle({ text: 'Refresh\nBrowser' }),
		steps: [{ down: [{ actionId: 'refresh_browser_source', options: { source: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['resetCaptureDevice'] = {
		type: 'simple',
		name: 'Reset Capture Device (example)',
		style: baseStyle({ text: 'Reset\nCapture' }),
		steps: [{ down: [{ actionId: 'resetCaptureDevice', options: { source: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['takeScreenshot'] = {
		type: 'simple',
		name: 'Screenshot (Program)',
		style: baseStyle({ text: 'Screenshot' }),
		steps: [
			{
				down: [
					{
						actionId: 'take_screenshot',
						options: {
							useProgramScene: true,
							usePreviewScene: false,
							source: '',
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
	const filterValues = self.obsState.filterList.map((f) => ({ name: f.label, value: f.id }))
	const textSourceValues = self.obsState.textSourceList.map((t) => ({ name: t.label, value: t.id }))

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
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
					id: 'sources-visibility',
					name: 'Visibility (Current Scene)',
					type: 'template',
					presetId: 'tmp_sourceVisibility',
					templateVariableName: 'source',
					templateValues: sourceValues,
				},
				{
					id: 'sources-filters',
					name: 'Filters',
					type: 'template',
					presetId: 'tmp_filterToggle',
					templateVariableName: 'filter',
					templateValues: filterValues,
				},
				{
					id: 'sources-text',
					name: 'Text Sources',
					type: 'template',
					presetId: 'tmp_setText',
					templateVariableName: 'source',
					templateValues: textSourceValues,
				},
				{
					id: 'sources-actions',
					name: 'Source Specific Actions',
					type: 'simple',
					presets: ['refreshBrowserSource', 'resetCaptureDevice', 'takeScreenshot', 'filterToggleSingle'],
				},
			],
		},
	]

	return { presets, sections }
}
