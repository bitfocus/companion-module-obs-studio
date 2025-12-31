import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'

import { getAudioFeedbacks } from './feedbacks/audio.js'
import { getMediaFeedbacks } from './feedbacks/media.js'
import { getOutputFeedbacks } from './feedbacks/outputs.js'
import { getSceneFeedbacks } from './feedbacks/scenes.js'
import { getSourceFeedbacks } from './feedbacks/sources.js'
import { getTransitionFeedbacks } from './feedbacks/transitions.js'
import { getUiConfigCustomFeedbacks } from './feedbacks/ui-config-custom.js'

export function getFeedbacks(this: OBSInstance): CompanionFeedbackDefinitions {
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
