## OBS Studio

This module will allow you to control OBS Studio using a websocket connection.

### Configuration
* Download and install the websocket plugin on the computer running OBS: https://github.com/Palakis/obs-websocket/releases
* Configure the plugin as needed in the  Tools > WebSockets Server Settings menu
* In Companion, specify the IP address of the computer running OBS and the port you are using for the websocket connection (defaults to 4444)

### Available actions
* Change Scene (pulls list of available scenes from OBS)
* Change Previewed Scene (studio mode)
* Smart Switcher (Previews scene; or transitions scene to program if already in preview)
* Execute transition (studio mode)
* Change Transition Type
* Start/Stop Streaming
* Start/Stop Recording
* Set/Toggle Source Mute (Source: Name of Source or audio device in Mixer. Mute: True to mute, False to unmute)
* Toggle Scene Item Visibility
* Set Source Text (FreeType 2 and GDI+)
* Trigger HotKey by ID
* Reconnect

### Using Trigger Hotkey by ID
To use this feature, make sure you have obs-websocket 4.9.0 or greater installed. See the download link above to install the latest version.

* In OBS > Preferences > Hotkeys, assign a Hotkey to your desired actions and then click "Apply"
* In the OBS > Profile menu, select "Export" and choose a location. Click "Save"
* In the folder saved by OBS, open the **basic.ini** file in a text editor
* This file should have a section labeled **[Hotkeys]**. Under that section, the left most text up until the equals sign is the Hotkey ID. For example, a Hotkey ID might look like: **OBSBasic.StartRecording**
* Enter this value into the your Trigger hotkey by ID action in Companion

*Note:* if you have scene-speicifc hotkeys, those Hotkey IDs are stored in a different file. To access those:
* In the OBS > Scene Collection menu, select "Export" and choose a location. Click "Save"
* Open the *SceneName* **.json** file in a text editor
* This file will have multiple sections labeled **"hotkeys": {}**. It is likely easiest to use the search function to find them. Under each Hotkey  section, the text contained within the quotes above the "key" is the Hotkey ID. For example, a Hotkey ID might look like: **OBSBasic.SelectScene**
* Enter this value into the your Trigger hotkey by ID action in Companion

