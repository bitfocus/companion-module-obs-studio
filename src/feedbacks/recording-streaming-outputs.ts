import { CompanionFeedbackDefinitions, combineRgb } from '@companion-module/base'
import type { OBSInstance } from '../main.js'
import { RecordingState } from '../types.js'

export function getRecordingStreamingOutputFeedbacks(self: OBSInstance): CompanionFeedbackDefinitions {
	const feedbacks: CompanionFeedbackDefinitions = {}

	const ColorWhite = combineRgb(255, 255, 255)
	const ColorRed = combineRgb(200, 0, 0)
	const ColorGreen = combineRgb(0, 200, 0)
	const ColorOrange = combineRgb(255, 102, 0)
	const ColorGray = combineRgb(72, 72, 72)

	feedbacks['streaming'] = {
		type: 'boolean',
		name: 'Streaming Active',
		description: 'If streaming is active, change the style of the button',
		defaultStyle: {
			color: ColorWhite,
			bgcolor: ColorGreen,
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
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Recording)',
				id: 'bg',
				default: ColorRed,
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Paused)',
				id: 'fg_paused',
				default: ColorWhite,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Paused)',
				id: 'bg_paused',
				default: ColorOrange,
			},
		],
		callback: (feedback) => {
			if (self.states.recording === RecordingState.Recording) {
				return { color: feedback.options.fg as number, bgcolor: feedback.options.bg as number }
			} else if (self.states.recording === RecordingState.Paused) {
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
			color: ColorWhite,
			bgcolor: ColorGreen,
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
			color: ColorWhite,
			bgcolor: ColorRed,
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
				default: ColorGray,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Low Congestion)',
				id: 'colorLow',
				default: ColorGreen,
			},
			{
				type: 'colorpicker',
				label: 'Background color (Medium Congestion)',
				id: 'colorMedium',
				default: ColorOrange,
			},
			{
				type: 'colorpicker',
				label: 'Background color (High Congestion)',
				id: 'colorHigh',
				default: ColorRed,
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
