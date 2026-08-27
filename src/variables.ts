import type OBSInstance from './main.js'
import type {
	CompanionVariableDefinitions,
	CompanionVariableValue,
	CompanionVariableValues,
} from '@companion-module/base'
import type { OBSScene, OBSSource } from './types.js'
import * as utils from './utils.js'
import {
	INPUT_KIND_FFMPEG_SOURCE,
	INPUT_KIND_IMAGE_SOURCE,
	INPUT_KIND_VLC_SOURCE,
	VIRTUALCAM_OUTPUT_NAME,
} from './constants.js'

type VariableValue = string | number | boolean | (string | number)[] | undefined

interface VariableEntry {
	id: string
	name: string
	value: VariableValue
}

// Single source of truth for per-source variable definitions and values.
function sourceVariableEntries(source: OBSSource): VariableEntry[] {
	const entries: VariableEntry[] = []
	const sourceName = source.validName
	const settings = source.settings

	switch (source.inputKind) {
		case 'text_ft2_source_v2':
		case 'text_gdiplus_v2':
		case 'text_gdiplus_v3': {
			const text = utils.readTextSourceValue(settings)
			entries.push({ id: `current_text_${sourceName}`, name: `${sourceName} - Current text`, value: text })
			break
		}
		case INPUT_KIND_FFMPEG_SOURCE:
		case INPUT_KIND_VLC_SOURCE: {
			const file = utils.readMediaFileName(settings)
			entries.push(
				{
					id: `media_status_${sourceName}`,
					name: `${sourceName} - Media status`,
					value: utils.getOBSMediaStatusLabel(source.OBSMediaStatus),
				},
				{ id: `media_file_name_${sourceName}`, name: `${sourceName} - Media file name`, value: file },
				{
					id: `media_time_elapsed_${sourceName}`,
					name: `${sourceName} - Time elapsed`,
					value: source.timeElapsed ?? '00:00:00',
				},
				{
					id: `media_time_remaining_${sourceName}`,
					name: `${sourceName} - Time remaining`,
					value: source.timeRemaining ?? '00:00:00',
				},
			)
			break
		}
		case INPUT_KIND_IMAGE_SOURCE:
			entries.push({
				id: `image_file_name_${sourceName}`,
				name: `${sourceName} - Image file name`,
				value: utils.extractFileName(settings?.file),
			})
			break
		default:
			break
	}

	// Game Capture (and similar) sources report mute/volume but never populate inputAudioTracks,
	// so those two are gated separately to still expose variables for them.
	if (source.inputMuted !== undefined || source.inputVolume !== undefined) {
		entries.push(
			{
				id: `volume_${sourceName}`,
				name: `${sourceName} - Volume (dB)`,
				value: source.inputVolume,
			},
			{
				id: `mute_${sourceName}`,
				name: `${sourceName} - Mute status`,
				value: source.inputMuted !== undefined ? (source.inputMuted ? 'Muted' : 'Unmuted') : '',
			},
		)
	}

	if (source.inputAudioTracks) {
		entries.push(
			{
				id: `monitor_${sourceName}`,
				name: `${sourceName} - Audio monitor`,
				value: utils.getMonitorTypeLabel(source.monitorType),
			},
			{
				id: `monitor_active_${sourceName}`,
				name: `${sourceName} - Audio monitoring enabled`,
				value: utils.isMonitoringEnabled(source.monitorType),
			},
			{
				id: `sync_offset_${sourceName}`,
				name: `${sourceName} - Sync offset (ms)`,
				value: source.inputAudioSyncOffset,
			},
			{
				id: `balance_${sourceName}`,
				name: `${sourceName} - Audio balance`,
				value: source.inputAudioBalance !== undefined ? source.inputAudioBalance : '',
			},
			{
				id: `tracks_${sourceName}`,
				name: `${sourceName} - Active audio mixer tracks`,
				value: utils.activeAudioTracks(source.inputAudioTracks),
			},
		)
	}

	entries.push({
		id: `source_active_${sourceName}`,
		name: `${sourceName} - Active in program output`,
		value: source.active,
	})

	return entries
}

