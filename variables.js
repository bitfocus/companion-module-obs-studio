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
	this.setVariable('current_media_name', 'None')
	this.setVariable('recording_file_name', 'None')
	this.setVariable('replay_buffer_path', 'None')
	this.setVariable('current_media_time_elapsed', '--:--:--')
	this.setVariable('current_media_time_remaining', '--:--:--')

	//Source Specific Variables
	for (let s in this.mediaSourceList) {
		let mediaSourceName = this.mediaSourceList[s].id
		variables.push({ name: 'media_status_' + mediaSourceName, label: 'Media status for ' + mediaSourceName })
		variables.push({ name: 'media_file_name_' + mediaSourceName, label: 'Media file name for ' + mediaSourceName })
		variables.push({ name: 'media_time_elapsed_' + mediaSourceName, label: 'Time elapsed for ' + mediaSourceName })
		variables.push({
			name: 'media_time_remaining_' + mediaSourceName,
			label: 'Time remaining for ' + mediaSourceName,
		})
		this.setVariable(
			'media_file_name_' + mediaSourceName,
			this.sources[mediaSourceName]?.settings?.local_file
				? this.sources[mediaSourceName].settings.local_file.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
				: ''
		)
	}

	for (let s in this.sources) {
		let source = this.sources[s]
		if (source.inputKind === 'text_ft2_source_v2' || source.inputKind === 'text_gdiplus_v2') {
			variables.push({ name: 'current_text_' + source.sourceName, label: 'Current text for ' + source.sourceName })
			this.setVariable('current_text_' + source.sourceName, source.settings?.text ? source.settings.text : '')
		}
		if (source.inputKind === 'image_source') {
			variables.push({
				name: 'image_file_name_' + source.sourceName,
				label: 'Image file name for ' + source.sourceName,
			})
			this.setVariable(
				'image_file_name_' + source.sourceName,
				source.settings?.file ? source.settings.file.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/) : ''
			)
		}

		if (source.inputAudioTracks) {
			variables.push({ name: 'volume_' + source.sourceName, label: 'Current volume for ' + source.sourceName })
			variables.push({ name: 'mute_' + source.sourceName, label: 'Current mute status for ' + source.sourceName })
			variables.push({
				name: 'monitor_' + source.sourceName,
				label: 'Current audio monitor status for ' + source.sourceName,
			})
			variables.push({
				name: 'sync_offset_' + source.sourceName,
				label: 'Current sync offset for ' + source.sourceName,
			})
			variables.push({
				name: 'balance_' + source.sourceName,
				label: 'Current audio balance for ' + source.sourceName,
			})
		}
	}

	this.setVariableDefinitions(variables)
}
