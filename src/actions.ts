import { CompanionActionDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'
import { getStudioModeTransitionActions } from './actions/studio-mode-transitions.js'
import { getRecordingStreamingActions } from './actions/recording-streaming.js'
import { getScenesSceneItemsActions } from './actions/scenes-scene-items.js'
import { getAudioActions } from './actions/audio.js'
import { getSourcesFiltersActions } from './actions/sources-filters.js'
import { getMediaActions } from './actions/media.js'
import { getUiConfigCustomActions } from './actions/ui-config-custom.js'

export function getActions(this: OBSInstance): CompanionActionDefinitions {
	return {
		...getStudioModeTransitionActions(this),
		...getRecordingStreamingActions(this),
		...getScenesSceneItemsActions(this),
		...getAudioActions(this),
		...getSourcesFiltersActions(this),
		...getMediaActions(this),
		...getUiConfigCustomActions(this),
	}
}
