import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type OBSInstance from '../main.js'

export function getTransitionPresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	presets['transitionAuto'] = {
		type: 'simple',
		name: 'Send previewed scene to program',
		style: {
			text: 'AUTO',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'do_transition',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'transition_active',
				options: {},
				style: {
					bgcolor: Color.Green,
					color: Color.White,
				},
			},
		],
	}
	presets['transitionCurrentInfo'] = {
		type: 'simple',
		name: 'Current Transition Info',
		style: {
			text: 'Current Transition $(obs:current_transition)\\n$(obs:transition_duration)ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (let time = 500; time < 5100; time += 500) {
		presets[`transitionDurationSet${time}`] = {
			type: 'simple',
			name: `Transition Set ${time}ms`,
			style: {
				text: `${time}ms`,
				size: '14',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_transition_duration',
							options: {
								duration: time,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'transition_duration',
					options: {
						duration: time,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	presets['transitionDecreaseDuration'] = {
		type: 'simple',
		name: 'Decrease transition time',
		style: {
			text: 'Adjust Duration\\n-50ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_transition_duration',
						options: {
							amount: -50,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['transitionDuration'] = {
		type: 'simple',
		name: 'Current Duration',
		style: {
			text: 'Current Duration $(obs:transition_duration)ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['transitionIncreaseDuration'] = {
		type: 'simple',
		name: 'Increase transition time',
		style: {
			text: 'Adjust Duration\\n+50ms',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjust_transition_duration',
						options: {
							amount: 50,
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const transition of self.obsState.transitionList) {
		presets[`setTransition_${transition.id}`] = {
			type: 'simple',
			name: transition.label,
			style: {
				text: transition.label,
				size: 14,
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_transition_type',
							options: {
								transitions: transition.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'current_transition',
					options: {
						transition: transition.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	presets['transitionPrevious'] = {
		type: 'simple',
		name: 'Previous Transition',
		style: {
			text: 'Previous Transition',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjustTransitionType',
						options: {
							adjust: 'previous',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['transitionAdjustCurrent'] = {
		type: 'simple',
		name: 'Current Transition',
		style: {
			text: 'Current Transition $(obs:current_transition)',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [],
				up: [],
			},
		],
		feedbacks: [],
	}
	presets['transitionNext'] = {
		type: 'simple',
		name: 'Next Transition',
		style: {
			text: 'Next Transition',
			size: '14',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'adjustTransitionType',
						options: {
							adjust: 'next',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const transition of self.obsState.transitionList) {
		presets[`quickTransition_${transition.id}`] = {
			type: 'simple',
			name: transition.label,
			style: {
				text: transition.label,
				size: 14,
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'quick_transition',
							options: {
								transition: transition.id,
								customDuration: false,
								transition_time: 500,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'transition_active',
					options: {},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}

	return presets
}
