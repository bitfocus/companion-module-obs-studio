# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0/).

## [Unreleased]

> **Note:** 4.0.0 is a major rewrite focused on performance and stability. It updates the underlying
> module API to v2.1, which requires Companion v5.0.0 or newer.

### Added

- Action Recorder ("Learn") support, to capture current values from OBS into an action
- Value feedbacks, for gauges and other button graphics elements, or bound to a local variable:
  audio peak level, volume, balance and sync offset; media playback progress and remaining time;
  and stream congestion level
- "Streaming - Reconnecting" feedback, and a "Reconnecting" state in the streaming status variable
- "Streaming - Stream Congestion Above" feedback, active while congestion passes a chosen threshold
- Set Visibility can now act on several sources at once, on every source in a scene, or on every
  source inside a group. When acting on all sources, an "Except" list can hold some back — those are
  set to the opposite visibility
- Set Visibility, Set Transform Properties and Filters - Set Visibility can target a group, and
  sources inside groups can be addressed directly
- New variables: `screenshot_saved_path`, `audio_source_list`, `replay_buffer_active`,
  `virtualcam_active`, `studio_mode`, per-source `source_active`, `monitor_active` and
  `tracks_<source>`, and `latest_media_name` / `latest_media_time_elapsed` /
  `latest_media_time_remaining` for the most recently started media source
- Restart, Stop, Previous and Next presets for each media source, alongside play/pause and scrub
- "Playing Clips", "Play / Pause All Clips", "Stop All Playing Clips" and "Newest Clip Time
  Remaining" presets
- Layered presets, which draw a button from graphics elements instead of a single style — audio meter
  and volume gauges, a volume/balance/sync-offset rotary set, a six-track mixer status button, a media
  progress bar that turns yellow under 20 seconds and red under 10, a scrub rotary, and OBS's four-bar
  congestion indicator. Each ships with a plain fallback, so hosts that cannot draw layers (such as
  Bitfocus Buttons) still get a usable button

### Changed

- Rewritten in TypeScript, and communication with obs-websocket is batched wherever possible
- The WebSocket Server password is now stored securely and hidden by default
- Actions and feedbacks that can act on more than one thing now pick what they act on from a single
  "Target" dropdown, in place of the stacked checkboxes that came before
