import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { styleActive, styleProgram, styleWarn } from '../presets/style.js'
import { OBSRecordingState } from '../types.js'
import { CONGESTION_MEDIOCRE } from '../constants.js'
import { choiceDropdown } from '../actions/options.js'

export type OutputFeedbackSchemas = {
	streaming: { type: 'boolean'; options: Record<string, never> }
	streamReconnecting: { type: 'boolean'; options: Record<string, never> }
	recording: { type: 'boolean'; options: Record<string, never> }
	recordingPaused: { type: 'boolean'; options: Record<string, never> }
	output_active: { type: 'boolean'; options: { output: string } }
	replayBufferActive: { type: 'boolean'; options: Record<string, never> }
	streamCongestionAbove: { type: 'boolean'; options: { threshold: number } }
	streamCongestionLevel: { type: 'value'; options: Record<string, never> }
}

export function getOutputFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<OutputFeedbackSchemas> {
	return {
		streaming: {
			type: 'boolean',
			name: 'Streaming - Active',
			description: 'If streaming is active, change the style of the button',
			defaultStyle: styleActive(),
			options: [],
			callback: () => {
				return !!self.states.streaming
			},
		},

		streamReconnecting: {
			type: 'boolean',
			name: 'Streaming - Reconnecting',
			description: 'If the stream is currently reconnecting, change the style of the button',
			defaultStyle: styleWarn(),
			options: [],
			callback: () => {
				return !!self.states.streamReconnecting
			},
		},

		recording: {
			type: 'boolean',
			name: 'Recording - Active',
			description: 'If recording is active, change the style of the button',
			defaultStyle: styleProgram(),
			options: [],
			callback: () => {
				return self.states.recording === OBSRecordingState.Recording
			},
		},

		recordingPaused: {
			type: 'boolean',
			name: 'Recording - Paused',
			description: 'If recording is paused, change the style of the button',
			defaultStyle: styleWarn(),
			options: [],
			callback: () => {
				return self.states.recording === OBSRecordingState.Paused
			},
		},

		output_active: {
			type: 'boolean',
			name: 'Output - Active',
			description: 'If an output is currently active, change the style of the button',
			defaultStyle: styleActive(),
			options: [choiceDropdown(self, 'output', { id: 'output', label: 'Output name' })],
			callback: (feedback) => {
				// Tell the API to keep polling output statuses while this feedback exists.
				self.obs.addOutputStatusSubscriber(feedback.id)
				return !!self.states.outputs.get(feedback.options.output)?.outputActive
			},
			unsubscribe: (feedback) => self.obs.removeOutputStatusSubscriber(feedback.id),
		},

		replayBufferActive: {
			type: 'boolean',
			name: 'Replay Buffer - Active',
			description: 'If the replay buffer is currently active, change the style of the button',
			defaultStyle: styleActive(),
			options: [],
			callback: () => {
				return !!self.states.replayBuffer
			},
		},

		streamCongestionAbove: {
			type: 'boolean',
			name: 'Streaming - Stream Congestion Above',
			description:
				'If stream congestion is above a threshold, change the style of the button. OBS treats 0 as excellent, up to 33 as good, up to 67 as mediocre, and above that as bad',
			defaultStyle: styleWarn(),
			options: [
				{
					type: 'number',
					label: 'Congestion threshold (0-100)',
					id: 'threshold',
					default: Math.round(CONGESTION_MEDIOCRE * 100),
					min: 0,
					max: 100,
					clampValues: true,
				},
			],
			callback: (feedback) => {
				if (!self.states.streaming) return false
				return self.states.streamCongestion * 100 > feedback.options.threshold
			},
		},

		streamCongestionLevel: {
			type: 'value',
			name: 'Streaming - Stream Congestion Level',
			description:
				'The current stream congestion, from 0 to 100, for use with a gauge or bar meter. OBS treats 0 as excellent, up to 33 as good, up to 67 as mediocre, and above that as bad. Reads 0 when not streaming',
			options: [],
			callback: () => {
				if (!self.states.streaming) return 0
				return Math.round(self.states.streamCongestion * 100)
			},
		},
	}
}
