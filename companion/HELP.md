# OBS Studio

Control OBS Studio from Bitfocus Buttons or Bitfocus Companion using OBS's built-in WebSocket
server.

> **Requirements:** Version 4 of this module requires Buttons 1.8 or newer or Companion 5.0 or
> newer. OBS Studio 32.1 or newer is recommended.

## Connect to OBS

1. In OBS Studio, open **Tools → WebSocket Server Settings**.
2. Enable the WebSocket server.
3. Select **Show Connect Info** to see the address, port, and password.
4. Enter those values in the OBS Studio connection settings in Buttons or Companion.

The default obs-websocket port is **4455**. Leave the password blank only when authentication is
disabled in OBS.

The default connection type is WebSocket (**ws**). Choose Secure WebSocket (**wss**) only when the
OBS server or a reverse proxy has been configured for TLS. Selecting wss does not enable TLS in OBS
by itself.

## Actions

### Recording, streaming, and outputs

| Action                          | Capabilities                                                   |
| ------------------------------- | -------------------------------------------------------------- |
| Recording – Controls            | Start, stop, toggle, pause, resume, split, or create a chapter |
| Streaming – Controls            | Start, stop, or toggle streaming                               |
| Streaming – Set Stream Settings | Change the configured streaming service                        |
| Streaming – Send Caption        | Send caption text to the active stream                         |
| Replay Buffer – Controls        | Start, stop, toggle, or save the replay buffer                 |
| Output – Controls               | Start, stop, or toggle an OBS output                           |

### Scenes and transitions

| Action                           | Capabilities                                               |
| -------------------------------- | ---------------------------------------------------------- |
| Scene – Set Program Scene        | Switch the current program scene                           |
| Scene – Set Preview Scene        | Change the preview scene                                   |
| Scene – Smart Scene Switcher     | Preview a scene, or transition it when already in preview  |
| Transitions – Perform Transition | Perform a transition; Studio Mode must be active           |
| Transitions – Quick Transition   | Perform a transition, then restore the previous transition |
| Transitions – Set Type           | Select or cycle through transition types                   |
| Transitions – Set Duration       | Set or adjust the transition duration                      |

### Sources, groups, and filters

| Action                              | Capabilities                                                        |
| ----------------------------------- | ------------------------------------------------------------------- |
| Source – Set Visibility             | Show, hide, or toggle selected sources, all sources, or group items |
| Source – Set Transform Properties   | Set position, scale, and rotation                                   |
| Source – Set Source Text            | Replace the contents of a text source                               |
| Source – Set Text Properties        | Change font, colour, alignment, outline, background, and layout     |
| Filters – Set Visibility            | Enable, disable, or toggle a source or scene filter                 |
| Filters – Set Settings              | Apply filter settings supplied as JSON                              |
| Source – Refresh Browser Source     | Reload a browser source                                             |
| Source – Reset Video Capture Device | Deactivate and reactivate a capture device                          |
| Source – Take Screenshot            | Save an image of a source, program scene, or preview scene          |

### Audio

| Action                       | Capabilities                                            |
| ---------------------------- | ------------------------------------------------------- |
| Audio – Mute                 | Mute, unmute, or toggle a source                        |
| Audio – Source Volume        | Set or adjust dB/percent volume, optionally with a fade |
| Audio – Set Audio Monitoring | Enable, disable, or toggle monitoring                   |
| Audio – Source Audio Offset  | Set or adjust audio sync offset                         |
| Audio – Source Audio Balance | Set or adjust stereo balance                            |
| Audio – Set Audio Tracks     | Enable, disable, or toggle mixer tracks                 |

### Media

Media actions can target a specific source, the newest playing clip, or all playing clips. “Newest”
and “all” include playing or paused media sources that are active in program.

| Action                            | Capabilities                                              |
| --------------------------------- | --------------------------------------------------------- |
| Media – Playback Controls         | Play, pause, toggle, restart, stop, next, or previous     |
| Media – Set / Scrub Playback Time | Set an absolute time or move relative to the current time |
| Media – Set Source File           | Change the local file used by a media source              |

### OBS interface and general controls

| Action                              | Capabilities                                       |
| ----------------------------------- | -------------------------------------------------- |
| Studio Mode                         | Enable, disable, or toggle Studio Mode             |
| Set Profile                         | Select an OBS profile                              |
| Set Scene Collection                | Select an OBS scene collection                     |
| Hotkey – Trigger by Key Sequence    | Trigger a keyboard shortcut                        |
| Hotkey – Trigger by ID              | Trigger an OBS hotkey by its registered identifier |
| UI – Open Source Properties Window  | Open source properties in OBS                      |
| UI – Open Source Filter Window      | Open source filters in OBS                         |
| UI – Open Source Interaction Window | Open the interaction window for a browser source   |
| UI – Open Projector                 | Open an OBS projector window                       |

## Feedbacks

Boolean feedbacks become active when their condition matches. They can change a button's style or
be combined with other feedbacks.

