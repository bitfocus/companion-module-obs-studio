import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from './main.js'

import { getAudioFeedbacks, type AudioFeedbackSchemas } from './feedbacks/audio.js'
import { getMediaFeedbacks, type MediaFeedbackSchemas } from './feedbacks/media.js'
import { getOutputFeedbacks, type OutputFeedbackSchemas } from './feedbacks/outputs.js'
import { getSceneFeedbacks, type SceneFeedbackSchemas } from './feedbacks/scenes.js'
import { getSourceFeedbacks, type SourceFeedbackSchemas } from './feedbacks/sources.js'
import { getTransitionFeedbacks, type TransitionFeedbackSchemas } from './feedbacks/transitions.js'
import { getUiConfigCustomFeedbacks, type UiConfigCustomFeedbackSchemas } from './feedbacks/ui-config-custom.js'

/** The full set of feedback schemas, used as `InstanceTypes['feedbacks']`. */
export type OBSFeedbackSchemas = AudioFeedbackSchemas &
	MediaFeedbackSchemas &
	OutputFeedbackSchemas &
	SceneFeedbackSchemas &
	SourceFeedbackSchemas &
	TransitionFeedbackSchemas &
	UiConfigCustomFeedbackSchemas

/** Every feedback id the module defines. */
export type OBSFeedbackId = Extract<keyof OBSFeedbackSchemas, string>

export function getFeedbacks(this: OBSInstance): CompanionFeedbackDefinitions<OBSFeedbackSchemas> {
	return {
		...getAudioFeedbacks(this),
		...getMediaFeedbacks(this),
		...getOutputFeedbacks(this),
		...getSceneFeedbacks(this),
		...getSourceFeedbacks(this),
		...getTransitionFeedbacks(this),
		...getUiConfigCustomFeedbacks(this),
	}
}
