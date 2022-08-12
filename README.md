# companion-module-obs-studio

This module will allow you to control OBS Studio using the obs-websocket plugin.

## Getting Started

See [HELP.md](https://github.com/bitfocus/companion-module-obs-studio/blob/master/HELP.md)

## Change Log

### v2.0.0

- New

  - Support for obs-websocket version 5.0.0
  - New "Current Media" option on all media control actions
  - Custom variables for "Set Program Scene", "Set Preview Scene", and "Custom Command" actions
  - Ability to specify a specific scene for a source in the the "Source Visible in Program" feedback

  - New Actions:
    - Toggle Recording Pause
    - Open Source Properties Window
    - Open Source Filters Window
    - Open Source Interact Window
  - New Feedback:
    - Replay Buffer Active
  - New Variables:
    - recording_path
    - stream_service
    - base_resolution
    - output_resolution
    - target_framerate
    - replay_buffer_path

- Fixes
  - Take Screenshot action now works again
  - Recording feedback should properly reflect recording state
