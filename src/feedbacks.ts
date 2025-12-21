import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from './main.js'
import { getRecordingStreamingOutputFeedbacks } from './feedbacks/recording-streaming-outputs.js'
import { getScenesSourcesFiltersFeedbacks } from './feedbacks/scenes-sources-filters.js'
import { getAudioFeedbacks } from './feedbacks/audio.js'
import { getMediaFeedbacks } from './feedbacks/media.js'
import { getUiConfigTransitionsFeedbacks } from './feedbacks/ui-config-transitions.js'

export function getFeedbacks(this: OBSInstance): CompanionFeedbackDefinitions {
	return {
		...getRecordingStreamingOutputFeedbacks(this),
		...getScenesSourcesFiltersFeedbacks(this),
		...getAudioFeedbacks(this),
		...getMediaFeedbacks(this),
		...getUiConfigTransitionsFeedbacks(this),
	}
}
