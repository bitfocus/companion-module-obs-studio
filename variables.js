exports.updateVariableDefinitions = function () {
	const variables = []

	variables.push({
		name: 'bytes_per_sec',
		label: 'Amount of data per second (in bytes) transmitted by the stream encoder',
	})
	variables.push({ name: 'fps', label: 'Current framerate' })
	variables.push({ name: 'cpu_usage', label: 'Current CPU usage (percentage)' })
	variables.push({ name: 'memory_usage', label: 'Current RAM usage (in megabytes)' })
	variables.push({ name: 'free_disk_space', label: 'Free recording disk space' })
	variables.push({
		name: 'kbits_per_sec',
		label: 'Amount of data per second (in kilobits) transmitted by the stream encoder',
	})
	variables.push({ name: 'render_missed_frames', label: 'Number of frames missed due to rendering lag' })
	variables.push({ name: 'render_total_frames', label: 'Number of frames rendered' })
	variables.push({ name: 'output_skipped_frames', label: 'Number of encoder frames skipped' })
	variables.push({ name: 'output_total_frames', label: 'Number of total encoder frames' })
	variables.push({
		name: 'num_dropped_frames',
		label: 'Number of frames dropped by the encoder since the stream started',
	})
	variables.push({ name: 'num_total_frames', label: 'Total number of frames transmitted since the stream started' })
	variables.push({ name: 'average_frame_time', label: 'Average frame time (in milliseconds)' })
	variables.push({ name: 'recording', label: 'Recording State' })
	variables.push({ name: 'recording_file_name', label: 'File name of current recording' })
	variables.push({ name: 'recording_timecode', label: 'Recording timecode' })
	variables.push({ name: 'strain', label: 'Strain' })
	variables.push({ name: 'stream_timecode', label: 'Stream Timecode' })
	variables.push({ name: 'streaming', label: 'Streaming State' })
	variables.push({ name: 'total_stream_time', label: 'Total streaming time' })
	variables.push({ name: 'scene_active', label: 'Current active scene' })
	variables.push({ name: 'scene_preview', label: 'Current preview scene' })
	variables.push({ name: 'profile', label: 'Current profile' })
	variables.push({ name: 'scene_collection', label: 'Current scene collection' })
	variables.push({ name: 'current_transition', label: 'Current transition' })
	variables.push({ name: 'transition_duration', label: 'Current transition duration' })
	variables.push({ name: 'current_media_name', label: 'Source name for currently playing media source' })
	variables.push({ name: 'current_media_time_elapsed', label: 'Time elapsed for currently playing media source' })
	variables.push({ name: 'current_media_time_remaining', label: 'Time remaining for currently playing media source' })

	/* for (var s in self.mediaSources) {
		let media = self.mediaSources[s]
		variables.push({ name: 'media_status_' + media.sourceName, label: 'Media status for ' + media.sourceName })
		variables.push({ name: 'media_file_name_' + media.sourceName, label: 'Media file name for ' + media.sourceName })
		variables.push({ name: 'media_time_elapsed_' + media.sourceName, label: 'Time elapsed for ' + media.sourceName })
		variables.push({
			name: 'media_time_remaining_' + media.sourceName,
			label: 'Time remaining for ' + media.sourceName,
		})
	} */

	 for (let s in this.sources) {
		let source = this.sources[s]
		this.debug(source)
		if (source.inputKind === 'text_ft2_source_v2' || source.inputKind === 'text_gdiplus_v2') {
			variables.push({ name: 'current_text_' + source.sourceName, label: 'Current text for ' + source.sourceName })
			this.setVariable('current_text_' + source.sourceName, source.settings?.text ? source.settings.text : '')
		}
		/* if (source.typeId === 'image_source') {
			variables.push({ name: 'image_file_name_' + source.name, label: 'Image file name for ' + source.name })
		}
		variables.push({ name: 'volume_' + source.name, label: 'Current volume for ' + source.name }) */
	} 

	this.setVariableDefinitions(variables)
}
