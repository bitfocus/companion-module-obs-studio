import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from './main.js'

import { getSourcePresets } from './presets/sources.js'
import { getPreviewScenePresets, getProgramScenePresets } from './presets/scenes.js'
import { getTransitionPresets } from './presets/transitions.js'
import { getAudioPresets } from './presets/audio.js'
import { getMediaPresets } from './presets/media.js'
import { getOutputPresets } from './presets/outputs.js'
import { getUiConfigCustomPresets } from './presets/ui-config-custom.js'

export function getPresets(this: OBSInstance): {
	presets: CompanionPresetDefinitions
	structure: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {
		...getAudioPresets(this),
		...getMediaPresets(this),
		...getOutputPresets(this),
		...getProgramScenePresets(this),
		...getPreviewScenePresets(this),
		...getSourcePresets(this),
		...getTransitionPresets(this),
		...getUiConfigCustomPresets(this),
	}

	const structure: CompanionPresetSection[] = [
		{
			id: 'audio',
			name: 'Audio Sources',
			definitions: Object.keys(getAudioPresets(this)),
		},
		{
			id: 'media',
			name: 'Media Sources',
			definitions: Object.keys(getMediaPresets(this)),
		},
		{
			id: 'outputs',
			name: 'Streaming & Recording',
			definitions: Object.keys(getOutputPresets(this)),
		},
		{
			id: 'scenes-program',
			name: 'Scenes to Program',
			definitions: Object.keys(getProgramScenePresets(this)),
		},
		{
			id: 'scenes-preview',
			name: 'Scenes to Preview',
			definitions: Object.keys(getPreviewScenePresets(this)),
		},
		{
			id: 'sources',
			name: 'Sources',
			definitions: Object.keys(getSourcePresets(this)),
		},
		{
			id: 'transitions',
			name: 'Transitions',
			definitions: Object.keys(getTransitionPresets(this)),
		},
		{
			id: 'ui',
			name: 'General & Profiles',
			definitions: Object.keys(getUiConfigCustomPresets(this)),
		},
	]

	return { presets, structure }
}
