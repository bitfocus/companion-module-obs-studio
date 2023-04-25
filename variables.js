export function getVariables() {
	const variables = []

	variables.push({ variableId: 'base_resolution', name: 'Current base (canvas) resolution' })
	variables.push({ variableId: 'output_resolution', name: 'Current  output (scaled) resolution' })
	variables.push({ variableId: 'target_framerate', name: 'Current profile framerate' })
	variables.push({ variableId: 'fps', name: 'Current actual framerate' })
	variables.push({ variableId: 'cpu_usage', name: 'Current CPU usage (percentage)' })
	variables.push({ variableId: 'memory_usage', name: 'Current RAM usage (in megabytes)' })
	variables.push({ variableId: 'free_disk_space', name: 'Free recording disk space' })
	variables.push({ variableId: 'render_missed_frames', name: 'Number of frames missed due to rendering lag' })
	variables.push({ variableId: 'render_total_frames', name: 'Number of frames rendered' })
	variables.push({ variableId: 'output_skipped_frames', name: 'Number of encoder frames skipped' })
	variables.push({ variableId: 'output_total_frames', name: 'Number of total encoder frames' })
	variables.push({ variableId: 'average_frame_time', name: 'Average frame time (in milliseconds)' })
	variables.push({ variableId: 'recording', name: 'Recording State' })
	variables.push({ variableId: 'recording_file_name', name: 'File name of the last completed recording' })
	variables.push({ variableId: 'recording_path', name: 'File path of current recording' })
	variables.push({ variableId: 'recording_timecode', name: 'Recording timecode' })
	variables.push({ variableId: 'stream_timecode', name: 'Stream Timecode' })
	variables.push({ variableId: 'stream_service', name: 'Stream Service' })
	variables.push({ variableId: 'streaming', name: 'Streaming State' })
	variables.push({ variableId: 'kbits_per_sec', name: 'Stream output in kilobits per second' })
	variables.push({ variableId: 'scene_active', name: 'Current active scene' })
	variables.push({ variableId: 'scene_preview', name: 'Current preview scene' })
	variables.push({ variableId: 'profile', name: 'Current profile' })
	variables.push({ variableId: 'scene_collection', name: 'Current scene collection' })
	variables.push({ variableId: 'current_transition', name: 'Current transition' })
	variables.push({ variableId: 'transition_duration', name: 'Current transition duration' })
	variables.push({ variableId: 'current_media_name', name: 'Source name for currently playing media source' })
	variables.push({ variableId: 'current_media_time_elapsed', name: 'Time elapsed for currently playing media source' })
	variables.push({
		variableId: 'current_media_time_remaining',
		name: 'Time remaining for currently playing media source',
	})
	variables.push({ variableId: 'replay_buffer_path', name: 'File path of the last replay buffer saved' })

	//Defaults
	this.setVariableValues({
		current_media_name: 'None',
		recording_file_name: 'None',
		replay_buffer_path: 'None',
		current_media_time_elapsed: '--:--:--',
		current_media_time_remaining: '--:--:--',
	})
	//Source Specific Variables
	for (let s in this.mediaSourceList) {
		let sourceName = this.mediaSourceList[s].id
		let source = this.sources[sourceName]
		let mediaSourceName = source.validName ? source.validName : source.sourceName
		variables.push({ variableId: `media_status_${mediaSourceName}`, name: `${mediaSourceName} - Media status` })
		variables.push({ variableId: `media_file_name_${mediaSourceName}`, name: `${mediaSourceName} - Media file name` })
		variables.push({ variableId: `media_time_elapsed_${mediaSourceName}`, name: `${mediaSourceName} - Time elapsed` })
		variables.push({
			variableId: `media_time_remaining_${mediaSourceName}`,
			name: `${mediaSourceName} - Time remaining`,
		})

		let settings = this.sources[sourceName]?.settings
		let file = ''
		if (settings?.playlist) {
			file = settings.playlist[0]?.value?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
			//Use first value in playlist until support for determining currently playing cue
		} else if (settings.is_local_file) {
			file = settings?.local_file?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
		}
		this.setVariableValues({ [`media_file_name_${mediaSourceName}`]: file })
	}

	for (let s in this.sources) {
		let source = this.sources[s]
		let sourceName = source.validName ? source.validName : source.sourceName.replace(/[\W]/gi, '_')

		if (source.inputKind === 'text_ft2_source_v2' || source.inputKind === 'text_gdiplus_v2') {
			variables.push({ variableId: `current_text_${sourceName}`, name: `${sourceName} - Current text` })
			this.setVariableValues({
				[`current_text_${sourceName}`]: source.settings?.text ? source.settings.text : '',
			})
		}
		if (source.inputKind === 'image_source') {
			variables.push({
				variableId: `image_file_name_${sourceName}`,
				name: `${sourceName} - Image file name`,
			})
			this.setVariableValues({
				[`image_file_name_${sourceName}`]: source.settings?.file
					? source.settings?.file?.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
					: '',
			})
		}

		if (source.inputAudioTracks) {
			variables.push({ variableId: `volume_${sourceName}`, name: `${sourceName} - Volume` })
			variables.push({ variableId: `mute_${sourceName}`, name: `${sourceName} - Mute status` })
			variables.push({ variableId: `monitor_${sourceName}`, name: `${sourceName} - Audio monitor` })
			variables.push({ variableId: `sync_offset_${sourceName}`, name: `${sourceName} - Sync offset` })
			variables.push({ variableId: `balance_${sourceName}`, name: `${sourceName} - Audio balance` })
		}
	}

	let sceneIndex = 0
	for (let s = this.scenes.length - 1; s >= 0; s--) {
		let index = ++sceneIndex

		let sceneName = this.scenes[s].sceneName
		variables.push({ variableId: `scene_${index}`, name: `Scene - ${index}` })
		this.setVariableValues({
			[`scene_${index}`]: sceneName,
		})
	}
	return variables
}
