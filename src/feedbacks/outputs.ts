import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { OBSRecordingState } from '../types.js'
import { Color } from '../utils.js'

export type OutputFeedbackSchemas = {
	streaming: { type: 'boolean'; options: Record<string, never> }
	streamReconnecting: { type: 'boolean'; options: Record<string, never> }
	recording: { type: 'boolean'; options: Record<string, never> }
	recordingPaused: { type: 'boolean'; options: Record<string, never> }
	output_active: { type: 'boolean'; options: { output: string } }
	replayBufferActive: { type: 'boolean'; options: Record<string, never> }
	streamCongestion: {
		type: 'advanced'
		options: { colorNoStream: number; colorLow: number; colorMedium: number; colorHigh: number }
	}
}

export function getOutputFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions<OutputFeedbackSchemas> {
	return {
		streaming: {
			type: 'boolean',
			name: 'Streaming - Active',
			description: 'If streaming is active, change the style of the button',
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Green,
			},
			options: [],
			callback: () => {
				return !!self.states.streaming
			},
		},

		streamReconnecting: {
			type: 'boolean',
			name: 'Streaming - Reconnecting',
			description: 'If the stream is currently reconnecting, change the style of the button',
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Orange,
			},
			options: [],
			callback: () => {
				return !!self.states.streamReconnecting
			},
		},

		recording: {
			type: 'boolean',
			name: 'Recording - Active',
			description: 'If recording is active, change the style of the button',
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Red,
			},
			options: [],
			callback: () => {
				return self.states.recording === OBSRecordingState.Recording
			},
		},

		recordingPaused: {
			type: 'boolean',
			name: 'Recording - Paused',
			description: 'If recording is paused, change the style of the button',
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Orange,
			},
			options: [],
			callback: () => {
				return self.states.recording === OBSRecordingState.Paused
			},
		},

		output_active: {
			type: 'boolean',
			name: 'Output - Active',
			description: 'If an output is currently active, change the style of the button',
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Green,
			},
			options: [
				{
					type: 'dropdown',
					allowCustom: true,
					label: 'Output name',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.obsState.outputList,
				},
			],
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
			defaultStyle: {
				color: Color.White,
				bgcolor: Color.Red,
			},
			options: [],
			callback: () => {
				return !!self.states.replayBuffer
			},
		},

		streamCongestion: {
			type: 'advanced',
			name: 'Stream Congestion',
			description: 'Change the style of the button to show stream congestion',
			affectedProperties: ['bgcolor'],
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (No Stream)',
					id: 'colorNoStream',
					default: Color.Gray,
				},
				{
					type: 'colorpicker',
					label: 'Background color (Low Congestion)',
					id: 'colorLow',
					default: Color.Green,
				},
				{
					type: 'colorpicker',
					label: 'Background color (Medium Congestion)',
					id: 'colorMedium',
					default: Color.Orange,
				},
				{
					type: 'colorpicker',
					label: 'Background color (High Congestion)',
					id: 'colorHigh',
					default: Color.Red,
				},
			],
			callback: (feedback) => {
				if (self.states.streaming === false) {
					return { bgcolor: feedback.options.colorNoStream }
				} else {
					if (self.states.streamCongestion > 0.8) {
						return { bgcolor: feedback.options.colorHigh }
					} else if (self.states.streamCongestion > 0.4) {
						return { bgcolor: feedback.options.colorMedium }
					} else {
						return { bgcolor: feedback.options.colorLow }
					}
				}
			},
		},
	}
}