// Walk scene list back-to-front (top-most OBS scene is scene_1).
function sceneVariableEntries(scenes: OBSScene[]): VariableEntry[] {
	const entries: VariableEntry[] = []
	let index = 0
	for (let s = scenes.length - 1; s >= 0; s--) {
		index++
		entries.push({ id: `scene_${index}`, name: `Scene Position ${index} - Name`, value: scenes[s].sceneName })
	}
	return entries
}

function dynamicVariableEntries(self: OBSInstance): VariableEntry[] {
	const entries: VariableEntry[] = []
	for (const source of self.states.sources.values()) {
		entries.push(...sourceVariableEntries(source))
	}
	entries.push(...sceneVariableEntries(Array.from(self.states.scenes.values())))
	return entries
}

export function getVariables(this: OBSInstance): CompanionVariableDefinitions {
	const variables: CompanionVariableDefinitions = {
		base_resolution: { name: 'Current base (canvas) resolution' },
		output_resolution: { name: 'Current output (scaled) resolution' },
		target_framerate: { name: 'Current profile framerate' },
		fps: { name: 'Current actual framerate' },
		cpu_usage: { name: 'Current CPU usage (%)' },
		memory_usage: { name: 'Current RAM usage (MB)' },
		free_disk_space: { name: 'Free recording disk space' },
		free_disk_space_mb: { name: 'Free recording disk space in MB, with no unit text' },
		render_missed_frames: { name: 'Number of frames missed due to rendering lag' },
		render_total_frames: { name: 'Number of frames rendered' },
		output_skipped_frames: { name: 'Number of encoder frames skipped' },
		output_total_frames: { name: 'Number of total encoder frames' },
		stream_output_skipped_frames: { name: 'Number of frames skipped by the current stream' },
		stream_output_total_frames: { name: 'Number of total frames for the current stream' },
		average_frame_time: { name: 'Average frame time (in milliseconds)' },
		recording: { name: 'Recording State' },
		recording_file_name: { name: 'File name of the last completed recording' },
		recording_path: { name: 'File path of current recording' },
		recording_timecode: { name: 'Recording timecode (hh:mm:ss)' },
		recording_timecode_hh: { name: 'Recording timecode (hours)' },
		recording_timecode_mm: { name: 'Recording timecode (minutes)' },
		recording_timecode_ss: { name: 'Recording timecode (seconds)' },
		stream_timecode: { name: 'Stream Timecode (hh:mm:ss)' },
		stream_timecode_hh: { name: 'Stream Timecode (hours)' },
		stream_timecode_mm: { name: 'Stream Timecode (minutes)' },
		stream_timecode_ss: { name: 'Stream Timecode (seconds)' },
		stream_service: { name: 'Stream Service' },
		streaming: { name: 'Streaming State' },
		kbits_per_sec: { name: 'Stream output in kilobits per second' },
		scene_active: { name: 'Current active scene' },
		scene_preview: { name: 'Current preview scene' },
		scene_previous: { name: 'Previously active scene, before the current scene' },
		profile: { name: 'Current profile' },
		scene_collection: { name: 'Current scene collection' },
		current_transition: { name: 'Current transition' },
		transition_duration: { name: 'Current transition duration (ms)' },
		transition_active: { name: 'Transition in progress' },
		transition_list: { name: 'List of available transition types' },
		audio_source_list: { name: 'List of audio sources' },
		current_media_name: { name: 'Source name(s) for currently playing media source(s)' },
		current_media_time_elapsed: { name: 'Elapsed time(s) for currently playing media source(s)' },
		current_media_time_remaining: { name: 'Remaining time(s) for currently playing media source(s)' },
		replay_buffer_path: { name: 'File path of the last replay buffer saved' },
		replay_buffer_active: { name: 'Replay buffer is active' },
		virtualcam_active: { name: 'Virtual camera is active' },
		studio_mode: { name: 'Studio mode is active' },
		screenshot_saved_path: { name: 'File path of the last saved screenshot' },
		custom_command_type: { name: 'Latest Custom Command type sent to obs-websocket' },
		custom_command_request: { name: 'Latest Custom Command request data sent to obs-websocket' },
		custom_command_response: { name: 'Latest response from obs-websocket after using the Custom Command action' },
		vendor_event_name: { name: 'Vendor name of the latest Vendor Event received from obs-websocket' },
		vendor_event_type: { name: 'Latest Vendor Event type received from obs-websocket' },
		vendor_event_data: { name: 'Latest Vendor Event data received from obs-websocket' },
	}

	for (const entry of dynamicVariableEntries(this)) {
		variables[entry.id] = { name: entry.name }
	}

	return variables
}

