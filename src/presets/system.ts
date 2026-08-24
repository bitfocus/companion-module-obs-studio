import { CompanionPresetDefinitions, CompanionPresetSection } from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, styleCaution, styleAlert } from './style.js'

/** System stats, disk space, and window/projector example presets. */
export function getSystemPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	presets['cpuRamUsage'] = {
		type: 'simple',
		name: 'CPU/RAM Usage',
		style: baseStyle({ text: 'CPU:\n$(obs:cpu_usage) %\nRAM:\n$(obs:memory_usage) MB' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['cpuUsage'] = {
		type: 'simple',
		name: 'CPU Usage',
		style: baseStyle({ text: 'CPU:\n$(obs:cpu_usage) %' }),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['ramUsage'] = {
		type: 'simple',
		name: 'RAM Usage',
		style: baseStyle({ text: 'RAM:\n$(obs:memory_usage) MB' }),
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

	presets['videoSettings'] = {
		type: 'simple',
		name: 'Video Settings (Resolution / FPS)',
		style: baseStyle({
			text: 'Canvas:\n$(obs:base_resolution)\nOutput:\n$(obs:output_resolution)\n$(obs:target_framerate) fps',
		}),
		steps: [{ down: [], up: [] }],
		feedbacks: [],
	}

	presets['screenshotPath'] = {
		type: 'simple',
		name: 'Last Saved Screenshot Path',
		style: baseStyle({ text: 'Screenshot:\n$(obs:screenshot_saved_path)' }),
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

	presets['triggerHotkey'] = {
		type: 'simple',
		name: 'Trigger Hotkey by ID (example)',
		style: baseStyle({ text: 'Trigger\nHotkey' }),
		steps: [{ down: [{ actionId: 'trigger-hotkey', options: { id: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['triggerHotkeySequence'] = {
		type: 'simple',
		name: 'Trigger Hotkey by Key (example)',
		style: baseStyle({ text: 'Hotkey\nSequence' }),
		steps: [
			{
				down: [
					{
						actionId: 'trigger-hotkey-sequence',
						options: { keyId: '', keyShift: false, keyAlt: false, keyControl: false, keyCommand: false },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	// Example window/projector presets (set target options after dropping).
	presets['openMultiviewProjector'] = {
		type: 'simple',
		name: 'Open Multiview Projector (example)',
		style: baseStyle({ text: 'Open\nMultiview' }),
		steps: [
			{
				down: [
					{
						actionId: 'open_projector',
						options: { type: 'Multiview', window: 'fullscreen', display: 0, source: '', scene: '' },
					},
				],
				up: [],
			},
		],
		feedbacks: [],
	}

	presets['openSourceProperties'] = {
		type: 'simple',
		name: 'Open Source Properties (example)',
		style: baseStyle({ text: 'Source\nProperties' }),
		steps: [{ down: [{ actionId: 'openInputPropertiesDialog', options: { source: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['openSourceFilters'] = {
		type: 'simple',
		name: 'Open Source Filters (example)',
		style: baseStyle({ text: 'Source\nFilters' }),
		steps: [{ down: [{ actionId: 'openInputFiltersDialog', options: { source: '' } }], up: [] }],
		feedbacks: [],
	}

	presets['openSourceInteract'] = {
		type: 'simple',
		name: 'Open Source Interact (example)',
		style: baseStyle({ text: 'Source\nInteract' }),
		steps: [{ down: [{ actionId: 'openInputInteractDialog', options: { source: '' } }], up: [] }],
		feedbacks: [],
	}

	const sections: CompanionPresetSection<OBSInstanceTypes>[] = [
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
						'videoSettings',
					],
				},
				{ id: 'system-disk', name: 'Disk', type: 'simple', presets: ['remainingDiskSpace', 'screenshotPath'] },
				{
					id: 'system-dialogs',
					name: 'Open OBS UI Windows',
					type: 'simple',
					presets: ['openMultiviewProjector', 'openSourceProperties', 'openSourceFilters', 'openSourceInteract'],
				},
				{
					id: 'system-hotkeys',
					name: 'Hotkeys',
					type: 'simple',
					presets: ['triggerHotkey', 'triggerHotkeySequence'],
				},
			],
		},
	]

	return { presets, sections }
}
