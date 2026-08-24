import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleProgram, stylePreview, Style, Color } from './style.js'

/** Scene presets: program, preview, and smart switch template presets. */
export function getScenePresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['tmp_sceneProgram'] = {
		type: 'simple',
		name: 'Scene to Program',
		localVariables: [{ variableType: 'simple', variableName: 'scene', startupValue: '', headline: 'Scene name' }],
		style: baseStyle({ text: '$(local:scene)' }),
		steps: [
			{
				down: [{ actionId: 'set_scene', options: { scene: { value: '$(local:scene)', isExpression: true } } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'sceneProgram',
				options: { scene: { value: '$(local:scene)', isExpression: true } },
				style: styleProgram(),
			},
		],
	}

	presets['tmp_scenePreview'] = {
		type: 'simple',
		name: 'Scene to Preview',
		localVariables: [{ variableType: 'simple', variableName: 'scene', startupValue: '', headline: 'Scene name' }],
		style: baseStyle({ text: '$(local:scene)' }),
		steps: [
			{
				down: [
					{
						actionId: 'preview_scene',
						options: { mode: 'set', scene: { value: '$(local:scene)', isExpression: true } },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'scenePreview',
				options: { scene: { value: '$(local:scene)', isExpression: true } },
				style: stylePreview(),
			},
		],
	}

	presets['tmp_sceneSmart'] = {
		type: 'simple',
		name: 'Smart Switch Scene',
		localVariables: [{ variableType: 'simple', variableName: 'scene', startupValue: '', headline: 'Scene name' }],
		style: baseStyle({ text: '$(local:scene)' }),
		steps: [
			{
				down: [{ actionId: 'smart_switcher', options: { scene: { value: '$(local:scene)', isExpression: true } } }],
				up: [],
			},
		],
		// scene_active colors live in options because it is an advanced feedback.
		feedbacks: [
			{
				feedbackId: 'scene_active',
				options: {
					scene: { value: '$(local:scene)', isExpression: true },
					mode: 'programAndPreview',
					fg: Color.White,
					bg: Style.program,
					fg_preview: Color.White,
					bg_preview: Style.preview,
				},
			},
		],
	}

	presets['scenePreviewNext'] = {
		type: 'simple',
		name: 'Preview Next Scene',
		style: baseStyle({ text: 'Preview\nNext' }),
		steps: [{ down: [{ actionId: 'preview_scene', options: { mode: 'next', scene: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['scenePreviewPrevious'] = {
		type: 'simple',
		name: 'Preview Previous Scene',
		style: baseStyle({ text: 'Preview\nPrevious' }),
		steps: [{ down: [{ actionId: 'preview_scene', options: { mode: 'previous', scene: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['sceneReturnPrevious'] = {
		type: 'simple',
		name: 'Return to Previous Scene',
		style: baseStyle({ text: 'Back To:\n$(obs:scene_previous)' }),
		steps: [
			{
				down: [{ actionId: 'set_scene', options: { scene: { value: '$(obs:scene_previous)', isExpression: true } } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	const sceneValues = self.obsState.sceneChoices.map((s) => ({ name: s.label, value: s.id }))

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'scenes',
			name: 'Scenes',
			definitions: [
				{
					id: 'scenes-program',
					name: 'Scene to Program',
					type: 'template',
					presetId: 'tmp_sceneProgram',
					templateVariableName: 'scene',
					templateValues: sceneValues,
				},
				{
					id: 'scenes-preview',
					name: 'Scene to Preview',
					type: 'template',
					presetId: 'tmp_scenePreview',
					templateVariableName: 'scene',
					templateValues: sceneValues,
				},
				{
					id: 'scenes-smart',
					name: 'Smart Switch Scene',
					type: 'template',
					presetId: 'tmp_sceneSmart',
					templateVariableName: 'scene',
					templateValues: sceneValues,
				},
				{
					id: 'scenes-nav',
					name: 'Navigation',
					type: 'simple',
					presets: ['scenePreviewNext', 'scenePreviewPrevious', 'sceneReturnPrevious'],
				},
			],
		},
	]

	return { presets, sections }
}