export function updateVariableValues(this: OBSInstance): void {
	const updates: Record<string, VariableValue> = {
		recording: 'Unknown',
		recording_file_name: 'None',
		recording_path: 'None',
		recording_timecode: '00:00:00',
		recording_timecode_hh: '00',
		recording_timecode_mm: '00',
		recording_timecode_ss: '00',
		stream_timecode: '00:00:00',
		stream_timecode_hh: '00',
		stream_timecode_mm: '00',
		stream_timecode_ss: '00',
		stream_service: 'None',
		streaming: 'Off-Air',
		kbits_per_sec: 0,
		stream_output_skipped_frames: 0,
		stream_output_total_frames: 0,
		current_media_name: [],
		replay_buffer_path: 'None',
		replay_buffer_active: this.states.replayBuffer,
		virtualcam_active: this.states.outputs.get(VIRTUALCAM_OUTPUT_NAME)?.outputActive ?? false,
		studio_mode: this.states.studioMode,
		screenshot_saved_path: 'None',
		current_media_time_elapsed: [],
		current_media_time_remaining: [],
		scene_preview: this.states.previewScene ?? 'None',
		scene_active: this.states.programScene ?? 'None',
		scene_previous: this.states.previousScene ?? 'None',
		current_transition: this.states.currentTransition ?? 'None',
		transition_duration: this.states.transitionDuration ?? 0,
		transition_active: this.states.transitionActive ?? false,
		transition_list: this.obsState.transitionList?.map((item) => item.id) ?? [],
		audio_source_list: this.obsState.audioSourceList?.map((item) => item.id) ?? [],
		profile: this.states.currentProfile ?? 'None',
		scene_collection: this.states.currentSceneCollection ?? 'None',
		base_resolution: this.states.resolution ?? '',
		output_resolution: this.states.outputResolution ?? '',
		target_framerate: this.states.framerate ?? '',
	}

	for (const entry of dynamicVariableEntries(this)) {
		updates[entry.id] = entry.value
	}

	this.setVariableValues(updates)
}

/**
 * Drops variable writes whose value has not changed since the last publish.
 *
 * The host already ignores unchanged values, so this is not what stops dependents re-evaluating. It
 * compares with `!==` though, which is identity for arrays: values rebuilt each tick
 * (`current_media_name` and friends) look changed to it every time, and only an element-wise
 * comparison here catches that.
 */
export class VariablePublisher {
	private lastPublished = new Map<string, CompanionVariableValue>()

	/** Returns the changed entries and records them as published, so the caller must publish them. */
	public publishVariables(values: CompanionVariableValues): CompanionVariableValues | undefined {
		let changed: CompanionVariableValues | undefined
		for (const key of Object.keys(values)) {
			const value = values[key]
			// `has` before `get`, so a stored `undefined` differs from "never published".
			if (this.lastPublished.has(key) && isSameValue(this.lastPublished.get(key), value)) continue
			this.lastPublished.set(key, value)
			changed ??= {}
			changed[key] = value
		}
		return changed
	}

	/**
	 * Republishes in full on the next write. Called wherever the host may no longer hold these values;
	 * a redundant republish costs nothing, a missed one leaves a variable blank with no error.
	 */
	public reset(): void {
		this.lastPublished.clear()
	}
}

/** Values are primitives or flat arrays. */
function isSameValue(a: CompanionVariableValue, b: CompanionVariableValue): boolean {
	if (Array.isArray(a) && Array.isArray(b)) {
		return a.length === b.length && a.every((entry, index) => entry === b[index])
	}
	if (Array.isArray(a) || Array.isArray(b)) return false
	return a === b
}
