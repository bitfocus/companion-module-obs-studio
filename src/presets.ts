import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from './main.js'

import { getSourcePresets } from './presets/sources.js'
import { getPreviewScenePresets, getProgramScenePresets, getSmartScenePresets } from './presets/scenes.js'
import { getTransitionPresets } from './presets/transitions.js'
import { getAudioPresets } from './presets/audio.js'
import { getMediaPresets } from './presets/media.js'
import { getOutputPresets } from './presets/outputs.js'
import { getUiConfigCustomPresets } from './presets/ui-config-custom.js'

export function getPresets(this: OBSInstance): {
	presets: CompanionPresetDefinitions
	structure: CompanionPresetSection[]
} {
	const audio = getAudioPresets(this)
	const media = getMediaPresets(this)
	const outputs = getOutputPresets(this)
	const program = getProgramScenePresets(this)
	const preview = getPreviewScenePresets(this)
	const smart = getSmartScenePresets(this)
	const sources = getSourcePresets(this)
	const transitions = getTransitionPresets(this)
	const ui = getUiConfigCustomPresets(this)

	const presets: CompanionPresetDefinitions = {
		...audio,
		...media,
		...outputs,
		...program,
		...preview,
		...smart,
		...sources,
		...transitions,
		...ui,
	}

	const structure: CompanionPresetSection[] = [
		{ id: 'audio', name: 'Audio Sources', definitions: Object.keys(audio) },
		{ id: 'media', name: 'Media Sources', definitions: Object.keys(media) },
		{ id: 'outputs', name: 'Streaming & Recording', definitions: Object.keys(outputs) },
		{ id: 'scenes-program', name: 'Scenes to Program', definitions: Object.keys(program) },
		{ id: 'scenes-preview', name: 'Scenes to Preview', definitions: Object.keys(preview) },
		{ id: 'scenes-smart', name: 'Smart Switch Scene', definitions: Object.keys(smart) },
		{ id: 'sources', name: 'Sources', definitions: Object.keys(sources) },
		{ id: 'transitions', name: 'Transitions', definitions: Object.keys(transitions) },
		{ id: 'ui', name: 'General & Profiles', definitions: Object.keys(ui) },
	]

	return { presets, structure }
}
