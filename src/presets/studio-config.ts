import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleActive } from './style.js'

/**
 * Studio Mode + configuration presets. Profile and scene-collection switching are
 * per-item templates keyed on the button-local `profile` / `collection` variable.
 */
export function getStudioConfigPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['toggleStudioMode'] = {
		type: 'simple',
		name: 'Toggle Studio Mode',
		style: baseStyle({ text: 'ENABLE\nStudio Mode' }),
		steps: [{ down: [{ actionId: 'toggle_studio_mode', options: {} }], up: [] }],
		feedbacks: [{ feedbackId: 'studioMode', options: {}, style: { ...styleActive(), text: 'DISABLE\nStudio Mode' } }],
	}

	presets['tpl_profile'] = {
		type: 'simple',
		name: 'Set Profile',
		localVariables: [{ variableType: 'simple', variableName: 'profile', startupValue: '', headline: 'Profile name' }],
		style: baseStyle({ text: '$(local:profile)' }),
		steps: [{ down: [{ actionId: 'set_profile', options: { profile: '$(local:profile)' } }], up: [] }],
		feedbacks: [{ feedbackId: 'profile_active', options: { profile: '$(local:profile)' }, style: styleActive() }],
	}

	presets['tpl_sceneCollection'] = {
		type: 'simple',
		name: 'Set Scene Collection',
		localVariables: [
			{ variableType: 'simple', variableName: 'collection', startupValue: '', headline: 'Scene collection name' },
		],
		style: baseStyle({ text: '$(local:collection)' }),
		steps: [
			{ down: [{ actionId: 'set_scene_collection', options: { scene_collection: '$(local:collection)' } }], up: [] },
		],
		feedbacks: [
			{
				feedbackId: 'scene_collection_active',
				options: { scene_collection: '$(local:collection)' },
				style: styleActive(),
			},
		],
	}

	const profileValues = self.obsState.profileChoices.map((p) => ({ name: p.label, value: p.id }))
	const collectionValues = self.obsState.sceneCollectionList.map((c) => ({ name: c.label, value: c.id }))

	const sections: CompanionPresetSection[] = [
		{
			id: 'studio-config',
			name: 'Studio Mode & Config',
			definitions: [
				{ id: 'studio-mode', name: 'Studio Mode', type: 'simple', presets: ['toggleStudioMode'] },
				{
					id: 'config-profile',
					name: 'Profile',
					type: 'template',
					presetId: 'tpl_profile',
					templateVariableName: 'profile',
					templateValues: profileValues,
				},
				{
					id: 'config-collection',
					name: 'Scene Collection',
					type: 'template',
					presetId: 'tpl_sceneCollection',
					templateVariableName: 'collection',
					templateValues: collectionValues,
				},
			],
		},
	]

	return { presets, sections }
}
