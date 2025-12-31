import { CompanionPresetDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'

import { getSourcePresets } from './presets/sources.js'
import { getScenePresets } from './presets/scenes.js'
import { getTransitionPresets } from './presets/transitions.js'
import { getAudioPresets } from './presets/audio.js'
import { getMediaPresets } from './presets/media.js'
import { getOutputPresets } from './presets/outputs.js'
import { getUiConfigCustomPresets } from './presets/ui-config-custom.js'

export function getPresets(this: OBSInstance): CompanionPresetDefinitions {
	return {
		...getAudioPresets(this),
		...getMediaPresets(this),
		...getOutputPresets(this),
		...getScenePresets(this),
		...getSourcePresets(this),
		...getTransitionPresets(this),
		...getUiConfigCustomPresets(this),
	}
}
