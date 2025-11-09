export function getVariables() {
	const variables = []

	variables.push(
		{ variableId: 'base_resolution', name: 'Current base (canvas) resolution' },
		{ variableId: 'output_resolution', name: 'Current  output (scaled) resolution' },
		{ variableId: 'target_framerate', name: 'Current profile framerate' },
		{ variableId: 'fps', name: 'Current actual framerate' },
		{ variableId: 'cpu_usage', name: 'Current CPU usage (percentage)' },
		{ variableId: 'memory_usage', name: 'Current RAM usage (in megabytes)' },
		{ variableId: 'free_disk_space', name: 'Free recording disk space' },
		{ variableId: 'free_disk_space_mb', name: 'Free recording disk space in MB, with no unit text' },
		{ variableId: 'render_missed_frames', name: 'Number of frames missed due to rendering lag' },
		{ variableId: 'render_total_frames', name: 'Number of frames rendered' },
		{ variableId: 'output_skipped_frames', name: 'Number of encoder frames skipped' },
		{ variableId: 'output_total_frames', name: 'Number of total encoder frames' },
		{ variableId: 'average_frame_time', name: 'Average frame time (in milliseconds)' },
		{ variableId: 'recording', name: 'Recording State' },
		{ variableId: 'recording_file_name', name: 'File name of the last completed recording' },
		{ variableId: 'recording_path', name: 'File path of current recording' },
		{ variableId: 'recording_timecode', name: 'Recording timecode (hh:mm:ss)' },
		{ variableId: 'recording_timecode_hh', name: 'Recording timecode (hours)' },
		{ variableId: 'recording_timecode_mm', name: 'Recording timecode (minutes)' },
		{ variableId: 'recording_timecode_ss', name: 'Recording timecode (seconds)' },
		{ variableId: 'stream_timecode', name: 'Stream Timecode' },
		{ variableId: 'stream_timecode_hh', name: 'Stream Timecode (hours)' },
		{ variableId: 'stream_timecode_mm', name: 'Stream Timecode (minutes)' },
		{ variableId: 'stream_timecode_ss', name: 'Stream Timecode (seconds)' },
		{ variableId: 'stream_service', name: 'Stream Service' },
		{ variableId: 'streaming', name: 'Streaming State' },
		{ variableId: 'kbits_per_sec', name: 'Stream output in kilobits per second' },
		{ variableId: 'scene_active', name: 'Current active scene' },
		{ variableId: 'scene_preview', name: 'Current preview scene' },
		{ variableId: 'scene_previous', name: 'Previously active scene, before the current scene' },
		{ variableId: 'profile', name: 'Current profile' },
		{ variableId: 'scene_collection', name: 'Current scene collection' },
		{ variableId: 'current_transition', name: 'Current transition' },
		{ variableId: 'transition_duration', name: 'Current transition duration' },
		{ variableId: 'transition_active', name: 'Transition in progress' },
		{ variableId: 'transition_list', name: 'List of available transition types' },
		{ variableId: 'current_media_name', name: 'Source name for currently playing media source' },
		{ variableId: 'current_media_time_elapsed', name: 'Time elapsed for currently playing media source' },
		{
			variableId: 'current_media_time_remaining',
			name: 'Time remaining for currently playing media source',
		},
		{ variableId: 'replay_buffer_path', name: 'File path of the last replay buffer saved' },
		{
			variableId: 'custom_command_type',
			name: 'Latest Custom Command type sent to obs-websocket',
		},
		{
			variableId: 'custom_command_request',
			name: 'Latest Custom Command request data sent to obs-websocket',
		},
		{
			variableId: 'custom_command_response',
			name: 'Latest response from obs-websocket after using the Custom Command action',
		},
		{
			variableId: 'vendor_event_name',
			name: 'Vendor name of the latest Vendor Event received from obs-websocket',
		},
		{
			variableId: 'vendor_event_type',
			name: 'Latest Vendor Event type received from obs-websocket',
		},
		{
			variableId: 'vendor_event_data',
			name: 'Latest Vendor Event data received from obs-websocket',
		},
	)

	//Defaults
	this.setVariableValues({
		current_media_name: 'None',
		recording_file_name: 'None',
		replay_buffer_path: 'None',
		current_media_time_elapsed: '--:--:--',
		current_media_time_remaining: '--:--:--',
		scene_preview: this.states.previewScene ?? 'None',
		scene_active: this.states.programScene ?? 'None',
		scene_previous: this.states.previousScene ?? 'None',
	})

	//Source Specific Variables
	for (let s in this.sources) {
		let source = this.sources[s]
		let sourceName = source.validName ? source.validName : this.validName(source.sourceName)
		let inputSettings = source.settings
		if (source.inputKind) {
			switch (source.inputKind) {
				case 'text_ft2_source_v2':
				case 'text_gdiplus_v2':
				case 'text_gdiplus_v3':
					variables.push({ variableId: `current_text_${sourceName}`, name: `${sourceName} - Current text` })
					if (inputSettings?.from_file || inputSettings?.read_from_file) {
						this.setVariableValues({
							[`current_text_${sourceName}`]: `Text from file: ${inputSettings.text_file ?? inputSettings.file}`,
						})
					} else if (inputSettings?.text) {
						this.setVariableValues({
							[`current_text_${sourceName}`]: inputSettings.text ?? '',
						})
					}
					break
				case 'ffmpeg_source':
				case 'vlc_source': {
					variables.push(
						{ variableId: `media_status_${sourceName}`, name: `${sourceName} - Media status` },
						{ variableId: `media_file_name_${sourceName}`, name: `${sourceName} - Media file name` },
						{ variableId: `media_time_elapsed_${sourceName}`, name: `${sourceName} - Time elapsed` },
						{ variableId: `media_time_remaining_${sourceName}`, name: `${sourceName} - Time remaining` },
					)
					let file = ''
					if (inputSettings?.playlist) {
						file = inputSettings?.playlist[0]?.value?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
						//Use first value in playlist until support for determining currently playing cue
					} else if (inputSettings?.local_file) {
						file = inputSettings?.local_file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)?.[0] ?? ''
					}
					this.setVariableValues({ [`media_file_name_${sourceName}`]: file })

					break
				}
				case 'image_source':
					variables.push({
						variableId: `image_file_name_${sourceName}`,
						name: `${sourceName} - Image file name`,
					})
					this.setVariableValues({
						[`image_file_name_${sourceName}`]: source.inputSettings?.file
							? source.inputSettings?.file?.match(/[^\\/]+(?=\.[\w]+$)|[^\\/]+$/)
							: '',
					})
					break
				default:
					break
			}
		}

		if (source.inputAudioTracks) {
			variables.push(
				{ variableId: `volume_${sourceName}`, name: `${sourceName} - Volume` },
				{ variableId: `mute_${sourceName}`, name: `${sourceName} - Mute status` },
				{ variableId: `monitor_${sourceName}`, name: `${sourceName} - Audio monitor` },
				{ variableId: `sync_offset_${sourceName}`, name: `${sourceName} - Sync offset` },
				{ variableId: `balance_${sourceName}`, name: `${sourceName} - Audio balance` },
			)
		}
	}

	//Scene Variables
	let sceneIndex = 0
	for (let s = this.scenes?.length - 1; s >= 0; s--) {
		let index = ++sceneIndex

		let sceneName = this.scenes[s].sceneName
		variables.push({ variableId: `scene_${index}`, name: `Scene - ${index}` })
		this.setVariableValues({
			[`scene_${index}`]: sceneName,
		})
	}
	return variables
}
