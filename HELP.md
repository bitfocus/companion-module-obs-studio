## OBS Studio

This module will allow you to control OBS Studio using the obs-websocket plugin.

### Configuration
* Download and install the latest version of the [obs-websocket plugin](https://github.com/Palakis/obs-websocket/releases) on the computer running OBS
* Configure the plugin as needed in OBS under Tools > WebSockets Server Settings menu
* In Companion, specify the IP address of the computer running OBS, the port you are using for the websocket connection (defaults to 4444), and the password (leave blank if authentication is not enabled)

### Available actions
**Recording & Streaming & Outputs**
* Recording (Start / Stop / Pause / Resume / Toggle)
* Streaming (Start / Stop / Toggle)
* Set Stream Settings
* Output (Start / Stop / Toggle)
* Replay Buffer (Start / Stop / Save)

**Switching & Transitions**
* Change Scene
* Preview Scene
* Smart Scene Switcher *(Previews selected scene or, if scene is already in preview, transitions the scene to program)*
* Transition Preview to Program *(Performs the selected transition and then makes the transition the new default)*
* Quick Transition *(Performs the selected transition and then returns to the default transition)*
* Set Transition Type
* Set Transition Duration

**Sources**
* Set Source Visibility
* Set Filter Visibility
* Set Source Properties (Position / Scale / Rotation)
* Source Mute (Set / Toggle)
* Set Source Volume
* Adjust Source Volume
* Set Audio Monitor
* Set Source Text (FreeType 2)
* Set Source Text (GDI+)
* Refresh Browser Source
* Play / Pause Media
* Restart Media
* Stop Media
* Next Media
* Previous Media
* Set Media Time
* Scrub Media

**General**
* Studio Mode (Enable / Disable / Toggle)
* Open Projector
* Set Profile
* Set Scene Collection
* Trigger Hotkey by Key
* Trigger Hotkey by ID *(See help info below for more info)*
* Reconnect to OBS

### Available feedbacks
**Recording & Streaming & Outputs**
* Streaming Active
* Recording Status *(If recording is active or paused, change the style of the button)*
* Output Active

**Switching & Transitions**
* Scene in Preview / Program
* Transition in Progress
* Current Transition Type
* Transition Duration

**Sources**
* Source Visible *(If a source is visible in the program, change the style of the button)*
* Source Enabled in Scene *(If a source is enabled in a specific scene, change the style of the button)*
* Filter Enabled
* Audio Muted
* Audio Monitor Type
* Volume
* Media Playing

**General**
* Profile Active
* Scene Collection Active

### Available variables
**Recording & Streaming & Outputs**
* recording
* recording_file_name
* recording_timecode
* streaming
* stream_timecode
* total_stream_time
* bytes_per_sec *(Amount of data per second (in bytes) transmitted by the stream encoder)*
* kbits_per_sec *(Amount of data per second (in kilobits) transmitted by the stream encoder)*
* render_missed_frames
* render_total_frames
* output_skipped_frames
* output_total_frames
* num_dropped_frames
* num_total_frames
* average_frame_time

**Switching & Transitions**
* preview_only
* scene_active
* scene_preview
* current_transition
* transition_duration

**Sources**
* media_status_*source_name* *(Current status of media sources, including: playing, paused, stopped, ended)*
* media_file_name*source_name* *(Current file name of media sources, not including the extension)*
* current_text_*source_name* *(Current text value of text sources)*
* volume_*source_name* *(Current volume in dB of a source)*

**General**
* profile
* scene_collection
* fps
* cpu_usage
* memory_usage
* strain
* free_disk_space

### Using Trigger Hotkey by ID
To use this feature, make sure you have obs-websocket 4.9.0 or greater installed. See the download link above to install the latest version.

* In OBS > Preferences > Hotkeys, assign a Hotkey to your desired actions and then click "Apply"
* In the OBS > Profile menu, select "Export" and choose a location. Click "Save"
* In the folder saved by OBS, open the **basic.ini** file in a text editor
* This file should have a section labeled **[Hotkeys]**. Under that section, the left most text up until the equals sign is the Hotkey ID. For example, a Hotkey ID might look like: **OBSBasic.StartRecording**
* Enter this value into the your Trigger hotkey by ID action in Companion

*Note:* if you have scene-specific hotkeys, those Hotkey IDs are stored in a different file. To access those:
* In the OBS > Scene Collection menu, select "Export" and choose a location. Click "Save"
* Open the *SceneName* **.json** file in a text editor
* This file will have multiple sections labeled **"hotkeys": {}**. It is likely easiest to use the search function to find them. Under each Hotkey  section, the text contained within the quotes above the "key" is the Hotkey ID. For example, a Hotkey ID might look like: **OBSBasic.SelectScene**
* Enter this value into the your Trigger hotkey by ID action in Companion