## OBS Studio

This module will allow you to control OBS Studio using the built-in WebSocket Server.

### Configuration

- Download and install [**OBS 28 or above**](https://obsproject.com), which includes the obs-websocket plugin by default.
- Enable and configure the obs-websocket plugin within OBS under Tools > WebSocket Server Settings
- In the WebSocket Server Settings window, click Show Connect Info. This info can be referenced in the next step.
- In the Companion module settings for OBS, enter the Server IP address (or hostname), the Server Port (by default the port is 4455), and the Server Password (leave blank if authentication is disabled)

### Available actions

**Recording & Streaming & Outputs**

- Recording (Toggle Record / Start / Stop / Toggle Pause / Pause / Resume / Split / Create Chapter)
- Streaming (Start / Stop / Toggle)
- Set Stream Settings
- Send Stream Caption
- Output (Toggle / Start / Stop)
- Replay Buffer (Toggle / Start / Stop / Save)

**Switching & Transitions**

- Set Program Scene
- Set Preview Scene
- Smart Scene Switcher _(Previews selected scene or, if scene is already in preview, transitions the scene to program)_
- Transition _(Requires Studio Mode to be active)_
- Quick Transition _(Performs the selected transition and then returns to the previous transition)_
- Set Transition Type
- Set Transition Duration
- Adjust Transition Duration

**Sources**

- Set Source Visibility _(Individual sources, or All Sources within a scene)_
- Set Filter Visibility
- Set Filter Settings
- Set Source Transform (Position / Scale / Rotation)
- Source Mute (Set / Toggle)
- Set Source Volume
- Adjust Source Volume
- Set Audio Monitor
- Set Audio Sync Offset
- Set Audio Balance
- Set Source Text
- Refresh Browser Source
- Play / Pause Media
- Restart Media
- Stop Media
- Next Media
- Previous Media
- Set Media Time
- Scrub Media
- Open Source Properties Window
- Open Source Filters Window
- Open Source Interact Window

**General**

- Studio Mode (Enable / Disable / Toggle)
- Open Projector
- Set Profile
- Set Scene Collection
- Trigger Hotkey by Key

**Advanced**

- Trigger Hotkey by ID
- Custom Command _(Request data must be valid JSON. See [obs-websocket protocol documentation](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#requests) for request types and required request data)_
- Custom Vendor Request _(Request data must be valid JSON. Requests will vary based on plugin. See documentation for your specific plugin for more info. Support for this feature will be limited due to the large number of plugins available)_

### Available feedbacks

**Recording & Streaming & Outputs**

- Streaming Active
- Recording Status (If recording is active or paused, change the style of the button)
- Output Active
- Replay Buffer Active
- Stream Congestion

**Switching & Transitions**

- Scene in Preview / Program (Program and Preview, Program Only, or Preview Only)
- Previous Scene Active
- Transition in Progress
- Current Transition Type
- Transition Duration

**Sources**

- Source Visible (If a source is visible in the program, change the style of the button)
- Source Enabled in Scene (If a source is enabled in a specific scene, change the style of the button)
- Filter Enabled
- Audio Muted
- Audio Monitor Type
- Volume
- Media Playing
- Media Source Remaining Time (If remaining time of a media source is below a threshold, change the style of the button)

**General**

- Profile Active
- Scene Collection Active
- Studio Mode Active
- Disk Space Remaining

**Advanced**

- Vendor Event

### Available variables

**Recording & Streaming & Outputs**

- recording
- recording_file_name
- recording_path
- recording_timecode
- streaming
- stream_timecode
- stream_service
- kbits_per_sec (Amount of data per second (in kilobits) transmitted by the stream encoder)
- render_missed_frames
- render_total_frames
- output_skipped_frames
- output_total_frames
- average_frame_time
- replay_buffer_path

**Switching & Transitions**

- scene_active
- scene_preview
- scene_previous
- current_transition
- transition_duration

**Sources**

- current_media_name (Will only reflect one source if multiple media sources are playing)
- current_media_time_elapsed (Will only reflect one source if multiple media sources are playing)
- current_media_time_remaining (Will only reflect one source if multiple media sources are playing)
- media_status_source_name(Current status of media sources, including: playing, paused, stopped, ended)
- media_file_name (Current file name of media sources, not including the extension)
- media_time_elapsed
- media_time_remaining
- image_file_name
- current_text (Current text value of text sources)
- volume (Current volume in dB of a source)
- mute (Current audio mute state of a source)
- monitor (Current audio monitoring state of a source)
- sync_offset (Current audio sync offset of a source)
- balance (Current audio balance of a source)

**General**

- profile
- scene_collection
- fps
- cpu_usage
- memory_usage
- free_disk_space
- free_disk_space_mb
- base_resolution
- output_resolution
- target_framerate

**Advanced**

- custom_command_response
- custom_command_type
- custom_command_request
- vendor_event_name
- vendor_event_type
- vendor_event_data
