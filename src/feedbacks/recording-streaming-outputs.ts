import { CompanionFeedbackDefinitions } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { OBSRecordingState } from '../types.js'
import { Color } from '../utils.js'

export function getRecordingStreamingOutputFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	feedbacks['streaming'] = {
		type: 'boolean',
		name: 'Streaming Active',
		description: 'If streaming is active, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [],
		callback: () => {
			return !!self.states.streaming
		},
	}

	feedbacks['recording'] = {
		type: 'advanced',
		name: 'Recording Status',
		description: 'If recording is active or paused, change the style of the button',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color (Recording)',
				id: 'fg',
				default: Color.White,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Recording)',
				id: 'bg',
				default: Color.Red,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Paused)',
				id: 'fg_paused',
				default: Color.White,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Paused)',
				id: 'bg_paused',
				default: Color.Orange,
			},
		],
		callback: (feedback) => {
			if (self.states.recording === OBSRecordingState.Recording) {
				return { color: feedback.options.fg as number, bgcolor: feedback.options.bg as number }
			} else if (self.states.recording === OBSRecordingState.Paused) {
				return { color: feedback.options.fg_paused as number, bgcolor: feedback.options.bg_paused as number }
			} else {
				return {}
			}
		},
	}

	feedbacks['output_active'] = {
		type: 'boolean',
		name: 'Output Active',
		description: 'If an output is currently active, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Green,
		},
		options: [
			{
				type: 'dropdown',
				label: 'Output name',
				id: 'output',
				default: 'virtualcam_output',
				choices: self.obsState.outputList,
			},
		],
		callback: (feedback) => {
			return !!self.states.outputs.get(feedback.options.output as string)?.outputActive
		},
	}

	feedbacks['replayBufferActive'] = {
		type: 'boolean',
		name: 'Replay Buffer Active',
		description: 'If the replay buffer is currently active, change the style of the button',
		defaultStyle: {
			color: Color.White,
			bgcolor: Color.Red,
		},
		options: [],
		callback: () => {
			return !!self.states.replayBuffer
		},
	}

	feedbacks['streamCongestion'] = {
		type: 'advanced',
		name: 'Stream Congestion',
		description: 'Change the style of the button to show stream congestion',
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
				return { bgcolor: feedback.options.colorNoStream as number }
			} else {
				if (self.states.streamCongestion > 0.8) {
					return { bgcolor: feedback.options.colorHigh as number }
				} else if (self.states.streamCongestion > 0.4) {
					return { bgcolor: feedback.options.colorMedium as number }
				} else {
					return { bgcolor: feedback.options.colorLow as number }
				}
			}
		},
	}

	return feedbacks
}
