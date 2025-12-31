import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'

import { getAudioActions } from './actions/audio.js'
import { getMediaActions } from './actions/media.js'
import { getOutputActions } from './actions/outputs.js'
import { getSceneActions } from './actions/scenes.js'
import { getSourceActions } from './actions/sources.js'
import { getTransitionActions } from './actions/transitions.js'
import { getUiConfigCustomActions } from './actions/ui-config-custom.js'

export function getActions(this: OBSInstance): CompanionActionDefinitions {
	return {
		...getAudioActions(this),
		...getMediaActions(this),
		...getOutputActions(this),
		...getSceneActions(this),
		...getSourceActions(this),
		...getTransitionActions(this),
		...getUiConfigCustomActions(this),
	}
}
