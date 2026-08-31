import {
	ButtonGraphicsDecorationType,
	CompanionPresetDefinitions,
	CompanionPresetSection,
} from '@companion-module/base'
import type OBSInstance from '../main.js'
import type { OBSInstanceTypes } from '../main.js'
import { baseStyle, Style, styleCaution, styleAlert } from './style.js'

/** System stats, disk space, and window/projector example presets. */
export function getSystemPresets(_self: OBSInstance): {
	presets: CompanionPresetDefinitions<OBSInstanceTypes>
	sections: CompanionPresetSection<OBSInstanceTypes>[]
} {
	const presets: CompanionPresetDefinitions<OBSInstanceTypes> = {}

	// Percentage-of-total expressions, guarded against the divide-by-zero before OBS reports any frames.
	const missedPercent = `$(obs:render_total_frames) > 0 ? ($(obs:render_missed_frames) / $(obs:render_total_frames)) * 100 : 0`
	const skippedPercent = `$(obs:output_total_frames) > 0 ? ($(obs:output_skipped_frames) / $(obs:output_total_frames)) * 100 : 0`

	// CPU is already a percentage, so the gauge needs no scaling. Stops mirror the usual headroom advice.
	const loadStops = [
		{ value: 0, color: Style.preview, gradient: false },
		{ value: 50, color: Style.caution, gradient: false },
		{ value: 80, color: Style.program, gradient: false },
	]

	presets['systemStats'] = {
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				name: 'System Stats',
				keywords: ['cpu', 'ram', 'memory', 'fps', 'performance'],
				canvas: { decoration: ButtonGraphicsDecorationType.None },
				elements: [
					{
						type: 'box',
						id: 'background',
						name: 'Background',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: Style.idleBg,
					},
					{
						type: 'text',
						id: 'cpu',
						name: 'CPU',
						x: 2,
						y: 2,
						width: 96,
						height: 24,
						text: 'CPU $(obs:cpu_usage)%',
						fontsize: 95,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'gauge',
						id: 'cpuBar',
						name: 'CPU Load',
						x: 6,
						y: 30,
						width: 88,
						height: 12,
						orientation: 'horizontal',
						value: { value: '$(obs:cpu_usage)', isExpression: true },
						min: 0,
						max: 100,
						fillEnabled: true,
						multiColour: true,
						trackStyle: 'dimmed',
						stops: loadStops,
					},
					{
						type: 'text',
						id: 'ram',
						name: 'RAM',
						x: 2,
						y: 46,
						width: 96,
						height: 24,
						text: 'RAM $(obs:memory_usage) MB',
						fontsize: 85,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'text',
						id: 'fps',
						name: 'FPS',
						x: 2,
						y: 72,
						width: 96,
						height: 24,
						text: '$(obs:fps) FPS',
						fontsize: 85,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
			{
				type: 'simple',
				name: 'System Stats',
				keywords: ['cpu', 'ram', 'memory', 'fps', 'performance'],
				style: baseStyle({ text: 'CPU: $(obs:cpu_usage)%\nRAM: $(obs:memory_usage) MB\n$(obs:fps) FPS' }),
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
		],
	}

	presets['cpuGauge'] = {
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				name: 'CPU Usage Gauge',
				keywords: ['cpu', 'load', 'performance'],
				canvas: { decoration: ButtonGraphicsDecorationType.None },
				elements: [
					{
						type: 'box',
						id: 'background',
						name: 'Background',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: Style.idleBg,
					},
					{
						type: 'gauge',
						id: 'cpu',
						name: 'CPU Load',
						x: 6,
						y: 6,
						width: 88,
						height: 88,
						orientation: 'ring',
						startAngle: 135,
						endAngle: 45,
						ringWidth: 12,
						roundedEnds: true,
						value: { value: '$(obs:cpu_usage)', isExpression: true },
						min: 0,
						max: 100,
						fillEnabled: true,
						multiColour: true,
						trackStyle: 'dimmed',
						stops: loadStops,
					},
					{
						type: 'text',
						id: 'label',
						name: 'Label',
						x: 22,
						y: 28,
						width: 56,
						height: 22,
						text: 'CPU',
						fontsize: 75,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'text',
						id: 'value',
						name: 'Value',
						x: 22,
						y: 50,
						width: 56,
						height: 26,
						text: '$(obs:cpu_usage)%',
						fontsize: 95,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
			{
				type: 'simple',
				name: 'CPU Usage Gauge',
				keywords: ['cpu', 'load', 'performance'],
				style: baseStyle({ text: 'CPU:\n$(obs:cpu_usage) %' }),
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
		],
	}

	// Dropped frames are the first thing to check when OBS misbehaves: rendering lag on the left, encoder
	// lag on the right. Anything past ~1% is worth acting on, which is where the bars turn red.
	presets['frameHealth'] = {
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				name: 'Frame Health',
				keywords: ['dropped', 'missed', 'skipped', 'lag', 'encoder', 'render'],
				canvas: { decoration: ButtonGraphicsDecorationType.None },
				elements: [
					{
						type: 'box',
						id: 'background',
						name: 'Background',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: Style.idleBg,
					},
					{
						type: 'text',
						id: 'label',
						name: 'Label',
						x: 2,
						y: 2,
						width: 96,
						height: 22,
						text: 'Dropped',
						fontsize: 90,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'text',
						id: 'renderLabel',
						name: 'Render Label',
						x: 2,
						y: 28,
						width: 30,
						height: 20,
						text: 'Render',
						fontsize: 80,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'left',
						valign: 'center',
					},
					{
						type: 'text',
						id: 'renderValue',
						name: 'Render Value',
						x: 34,
						y: 28,
						width: 64,
						height: 20,
						text: {
							value: `concat(round(${missedPercent} * 10) / 10, "% (", $(obs:render_missed_frames), ")")`,
							isExpression: true,
						},
						fontsize: 80,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'right',
						valign: 'center',
					},
					{
						type: 'gauge',
						id: 'renderBar',
						name: 'Render Lag',
						x: 4,
						y: 50,
						width: 92,
						height: 8,
						orientation: 'horizontal',
						value: { value: missedPercent, isExpression: true },
						min: 0,
						max: 5,
						fillEnabled: true,
						multiColour: true,
						trackStyle: 'dimmed',
						stops: [
							{ value: 0, color: Style.preview, gradient: false },
							{ value: 1, color: Style.program, gradient: false },
						],
					},
					{
						type: 'text',
						id: 'encoderLabel',
						name: 'Encoder Label',
						x: 2,
						y: 64,
						width: 32,
						height: 20,
						text: 'Encode',
						fontsize: 80,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'left',
						valign: 'center',
					},
					{
						type: 'text',
						id: 'encoderValue',
						name: 'Encoder Value',
						x: 36,
						y: 64,
						width: 62,
						height: 20,
						text: {
							value: `concat(round(${skippedPercent} * 10) / 10, "% (", $(obs:output_skipped_frames), ")")`,
							isExpression: true,
						},
						fontsize: 80,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'right',
						valign: 'center',
					},
					{
						type: 'gauge',
						id: 'encoderBar',
						name: 'Encoder Lag',
						x: 4,
						y: 86,
						width: 92,
						height: 8,
						orientation: 'horizontal',
						value: { value: skippedPercent, isExpression: true },
						min: 0,
						max: 5,
						fillEnabled: true,
						multiColour: true,
						trackStyle: 'dimmed',
						stops: [
							{ value: 0, color: Style.preview, gradient: false },
							{ value: 1, color: Style.program, gradient: false },
						],
					},
				],
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
			{
				type: 'simple',
				name: 'Frame Health',
				keywords: ['dropped', 'missed', 'skipped', 'lag', 'encoder', 'render'],
				style: baseStyle({
					text: 'Dropped:\nRender $(obs:render_missed_frames)\nEncode $(obs:output_skipped_frames)',
				}),
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
		],
	}

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
			text: 'Canvas:\n$(obs:base_resolution)\nOutput:\n$(obs:output_resolution)\n$(obs:target_framerate)',
			size: 'auto',
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
		type: 'alternatives',
		variants: [
			{
				type: 'layered',
				name: 'Remaining Disk Space',
				keywords: ['storage', 'drive', 'free space'],
				canvas: { decoration: ButtonGraphicsDecorationType.None },
				localVariables: [
					{
						variableType: 'feedback',
						variableName: 'low',
						feedbackId: 'freeDiskSpaceRemaining',
						options: { diskSpace: 50000 },
						headline: 'Below 50 GB',
					},
					{
						variableType: 'feedback',
						variableName: 'critical',
						feedbackId: 'freeDiskSpaceRemaining',
						options: { diskSpace: 10000 },
						headline: 'Below 10 GB',
					},
				],
				elements: [
					{
						type: 'box',
						id: 'background',
						name: 'Background',
						x: 0,
						y: 0,
						width: 100,
						height: 100,
						color: Style.idleBg,
					},
					{
						type: 'text',
						id: 'label',
						name: 'Label',
						x: 2,
						y: 10,
						width: 96,
						height: 26,
						text: 'Disk Space',
						fontsize: 85,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
					{
						type: 'circle',
						id: 'dot',
						name: 'Warning Dot',
						x: 6,
						y: 54,
						width: 20,
						height: 20,
						color: {
							value: `$(local:critical) ? ${Style.alert} : $(local:low) ? ${Style.caution} : ${Style.preview}`,
							isExpression: true,
						},
					},
					{
						type: 'text',
						id: 'free',
						name: 'Free Space',
						x: 28,
						y: 50,
						width: 70,
						height: 28,
						text: '$(obs:free_disk_space)',
						fontsize: 95,
						fontsizeAllowShrink: true,
						color: Style.idleFg,
						halign: 'center',
						valign: 'center',
					},
				],
				steps: [{ down: [], up: [] }],
				feedbacks: [],
			},
			{
				type: 'simple',
				keywords: ['storage', 'drive', 'free space'],
				name: 'Remaining Disk Space',
				style: baseStyle({ text: 'Disk Space:\n$(obs:free_disk_space)' }),
				steps: [{ down: [], up: [] }],
				feedbacks: [
					{ feedbackId: 'freeDiskSpaceRemaining', options: { diskSpace: 50000 }, style: styleCaution() },
					{ feedbackId: 'freeDiskSpaceRemaining', options: { diskSpace: 10000 }, style: styleAlert() },
				],
			},
		],
	}

	presets['triggerHotkey'] = {
		type: 'simple',
		keywords: ['keyboard', 'shortcut'],
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
		keywords: ['multiview', 'fullscreen', 'display'],
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
			keywords: ['stats', 'cpu', 'ram', 'memory', 'fps', 'frames', 'disk', 'hotkey', 'projector'],
			definitions: [
				{
					id: 'system-stats',
					name: 'Stats',
					type: 'simple',
					presets: [
						'systemStats',
						'cpuGauge',
						'frameHealth',
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
