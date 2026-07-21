import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleProgram, stylePreview, Style, Color } from './style.js'

/** Scene presets: program, preview, and smart switch template presets. */
export function getScenePresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

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
				down: [{ actionId: 'preview_scene', options: { scene: { value: '$(local:scene)', isExpression: true } } }],
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
		steps: [{ down: [{ actionId: 'adjustPreviewScene', options: { adjust: 'next' } }], up: [] }],
		feedbacks: [],
	}

	presets['scenePreviewPrevious'] = {
		type: 'simple',
		name: 'Preview Previous Scene',
		style: baseStyle({ text: 'Preview\nPrevious' }),
		steps: [{ down: [{ actionId: 'adjustPreviewScene', options: { adjust: 'previous' } }], up: [] }],
		feedbacks: [],
	}

	const sceneValues = self.obsState.sceneChoices.map((s) => ({ name: s.label, value: s.id }))

	const sections: CompanionPresetSection[] = [
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
					presets: ['scenePreviewNext', 'scenePreviewPrevious'],
				},
			],
		},
	]

	return { presets, sections }
}
