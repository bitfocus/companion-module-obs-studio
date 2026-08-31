import { CompanionActionDefinitions } from '@companion-module/base'
import type OBSInstance from './main.js'

import { getAudioActions, type AudioActionSchemas } from './actions/audio.js'
import { getMediaActions, type MediaActionSchemas } from './actions/media.js'
import { getOutputActions, type OutputActionSchemas } from './actions/outputs.js'
import { getSceneActions, type SceneActionSchemas } from './actions/scenes.js'
import { getSourceActions, type SourceActionSchemas } from './actions/sources.js'
import { getTransitionActions, type TransitionActionSchemas } from './actions/transitions.js'
import { getUiConfigCustomActions, type UiConfigCustomActionSchemas } from './actions/ui-config-custom.js'

/** The full set of action schemas, used as `InstanceTypes['actions']`. */
export type OBSActionSchemas = AudioActionSchemas &
	MediaActionSchemas &
	OutputActionSchemas &
	SceneActionSchemas &
	SourceActionSchemas &
	TransitionActionSchemas &
	UiConfigCustomActionSchemas

export function getActions(this: OBSInstance): CompanionActionDefinitions<OBSActionSchemas> {
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
