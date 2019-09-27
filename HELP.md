## OBS Studio

This module will allow you to control OBS Studio using a websocket connection.

### Configuration
* Download and install the websocket plugin on the computer running OBS: https://github.com/Palakis/obs-websocket/releases
* Configure the plugin as needed
* In Companion, specify the IP address of the computer running OBS and the port you are using for the websocket connection (defaults to 4444)

### Available actions
* Change Scene (pulls list of available scenes from OBS)
* Change Previewed Scene (studio mode)
* Execute transition (studio mode)
* Change Transition Type
* Start/Stop Streaming
* Start/Stop Recording
* Set Source Mute (Source: Name of Source or audio device in Mixer. Mute: True to mute, False to unmute)
