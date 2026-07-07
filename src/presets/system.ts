import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import { baseStyle, styleCaution, styleAlert } from './style.js'

/** System stats, disk space, and window/projector example presets. */
export function getSystemPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions
	sections: CompanionPresetSection[]
} {
	const presets: CompanionPresetDefinitions = {}

	presets['cpuRamUsage'] = {
		type: 'simple',
		name: 'CPU/RAM Usage',
		style: baseStyle({ text: 'CPU:\n$(obs:cpu_usage)\nRAM:\n$(obs:memory_usage)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['cpuUsage'] = {
		type: 'simple',
		name: 'CPU Usage',
		style: baseStyle({ text: 'CPU:\n$(obs:cpu_usage)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['ramUsage'] = {
		type: 'simple',
		name: 'RAM Usage',
		style: baseStyle({ text: 'RAM:\n$(obs:memory_usage)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['fps'] = {
		type: 'simple',
		name: 'Frame Rate (FPS)',
		style: baseStyle({ text: 'FPS:\n$(obs:fps)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['renderTotalFrames'] = {
		type: 'simple',
		name: 'Render Total Frames',
		style: baseStyle({ text: 'Render Total:\n$(obs:render_total_frames)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['renderMissedFrames'] = {
		type: 'simple',
		name: 'Render Missed Frames',
		style: baseStyle({ text: 'Render Missed:\n$(obs:render_missed_frames)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['outputTotalFrames'] = {
		type: 'simple',
		name: 'Output Total Frames',
		style: baseStyle({ text: 'Output Total:\n$(obs:output_total_frames)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['outputSkippedFrames'] = {
		type: 'simple',
		name: 'Output Skipped Frames',
		style: baseStyle({ text: 'Output Skipped:\n$(obs:output_skipped_frames)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['averageFrameTime'] = {
		type: 'simple',
		name: 'Average Frame Time',
		style: baseStyle({ text: 'Avg Frame Time:\n$(obs:average_frame_time)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['remainingDiskSpace'] = {
		type: 'simple',
		name: 'Remaining Disk Space',
		style: baseStyle({ text: 'Disk Space:\n$(obs:free_disk_space)' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [
			{ feedbackId: 'freeDiskSpaceRemaining', options: { diskSpace: 50000 }, style: styleCaution() },
			{ feedbackId: 'freeDiskSpaceRemaining', options: { diskSpace: 10000 }, style: styleAlert() },
		],
	}

	// Example window/projector presets (set target options after dropping).
	presets['openMultiviewProjector'] = {
		type: 'simple',
		name: 'Open Multiview Projector (example)',
		style: baseStyle({ text: 'Open\nMultiview' }),
		steps: [
			{
				down: [{ actionId: 'open_projector', options: { type: 'Multiview', window: 'fullscreen', display: 0 } }],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['openSourceProperties'] = {
		type: 'simple',
		name: 'Open Source Properties (example)',
		style: baseStyle({ text: 'Source\nProperties' }),
		steps: [{ down: [{ actionId: 'openInputPropertiesDialog', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['openSourceFilters'] = {
		type: 'simple',
		name: 'Open Source Filters (example)',
		style: baseStyle({ text: 'Source\nFilters' }),
		steps: [{ down: [{ actionId: 'openInputFiltersDialog', options: {} }], up: [] }],
		feedbacks: [],
	}

	presets['openSourceInteract'] = {
		type: 'simple',
		name: 'Open Source Interact (example)',
		style: baseStyle({ text: 'Source\nInteract' }),
		steps: [{ down: [{ actionId: 'openInputInteractDialog', options: {} }], up: [] }],
		feedbacks: [],
	}

	const sections: CompanionPresetSection[] = [
		{
			id: 'system',
			name: 'System / Stats',
			definitions: [
				{
					id: 'system-stats',
					name: 'Stats',
					type: 'simple',
					presets: [
						'cpuRamUsage',
						'cpuUsage',
						'ramUsage',
						'fps',
						'renderTotalFrames',
						'renderMissedFrames',
						'outputTotalFrames',
						'outputSkippedFrames',
						'averageFrameTime',
					],
				},
				{ id: 'system-disk', name: 'Disk', type: 'simple', presets: ['remainingDiskSpace'] },
				{
					id: 'system-dialogs',
					name: 'Windows',
					type: 'simple',
					presets: ['openMultiviewProjector', 'openSourceProperties', 'openSourceFilters', 'openSourceInteract'],
				},
			],
		},
	]

	return { presets, sections }
}