### Status feedbacks

| Area                    | Feedbacks                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------- |
| Recording and streaming | Streaming Active, Streaming Reconnecting, Recording Active, Recording Paused                               |
| Outputs                 | Output Active, Replay Buffer Active                                                                        |
| Scenes and transitions  | Scene Program, Scene Preview, Scene Previous, Transition In Progress, Transition Type, Transition Duration |
| Sources and filters     | Source Visible in Program, Source Active in Preview, Source Enabled in Scene, Filter Enabled               |
| Audio                   | Muted, Monitoring, Track Enabled, Volume, Peaking                                                          |
| Media                   | Playing, Remaining Time                                                                                    |
| General                 | Profile Active, Scene Collection Active, Studio Mode Active, Disk Space Remaining                          |
| Advanced                | Custom – Vendor Event                                                                                      |

### Value feedbacks

Value feedbacks report a number instead of directly applying a style. Bind one to a button's local
variable and use that value in an expression or graphical element such as a gauge.

- Audio – Peak Level (dB)
- Audio – Volume (dB)
- Audio – Balance (%)
- Audio – Sync Offset (ms)
- Media – Playback Progress (%)
- Media – Remaining Time (seconds)
- Streaming – Stream Congestion Level

## Variables

Use module variables in button text, expressions, action options, and feedback options. The variable
browser shows the exact ID available to the current connection.

### Recording, streaming, and outputs

- **recording**, **streaming**, and **stream_service**
- **recording_file_name** and **recording_path**
- **recording_timecode** and its **\_hh**, **\_mm**, and **\_ss** variants
- **stream_timecode** and its **\_hh**, **\_mm**, and **\_ss** variants
- **kbits_per_sec**
- **render_missed_frames**, **render_total_frames**
- **output_skipped_frames**, **output_total_frames**
- **stream_output_skipped_frames**, **stream_output_total_frames**
- **average_frame_time**
- **replay_buffer_path**, **replay_buffer_active**
- **virtualcam_active**

### Scenes and transitions

- **scene_active**, **scene_preview**, **scene_previous**
- **scene_1**, **scene_2**, and so on, ordered from the top of the OBS scene list
- **current_transition**, **transition_duration**, **transition_active**
- **transition_list**

### Media collections

- **current_media_name** — list of playing or paused media sources active in program
- **current_media_time_elapsed** — matching list of elapsed times
- **current_media_time_remaining** — matching list of remaining times
- **latest_media_name** — most recently started source from that active collection
- **latest_media_time_elapsed** and **latest_media_time_remaining**

### Per-source variables

Per-source IDs end with a sanitized source name. Spaces and punctuation are converted so the name is
safe to use as a variable ID. For example, a source named “Camera 1” uses a suffix such as
**Camera_1**.

| Pattern                     | Meaning                                      |
| --------------------------- | -------------------------------------------- |
| current_text_SOURCE         | Current text-source contents                 |
| media_status_SOURCE         | Playing, paused, stopped, ended, or error    |
| media_file_name_SOURCE      | Current media filename without its extension |
| media_time_elapsed_SOURCE   | Current media elapsed time                   |
| media_time_remaining_SOURCE | Current media remaining time                 |
| image_file_name_SOURCE      | Current image filename                       |
| volume_SOURCE               | Current source volume in dB                  |
| mute_SOURCE                 | Muted or Unmuted                             |
| monitor_SOURCE              | OBS audio monitoring mode                    |
| monitor_active_SOURCE       | Whether audio monitoring is enabled          |
| sync_offset_SOURCE          | Audio sync offset in milliseconds            |
| balance_SOURCE              | Audio balance                                |
| tracks_SOURCE               | List of enabled mixer track numbers          |
| source_active_SOURCE        | Whether the source is active in program      |

The available per-source variables depend on the source type and capabilities reported by OBS.

### General and system variables

- **profile**, **scene_collection**, **studio_mode**
- **fps**, **cpu_usage**, **memory_usage**
- **free_disk_space**, **free_disk_space_mb**
- **base_resolution**, **output_resolution**, **target_framerate**
- **audio_source_list**
- **screenshot_saved_path**

### Advanced variables

- **custom_command_type**, **custom_command_request**, **custom_command_response**
- **vendor_event_name**, **vendor_event_type**, **vendor_event_data**

## Advanced WebSocket features

### Custom – Send Command

Send any obs-websocket request that is not covered by a dedicated action. The request data must be a
valid JSON object. Request names and fields are documented in the
[obs-websocket protocol reference](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md#requests).

The latest request type, request data, and response are published in the corresponding
**custom_command_*** variables.

### Custom – Send Vendor Request

Send a request registered by an OBS plugin. Vendor name, request type, and request data are defined
by that plugin. Consult the plugin's documentation; behavior cannot be generalized across vendors.

### Custom – Vendor Event feedback

Matches events emitted by OBS plugins. The latest received event is also exposed through the
**vendor_event_*** variables.
