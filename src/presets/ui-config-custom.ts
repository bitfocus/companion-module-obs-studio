import { CompanionPresetDefinitions } from '@companion-module/base'
import { Color } from '../utils.js'
import type OBSInstance from '../main.js'

export function getUiConfigCustomPresets(self: OBSInstance): CompanionPresetDefinitions {
	const presets: CompanionPresetDefinitions = {}

	presets['cpuRamUsage'] = {
		type: 'simple',
		name: 'CPU/RAM Usage',
		style: {
			text: 'CPU:\\n$(obs:cpu_usage)\\nRAM:\\n$(obs:memory_usage)',
			size: 'auto',
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
	presets['cpuUsage'] = {
		type: 'simple',
		name: 'CPU Usage',
		style: {
			text: 'CPU:\\n$(obs:cpu_usage)',
			size: 'auto',
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
	presets['ramUsage'] = {
		type: 'simple',
		name: 'RAM Usage',
		style: {
			text: 'RAM:\n$(obs:memory_usage)',
			size: 'auto',
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

	presets['renderTotalFrames'] = {
		type: 'simple',
		name: 'Render Total Frames',
		style: {
			text: 'Render Total Frames:\\n$(obs:render_total_frames)',
			size: 'auto',
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
	presets['renderMissedFrames'] = {
		type: 'simple',
		name: 'Render Missed Frames',
		style: {
			text: 'Render Missed Frames:\\n$(obs:render_missed_frames)',
			size: 'auto',
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
	presets['outputTotalFrames'] = {
		type: 'simple',
		name: 'Output Total Frames',
		style: {
			text: 'Output Total Frames:\\n$(obs:output_total_frames)',
			size: 'auto',
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
	presets['outputSkippedFrames'] = {
		type: 'simple',
		name: 'Output Skipped Frames',
		style: {
			text: 'Output Skipped Frames:\n$(obs:output_skipped_frames)',
			size: 'auto',
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
	presets['averageFrameTime'] = {
		type: 'simple',
		name: 'Average Frame Time',
		style: {
			text: 'Average Frame Time:\n$(obs:average_frame_time)',
			size: 'auto',
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

	presets['remainingDiskSpace'] = {
		type: 'simple',
		name: 'Remaining Disk Space',
		style: {
			text: 'Disk Space Remaining:\\n$(obs:free_disk_space)',
			size: 'auto',
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
		feedbacks: [
			{
				feedbackId: 'freeDiskSpaceRemaining',
				options: {
					diskSpace: 50000,
				},
				style: {
					bgcolor: Color.Yellow,
					color: Color.White,
				},
			},
			{
				feedbackId: 'freeDiskSpaceRemaining',
				options: {
					diskSpace: 10000,
				},
				style: {
					bgcolor: Color.Red,
					color: Color.White,
				},
			},
		],
	}

	presets['toggleStudioMode'] = {
		type: 'simple',
		name: 'Toggle Studio Mode',
		style: {
			text: 'ENABLE\\nStudio Mode',
			size: 'auto',
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'toggle_studio_mode',
						options: {},
					},
				],
				up: [],
			},
		],
		feedbacks: [
			{
				feedbackId: 'studioMode',
				options: {},
				style: {
					text: 'DISABLE\\nStudio Mode',
				},
			},
		],
	}

	presets['takeScreenshot'] = {
		type: 'simple',
		name: 'Take Screenshot',
		style: {
			text: 'Take Screenshot',
			size: 12,
			color: Color.White,
			bgcolor: Color.Black,
			show_topbar: false,
		},
		steps: [
			{
				down: [
					{
						actionId: 'take_screenshot',
						options: {
							format: 'png',
							compression: 0,
							source: 'programScene',
							customName: false,
							path: '',
							prefix: 'Screenshot_$(internal:date_iso)_$(internal:time_hms) ',
						},
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	for (const profile of self.obsState.profileChoices) {
		const profileName = profile.label.replace(/[^\w]/gi, '_')
		presets[`profile_${profileName}`] = {
			type: 'simple',
			name: profile.label,
			style: {
				text: profile.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_profile',
							options: {
								profile: profile.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'profile_active',
					options: {
						profile: profile.id,
					},
					style: {
						bgcolor: Color.Green,
						color: Color.White,
					},
				},
			],
		}
	}
	for (const sceneCollection of self.obsState.sceneCollectionList) {
		const sceneCollectionName = sceneCollection.label.replace(/[^\w]/gi, '_')
		presets[`sceneCollection_${sceneCollectionName}`] = {
			type: 'simple',
			name: sceneCollection.label,
			style: {
				text: sceneCollection.label,
				size: 'auto',
				color: Color.White,
				bgcolor: Color.Black,
				show_topbar: false,
			},
			steps: [
				{
					down: [
						{
							actionId: 'set_scene_collection',
							options: {
								scene_collection: sceneCollection.id,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [
				{
					feedbackId: 'scene_collection_active',
					options: {
						scene_collection: sceneCollection.id,
					},
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
