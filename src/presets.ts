import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from './main.js'

import { getScenePresets } from './presets/scenes.js'
import { getTransitionPresets } from './presets/transitions.js'
import { getAudioPresets } from './presets/audio.js'
import { getMediaPresets } from './presets/media.js'
import { getSourcePresets } from './presets/sources.js'
import { getRecordingPresets } from './presets/recording.js'
import { getStreamingPresets } from './presets/streaming.js'
import { getReplayPresets } from './presets/replay.js'
import { getOutputPresets } from './presets/outputs.js'
import { getStudioConfigPresets } from './presets/studio-config.js'
import { getSystemPresets } from './presets/system.js'

export function getPresets(this: OBSInstance): {
	presets: CompanionPresetDefinitions
	structure: CompanionPresetSection[]
} {
	// Each module owns its preset definitions AND the section(s) that arrange them
	// (as section -> group -> template/preset). Assemble both halves here.
	const parts = [
		getRecordingPresets(this),
		getStreamingPresets(this),
		getScenePresets(this),
		getTransitionPresets(this),
		getSourcePresets(this),
		getAudioPresets(this),
		getMediaPresets(this),
		getReplayPresets(this),
		getOutputPresets(this),
		getStudioConfigPresets(this),
		getSystemPresets(this),
	]

	const presets: CompanionPresetDefinitions = Object.assign({}, ...parts.map((p) => p.presets))
	const structure: CompanionPresetSection[] = parts.flatMap((p) => p.sections)

	return { presets, structure }
}
