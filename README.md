# companion-module-obs-studio

This module will allow you to control OBS Studio using the obs-websocket plugin.

## Getting Started

See [HELP.md](https://github.com/bitfocus/companion-module-obs-studio/blob/master/HELP.md)

## Changelog

### v2.0.5

- Fix
  - All text source now appear as choices in the Set Text action dropdown on startup
- Minor
  - Allow hostnames to be used in the module configuration

### v2.0.4

- Fix
  - When using Set Scene Visibility on a group source, the sources within groups are now not affected
  - Toggle/Start/Stop Output now works properly with Virtual Camera
- Minor
  - Update obs-websocket-js to latest version
  - Use obs-websocket's Batch command for certain actions

### v2.0.3

- Fix
  - Properly detect more types of disconnections and properly update module status
  - Grouped sources can now be enabled / disabled via "Set Source Visibility" action
  - Grouped sources feedback is now accurate

### v2.0.2

- New
  - Allow Global Audio Devices to be choices for actions, feedback, and variables
- Fix
  - Show Scenes in the Open Projector action choices

### v2.0.1

- Fixes
  - Prevent issue when using more than one instance of the OBS module
  - Add filters from scenes, not just sources

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
