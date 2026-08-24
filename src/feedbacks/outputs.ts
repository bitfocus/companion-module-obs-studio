import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { Style, styleActive, styleProgram, styleWarn } from '../presets/style.js'
import { OBSRecordingState } from '../types.js'

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
			defaultStyle: styleActive(),
			options: [],
			callback: () => {
				return !!self.states.replayBuffer
			},
		},

		streamCongestion: {
			type: 'advanced',
			name: 'Streaming - Stream Congestion',
			description: 'Change the style of the button to show stream congestion',
			affectedProperties: ['bgcolor'],
			options: [
				{
					type: 'colorpicker',
					label: 'Background color (No Stream)',
					id: 'colorNoStream',
					default: Style.disabled,
				},
				{
					type: 'colorpicker',
					label: 'Background color (Low Congestion)',
					id: 'colorLow',
					default: Style.preview,
				},
				{
					type: 'colorpicker',
					label: 'Background color (Medium Congestion)',
					id: 'colorMedium',
					default: Style.warning,
				},
				{
					type: 'colorpicker',
					label: 'Background color (High Congestion)',
					id: 'colorHigh',
					default: Style.program,
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