- "Trigger Hotkey by ID" fetches its choices from OBS instead of using a static list
- "Audio - Set Audio Monitoring" (was "Set Audio Monitor Type") enables, disables or toggles
  monitoring rather than selecting a monitor type, and "Audio - Monitoring" (was "Audio - Monitor
  Type") is simply active while monitoring is on — matching the mixer in OBS 32.1 and newer
- Media actions take a **Target** — a specific source, the newest playing clip, or all playing clips —
  in place of the "Currently Playing" checkbox. That checkbox acted on the last clip that had started
  at any point, even after it stopped, which rarely matched the `current_media_*` variables shown on
  the same button

  Existing configurations are converted automatically wherever these changed, including the advanced
  feedbacks that boolean and value feedbacks replace:

  - "Scene - Preview / Program" becomes "Scene - Program", or "Scene - Preview" if it was set to
    preview only. One set to "Program and Preview" can only carry over the program half, so add a
    "Scene - Preview" feedback alongside it if you want both
  - "Audio - Meter" becomes "Audio - Peaking" with the same source and threshold; for metering, use
    the new "Audio - Peak Level (dB)" value feedback
  - "Streaming - Stream Congestion" becomes "Streaming - Stream Congestion Above", keeping the colour
    chosen for high congestion; for the full range, use "Streaming - Stream Congestion Level"
  - Monitoring feedbacks that matched "Off" are inverted, and the "Currently Playing" checkbox becomes
    the "newest playing clip" target

### Fixed

- Sources inside a group could not be shown or hidden, and setting the visibility of every source in a
  scene skipped anything inside a group entirely
- A source added to the same scene more than once only ever responded on one of its copies, so Toggle
  appeared to stop working after the first press
- Outputs registered by a plugin after Companion connected (such as DistroAV's NDI output) did not
  appear in the Output action and feedback until the connection was restarted. OBS has no event for an
  output being created, so the list is now re-enumerated periodically
- The simple streaming output appeared as an Output target, duplicating the dedicated streaming actions
- Recording status briefly showed "Unknown" when resuming a paused recording
- Cached source filter settings did not refresh when changed in OBS or by another client

## [3.15.3] - 2026-01-11

### Fixed

- Set Source Visibility action not working when a source is in a group

## [3.15.2] - 2025-12-30

### Fixed

- Recording timecode variables not updating properly

## [3.15.1] - 2025-12-20

### Fixed

- Possible timeouts when using a scene collection that creates a large number of variables
- Set Source Visibility action and feedback not working when a source is in multiple scenes

## [3.15.0] - 2025-12-01

### Added

- WHIP options in the Set Stream Settings action

## [3.14.0] - 2025-11-23

### Added

- Set Text Properties action
- Adjust Transition Type action
- Update Media Source Local File Path action
- Reset Video Capture Device action (deactivates and reactivates a source to reset it, helpful for resolving issues with capture devices on Windows)
- `transition_list` variable (list of available transition types)

## [3.13.2] - 2025-11-03

### Fixed

- Vendor events not being handled

## [3.13.1] - 2025-09-14

### Fixed

- Set Source Text action not handling the newline character

## [3.13.0] - 2025-04-20

### Added

- Adjust Audio Sync Offset action
- Adjust Audio Balance action

## [3.12.0] - 2025-03-29

### Added

- Separate hours, minutes, and seconds variants of the `recording_timecode` and `stream_timecode` variables
- Custom file name support in the Take Screenshot action
- Variable support for the custom file path in the Take Screenshot action

### Fixed

- Scene filters not appearing in the filters dropdown

## [3.11.0] - 2025-02-11

### Added

- Fade Source Volume action, which fades a source's volume to a target value over a set duration
- Threshold option in the Audio Meter feedback, so sources with no signal or a high noise floor do not always show the green color feedback
- Sequential execution support for all actions _(requires Companion 3.5)_

### Fixed

- Current Media variables showing info from media that is playing but not in program
- Current Media variables disappearing when media is paused but still in program
- Previous Scene feedback and `scene_previous` variable showing the incorrect scene after disconnecting and reconnecting to OBS
- Quick Transition not working after being used once in some instances

## [3.10.1] - 2025-01-18

### Fixed

- Allow hyphens in source variable names

## [3.10.0] - 2024-11-16

### Added

- Variable support in the Set Filter Settings action
- Variable support in the Set Stream Settings action

## [3.9.1] - 2024-09-22

### Fixed

- New text sources not populating in action dropdowns if Companion was already open
- Text and media sources occasionally duplicated in the dropdown list
- Invalid preset steps causing issues with Bitfocus Buttons

## [3.9.0] - 2024-09-08

### Added

- `custom_command_response` variable, showing a JSON string of the response data from obs-websocket when using the Custom Command action
- `custom_command_type` and `custom_command_request` variables, showing the last Custom Command sent from Companion to obs-websocket to help with data parsing
- `vendor_event_name`, `vendor_event_type`, and `vendor_event_data` variables, allowing data processing from custom Vendor Event messages

## [3.8.0] - 2024-09-01

### Added

- Allow custom variables or strings in the Trigger Hotkey by ID action and the Scene in Preview / Program feedbacks

## [3.7.1] - 2024-08-12

### Fixed

- Certain text sources (gdiplus_v3) not populating in action dropdowns or variables

## [3.7.0] - 2024-06-30

### Added

- Previous Scene Active feedback
- `scene_previous` variable
- Adjust Transition Duration action
- Custom variable support in the Set Transition Duration action

## [3.6.0] - 2024-06-22

### Added

- Split Record action _(requires OBS 30.2)_
- Record Chapter action _(requires OBS 30.2)_

### Fixed

- Ensure feedbacks that use custom variables are re-checked if the variable changes
- Properly throw an error if unable to get initial info from obs-websocket

## [3.5.0] - 2024-06-01

### Added

- `transition_active` variable
- Set Filter Settings action

### Changed

- Allow customization of Stream Congestion feedback colors, including a color for when streaming is not active
- Allow custom variables in additional actions and feedbacks

### Fixed

- Grouped text sources not appearing in the dropdown of text sources

## [3.4.3] - 2024-02-26

### Fixed

- Module not reconnecting when OBS was reopened under specific situations on Windows

## [3.4.2] - 2024-02-21

### Fixed

- "Set Source Transform" action not working
- Error when updating input settings variables

## [3.4.1] - 2024-02-17

### Changed

- Performance improvements for scene collections with a large number of sources

### Fixed

- More accurately update action/feedback dropdowns when scenes/sources are removed
- Properly update `scene_preview` variable and Scene in Preview feedback when switching into Studio Mode
- Properly update `scene_preview` and `scene_active` variables when switching scene collections

## [3.4.0] - 2024-02-11

### Added

- Disk Space Remaining feedback to alert when available disk space is below a specified threshold
- `free_disk_space_mb` variable that returns a raw number value (no units) of MB free on disk, for use in expressions

### Changed

- Rename "Set Source Filter Visibility" to "Set Filter Visibility" since it can also be used for scenes
- Use the newly available InputSettingsChanged event (requires OBS v30.1) to more accurately update changes to `current_text`, `image_file_name`, and `media_file_name` variables

## [3.3.0] - 2023-10-28

### Added

- Preview next/previous scene actions
- Adjust source volume by percentage action
- VendorEvent feedback

### Changed

- Control all filters on a source with the "Set Source Filter Visibility" action

### Fixed

- More reliable behavior when controlling source visibility for all sources

## [3.2.0] - 2023-04-24

### Added

- Custom Vendor Request action for sending commands to third-party plugins

### Fixed

- Custom Command failing to run
- Crash when the file name for an image source was invalid

## [3.1.1] - 2023-04-18

### Fixed

- Upgrade script error crashing the module
- Additional fixes for Quick Transition causing transition state to get stuck

## [3.1.0] - 2023-04-04

### Added

- Studio Mode Enabled feedback
- Stream congestion feedback (similar to the green/yellow/red square in the OBS UI)
- Audio meters feedback (similar to the audio meters in the OBS UI)
- Audio peaking feedback for when audio is above a certain value

### Fixed

- Quick Transition actions causing transition state to get stuck
- Restored the Kbps variable
- Certain variable updates (mute, media_status, and others) not working when the source has an invalid variable name

## [3.0.1] - 2023-03-19

### Fixed

- Set Preview Scene action now properly sends the scene to preview instead of program
- Possible error when executing upgrade scripts

## [3.0.0] - 2023-02-15

### Added

- Rewrite to support Companion v3
- Variables for scene names based on the scene order within OBS

### Fixed

- Filter Enabled feedback now properly lists all filters

## [2.0.5] - 2022-11-10

### Changed

- Allow hostnames to be used in the module configuration

### Fixed

- All text sources now appear as choices in the Set Text action dropdown on startup

## [2.0.4] - 2022-10-24

### Changed

- Update obs-websocket-js to the latest version
- Use obs-websocket's Batch command for certain actions

### Fixed

- When using Set Scene Visibility on a group source, the sources within groups are no longer affected
- Toggle/Start/Stop Output now works properly with Virtual Camera

## [2.0.3] - 2022-09-25

### Fixed

- Properly detect more types of disconnections and update module status
- Grouped sources can now be enabled / disabled via the "Set Source Visibility" action
- Grouped sources feedback is now accurate

## [2.0.2] - 2022-09-08

### Added

- Allow Global Audio Devices to be choices for actions, feedback, and variables

### Fixed

- Show scenes in the Open Projector action choices

## [2.0.1] - 2022-09-03

### Fixed

- Prevent issue when using more than one instance of the OBS module
- Add filters from scenes, not just sources

## [2.0.0] - 2022-08-11

### Added

- Support for obs-websocket version 5.0.0
- New "Current Media" option on all media control actions
- Custom variables for the "Set Program Scene", "Set Preview Scene", and "Custom Command" actions
- Ability to specify a specific scene for a source in the "Source Visible in Program" feedback
- New actions: Toggle Recording Pause, Open Source Properties Window, Open Source Filters Window, Open Source Interact Window
- New feedback: Replay Buffer Active
- New variables: `recording_path`, `stream_service`, `base_resolution`, `output_resolution`, `target_framerate`, `replay_buffer_path`

### Fixed

- Take Screenshot action now works again
- Recording feedback now properly reflects recording state

_Releases prior to 2.0.0 are not documented here._

[Unreleased]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.15.3...HEAD
[3.15.3]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.15.2...v3.15.3
[3.15.2]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.15.1...v3.15.2
[3.15.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.15.0...v3.15.1
[3.15.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.14.0...v3.15.0
[3.14.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.13.2...v3.14.0
[3.13.2]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.13.1...v3.13.2
[3.13.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.13.0...v3.13.1
[3.13.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.12.0...v3.13.0
[3.12.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.11.0...v3.12.0
[3.11.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.10.1...v3.11.0
[3.10.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.10.0...v3.10.1
[3.10.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.9.1...v3.10.0
[3.9.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.9.0...v3.9.1
[3.9.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.8.0...v3.9.0
[3.8.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.7.1...v3.8.0
[3.7.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.7.0...v3.7.1
[3.7.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.6.0...v3.7.0
[3.6.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.5.0...v3.6.0
[3.5.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.4.3...v3.5.0
[3.4.3]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.4.2...v3.4.3
[3.4.2]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.4.1...v3.4.2
[3.4.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.4.0...v3.4.1
[3.4.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.3.0...v3.4.0
[3.3.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.2.0...v3.3.0
[3.2.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.1.1...v3.2.0
[3.1.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.1.0...v3.1.1
[3.1.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.0.1...v3.1.0
[3.0.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v3.0.0...v3.0.1
[3.0.0]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.5...v3.0.0
[2.0.5]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.4...v2.0.5
[2.0.4]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.3...v2.0.4
[2.0.3]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.2...v2.0.3
[2.0.2]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/bitfocus/companion-module-obs-studio/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/bitfocus/companion-module-obs-studio/releases/tag/v2.0.0
