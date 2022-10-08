exports.updateVariableDefinitions = function () {
	const variables = []

	variables.push({ name: 'base_resolution', label: 'Current base (canvas) resolution' })
	variables.push({ name: 'output_resolution', label: 'Current  output (scaled) resolution' })
	variables.push({ name: 'target_framerate', label: 'Current profile framerate' })
	variables.push({ name: 'fps', label: 'Current actual framerate' })
	variables.push({ name: 'cpu_usage', label: 'Current CPU usage (percentage)' })
	variables.push({ name: 'memory_usage', label: 'Current RAM usage (in megabytes)' })
	variables.push({ name: 'free_disk_space', label: 'Free recording disk space' })
	variables.push({ name: 'render_missed_frames', label: 'Number of frames missed due to rendering lag' })
	variables.push({ name: 'render_total_frames', label: 'Number of frames rendered' })
	variables.push({ name: 'output_skipped_frames', label: 'Number of encoder frames skipped' })
	variables.push({ name: 'output_total_frames', label: 'Number of total encoder frames' })
	variables.push({ name: 'average_frame_time', label: 'Average frame time (in milliseconds)' })
	variables.push({ name: 'recording', label: 'Recording State' })
	variables.push({ name: 'recording_file_name', label: 'File name of the last completed recording' })
	variables.push({ name: 'recording_path', label: 'File path of current recording' })
	variables.push({ name: 'recording_timecode', label: 'Recording timecode' })
	variables.push({ name: 'stream_timecode', label: 'Stream Timecode' })
	variables.push({ name: 'stream_service', label: 'Stream Service' })
	variables.push({ name: 'streaming', label: 'Streaming State' })
	variables.push({ name: 'scene_active', label: 'Current active scene' })
	variables.push({ name: 'scene_preview', label: 'Current preview scene' })
	variables.push({ name: 'profile', label: 'Current profile' })
	variables.push({ name: 'scene_collection', label: 'Current scene collection' })
	variables.push({ name: 'current_transition', label: 'Current transition' })
	variables.push({ name: 'transition_duration', label: 'Current transition duration' })
	variables.push({ name: 'current_media_name', label: 'Source name for currently playing media source' })
	variables.push({ name: 'current_media_time_elapsed', label: 'Time elapsed for currently playing media source' })
	variables.push({ name: 'current_media_time_remaining', label: 'Time remaining for currently playing media source' })
	variables.push({ name: 'replay_buffer_path', label: 'File path of the last replay buffer saved' })

	//Defaults
	this.setVariables({
		current_media_name: 'None',
		recording_file_name: 'None',
		replay_buffer_path: 'None',
		current_media_time_elapsed: '--:--:--',
		current_media_time_remaining: '--:--:--',
	})
	//Source Specific Variables
	for (let s in this.mediaSourceList) {
		let mediaSourceName = this.mediaSourceList[s].id
		variables.push({ name: `media_status_${mediaSourceName}`, label: `${mediaSourceName} - Media status` })
		variables.push({ name: `media_file_name_${mediaSourceName}`, label: `${mediaSourceName} - Media file name` })
		variables.push({ name: `media_time_elapsed_${mediaSourceName}`, label: `${mediaSourceName} - Time elapsed` })
		variables.push({ name: `media_time_remaining_${mediaSourceName}`, label: `${mediaSourceName} - Time remaining` })

		let settings = this.sources[mediaSourceName]?.settings
		let file = ''
		if (settings.playlist) {
			file = settings.playlist[0].value.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
			//Use first value in playlist until support for determining currently playing cue
		} else {
			file = settings?.local_file.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
		}
		this.setVariable(`media_file_name_${mediaSourceName}`, file)
	}

	for (let s in this.sources) {
		let source = this.sources[s]
		if (source.inputKind === 'text_ft2_source_v2' || source.inputKind === 'text_gdiplus_v2') {
			variables.push({ name: `current_text_${source.sourceName}`, label: `${source.sourceName} - Current text` })
			this.setVariable(`current_text_${source.sourceName}`, source.settings?.text ? source.settings.text : '')
		}
		if (source.inputKind === 'image_source') {
			variables.push({ name: `image_file_name_${source.sourceName}`, label: `${source.sourceName} - Image file name` })
			this.setVariable(
				`image_file_name_${source.sourceName}`,
				source.settings?.file ? source.settings.file.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/) : ''
			)
		}

		if (source.inputAudioTracks) {
			variables.push({ name: `volume_${source.sourceName}`, label: `${source.sourceName} - Volume` })
			variables.push({ name: `mute_${source.sourceName}`, label: `${source.sourceName} - Mute status` })
			variables.push({ name: `monitor_${source.sourceName}`, label: `${source.sourceName} - Audio monitor` })
			variables.push({ name: `sync_offset_${source.sourceName}`, label: `${source.sourceName} - Sync offset` })
			variables.push({ name: `balance_${source.sourceName}`, label: `${source.sourceName} - Audio balance` })
		}
	}

	this.setVariableDefinitions(variables)
}
