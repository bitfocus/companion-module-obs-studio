import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleActive } from './style.js'

/** Studio Mode and configuration presets for profiles and scene collections. */
export function getStudioConfigPresets(self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['toggleStudioMode'] = {
		type: 'simple',
		name: 'Toggle Studio Mode',
		style: baseStyle({ text: 'ENABLE\nStudio Mode' }),
		steps: [{ down: [{ actionId: 'studio_mode', options: { enabled: 'toggle' } }], up: [] }],
		feedbacks: [{ feedbackId: 'studioMode', options: {}, style: { ...styleActive(), text: 'DISABLE\nStudio Mode' } }],
	}

	presets['tmp_profile'] = {
		type: 'simple',
		name: 'Set Profile',
		localVariables: [{ variableType: 'simple', variableName: 'profile', startupValue: '', headline: 'Profile name' }],
		style: baseStyle({ text: '$(local:profile)' }),
		steps: [
			{
				down: [{ actionId: 'set_profile', options: { profile: { value: '$(local:profile)', isExpression: true } } }],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'profile_active',
				options: { profile: { value: '$(local:profile)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	presets['tmp_sceneCollection'] = {
		type: 'simple',
		name: 'Set Scene Collection',
		localVariables: [
			{ variableType: 'simple', variableName: 'collection', startupValue: '', headline: 'Scene collection name' },
		],
		style: baseStyle({ text: '$(local:collection)' }),
		steps: [
			{
				down: [
					{
						actionId: 'set_scene_collection',
						options: { scene_collection: { value: '$(local:collection)', isExpression: true } },
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'scene_collection_active',
				options: { scene_collection: { value: '$(local:collection)', isExpression: true } },
				style: styleActive(),
			},
		],
	}

	const profileValues = self.obsState.profileChoices.map((p) => ({ name: p.label, value: p.id }))
	const collectionValues = self.obsState.sceneCollectionList.map((c) => ({ name: c.label, value: c.id }))

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
		{
			id: 'studio-config',
			name: 'Studio Mode & Config',
			definitions: [
				{ id: 'studio-mode', name: 'Studio Mode', type: 'simple', presets: ['toggleStudioMode'] },
				{
					id: 'config-profile',
					name: 'Profile',
					type: 'template',
					presetId: 'tmp_profile',
					templateVariableName: 'profile',
					templateValues: profileValues,
				},
				{
					id: 'config-collection',
					name: 'Scene Collection',
					type: 'template',
					presetId: 'tmp_sceneCollection',
					templateVariableName: 'collection',
					templateValues: collectionValues,
				},
			],
		},
	]

	return { presets, sections }
}
