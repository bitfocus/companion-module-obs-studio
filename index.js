var instance_skel = require('../../instance_skel')
var tcp = require('../../tcp')
var hotkeys = require('./hotkeys')
const OBSWebSocket = require('obs-websocket-js')

var debug
var log

function instance(system, id, config) {
	var self = this

	// super-constructor
	instance_skel.apply(this, arguments)

	self.actions()

	return self
}

instance.GetUpgradeScripts = function () {
	return [
		instance_skel.CreateConvertToBooleanFeedbackUpgradeScript({
			streaming: true,
			scene_item_active: true,
			profile_active: true,
			scene_collection_active: true,
			scene_item_active_in_scene: true,
			output_active: true,
			transition_active: true,
			current_transition: true,
			transition_duration: true,
			filter_enabled: true,
		}),
	]
}

instance.prototype.updateConfig = function (config) {
	var self = this
	self.config = config
	self.log('debug', 'Updating configuration.')
	if (self.obs !== undefined) {
		self.obs.disconnect()
	}
	if (self.tcp !== undefined) {
		self.tcp.destroy()
		delete self.tcp
	}
	self.init()
}

instance.prototype.init = function () {
	var self = this
	self.stopStatsPoller()
	self.stopMediaPoller()
	self.init_presets()
	self.init_variables()
	self.init_feedbacks()
	self.disable = false
	var rateLimiter = true
	self.status(self.STATUS_WARN, 'Connecting')
	if (self.obs !== undefined) {
		self.obs.disconnect()
		self.obs = undefined
	}

	// Connecting on init not necessary for OBSWebSocket. But during init try to tcp connect
	// to get the status of the module right and automatically try reconnecting. Which is
	// implemented in ../../tcp by Companion core developers.
	self.tcp = new tcp(
		self.config.host !== '' ? self.config.host : '127.0.0.1',
		self.config.port !== '' ? self.config.port : '4444'
	)

	self.tcp.on('status_change', function (status, message) {
		self.status(status, message)
	})

	self.tcp.on('error', function () {
		// Ignore
	})
	self.tcp.on('connect', function () {
		// disconnect immediately because further comm takes place via OBSWebSocket and not
		// via this tcp sockets.
		if (!self.tcp) {
			return
		}

		self.tcp.destroy()
		delete self.tcp

		// original init procedure continuing. Use OBSWebSocket to make the real connection.
		self.obs = new OBSWebSocket()
		self.states = {}
		self.scenes = {}
		self.transitions = {}
		self.outputs = {}

		self.obs
			.connect({
				address:
					(self.config.host !== '' ? self.config.host : '127.0.0.1') +
					':' +
					(self.config.port !== '' ? self.config.port : '4444'),
				password: self.config.pass,
			})
			.then(() => {
				self.status(self.STATUS_OK)
				self.log('info', 'Connected to OBS.')
				self.getVersionInfo()
				self.getStats()
				self.startStatsPoller()
				self.getStreamStatus()
				self.updateTransitionList()
				self.updateScenesAndSources()
				self.updateInfo()
				self.updateProfiles()
				self.updateSceneCollections()
				self.updateOutputList()
				self.getRecordingStatus()
				self.updateFilterList()
				self.updateSourceAudio()
				self.updateMediaSources()
				self.startMediaPoller()
			})
			.catch((err) => {
				self.status(self.STATUS_ERROR, err)
			})

		self.obs.on('error', (err) => {
			self.log('debug', 'OBS Error: ' + err)
			self.status(self.STATUS_ERROR, err)
		})

		self.obs.on('ConnectionClosed', function () {
			if (self.disable != true && self.authenticated != false) {
				self.log('error', 'Connection lost to OBS.')
				self.status(self.STATUS_ERROR)
				if (self.tcp !== undefined) {
					self.tcp.destroy()
				}
				self.init()
			} else {
			}
		})

		self.obs.on('AuthenticationFailure', function () {
			self.log('error', 'Incorrect password configured for OBS websocket.')
			self.status(self.STATUS_ERROR)
			self.authenticated = false
			if (self.tcp !== undefined) {
				self.tcp.destroy()
			}
		})

		self.obs.on('SceneCollectionChanged', function (data) {
			self.states['current_scene_collection'] = data.sceneCollection
			self.setVariable('scene_collection', data.sceneCollection)
			self.checkFeedbacks('scene_collection_active')
		})

		self.obs.on('SceneCollectionListChanged', function () {
			self.updateSceneCollectionList()
		})

		self.obs.on('SwitchScenes', function (data) {
			self.states['scene_active'] = data['scene-name']
			self.setVariable('scene_active', data['scene-name'])
			self.checkFeedbacks('scene_active')
			self.updateScenesAndSources()
			self.updateSourceAudio()
		})

		self.obs.on('PreviewSceneChanged', function (data) {
			self.states['scene_preview'] = data['scene-name']
			self.setVariable('scene_preview', data['scene-name'])
			self.checkFeedbacks('scene_active')
			self.checkFeedbacks('scene_item_previewed')
		})

		self.obs.on('ScenesChanged', function () {
			self.updateScenesAndSources()
		})

		self.obs.on('SceneItemAdded', function () {
			self.updateScenesAndSources()
			self.updateMediaSources()
		})

		self.obs.on('SourceDestroyed', function () {
			self.updateScenesAndSources()
			self.updateFilterList()
			self.updateMediaSources()
		})

		self.obs.on('StreamStarted', function () {
			self.states['streaming'] = true
			self.checkFeedbacks('streaming')
		})

		self.obs.on('StreamStopped', function () {
			self.setVariable('streaming', 'Off-Air')
			self.states['streaming'] = false
			self.checkFeedbacks('streaming')
			self.states['stream_timecode'] = '00:00:00'
			self.setVariable('stream_timecode', self.states['stream_timecode'])
			self.states['total_stream_time'] = '00:00:00'
			self.setVariable('total_stream_time', self.states['total_stream_time'])
		})

		self.obs.on('StreamStatus', function (data) {
			self.process_stream_vars(data)
		})

		self.obs.on('RecordingStarted', function (data) {
			self.getRecordingStatus()
			self.states['recordingFilename'] = data['recordingFilename'].substring(
				data['recordingFilename'].lastIndexOf('/') + 1
			)
			self.setVariable('recording_file_name', self.states['recordingFilename'])
		})

		self.obs.on('RecordingStopped', function () {
			self.getRecordingStatus()
		})

		self.obs.on('RecordingPaused', function () {
			self.getRecordingStatus()
		})

		self.obs.on('RecordingResumed', function () {
			self.getRecordingStatus()
		})

		self.obs.on('StudioModeSwitched', function (data) {
			if (data['new-state'] == true) {
				self.states['studio_mode'] = true
			} else {
				self.states['studio_mode'] = false
			}
			self.updateScenesAndSources()
		})

		self.obs.on('SceneItemVisibilityChanged', function () {
			self.updateScenesAndSources()
		})

		self.obs.on('SceneItemTransformChanged', function (data) {
			if (!rateLimiter) return
			if (self.mediaSources[data.itemName]) {
				self.updateMediaSourcesInfo()
			}
			if (self.imageSources[data.itemName]) {
				self.updateImageSources(data.itemName)
			}
			rateLimiter = false
			setTimeout(function () {
				rateLimiter = true
			}, 1000)
		})

		self.obs.on('TransitionListChanged', function () {
			self.updateTransitionList()
		})

		self.obs.on('TransitionDurationChanged', function (data) {
			self.states['transition_duration'] = data['new-duration'] === undefined ? 0 : data['new-duration']
			self.setVariable('transition_duration', self.states['transition_duration'])
			self.checkFeedbacks('transition_duration')
		})

		self.obs.on('SwitchTransition', function (data) {
			self.states['current_transition'] = data['transition-name']
			self.setVariable('current_transition', self.states['current_transition'])
			self.checkFeedbacks('current_transition')
		})

		self.obs.on('TransitionBegin', function () {
			self.states['transition_active'] = true
			self.checkFeedbacks('transition_active')
		})

		self.obs.on('TransitionEnd', function () {
			self.states['transition_active'] = false
			self.checkFeedbacks('transition_active')
		})

		self.obs.on('ProfileChanged', (data) => {
			self.states['current_profile'] = data.profile
			self.setVariable('profile', data.profile)
			self.checkFeedbacks('profile_active')
		})

		self.obs.on('ProfileListChanged', () => {
			self.updateProfileList()
		})

		self.obs.on('SourceFilterVisibilityChanged', (data) => {
			self.updateFilters(data.sourceName)
		})

		self.obs.on('SourceFilterAdded', () => {
			self.updateFilterList()
		})

		self.obs.on('SourceFilterRemoved', () => {
			self.updateFilterList()
		})

		self.obs.on('SourceMuteStateChanged', (data) => {
			self.sourceAudio['muted'][data.sourceName] = data.muted
			self.checkFeedbacks('audio_muted')
		})

		self.obs.on('SourceAudioActivated', () => {
			self.updateSourceAudio()
		})

		self.obs.on('SourceAudioDeactivated', () => {
			self.updateSourceAudio()
		})

		self.obs.on('SourceVolumeChanged', (data) => {
			self.sourceAudio['volume'][data.sourceName] = self.roundIfDefined(data.volumeDb, 1)
			self.checkFeedbacks('volume')
			self.setVariable('volume_' + data.sourceName, self.sourceAudio['volume'][data.sourceName] + ' dB')
		})

		self.obs.on('MediaPlaying', (data) => {
			if (self.mediaSources[data.sourceName]) {
				self.mediaSources[data.sourceName]['mediaState'] = 'Playing'
				self.checkFeedbacks('media_playing')
				self.setVariable('media_status_' + data.sourceName, 'Playing')
			}
		})

		self.obs.on('MediaStarted', (data) => {
			if (self.mediaSources[data.sourceName]) {
				self.mediaSources[data.sourceName]['mediaState'] = 'Playing'
				self.checkFeedbacks('media_playing')
				self.setVariable('media_status_' + data.sourceName, 'Playing')
				self.updateMediaSources()
			}
		})

		self.obs.on('MediaPaused', (data) => {
			if (self.mediaSources[data.sourceName]) {
				self.mediaSources[data.sourceName]['mediaState'] = 'Paused'
				self.checkFeedbacks('media_playing')
				self.setVariable('media_status_' + data.sourceName, 'Paused')
			}
		})

		self.obs.on('MediaStopped', (data) => {
			if (self.mediaSources[data.sourceName]) {
				self.mediaSources[data.sourceName]['mediaState'] = 'Stopped'
				self.checkFeedbacks('media_playing')
				self.setVariable('media_status_' + data.sourceName, 'Stopped')
			}
		})

		self.obs.on('MediaEnded', (data) => {
			if (self.mediaSources[data.sourceName]) {
				self.mediaSources[data.sourceName]['mediaState'] = 'Ended'
				self.checkFeedbacks('media_playing')
				self.setVariable('media_status_' + data.sourceName, 'Ended')
			}
		})
	})

	debug = self.debug
	log = self.log
}

instance.prototype.roundIfDefined = (number, decimalPlaces) => {
	if (number) {
		return Number(Math.round(number + 'e' + decimalPlaces) + 'e-' + decimalPlaces)
	} else {
		return number
	}
}

instance.prototype.process_stream_vars = function (data) {
	var self = this

	for (var s in data) {
		self.states[s] = data[s]
	}

	self.setVariable('bytes_per_sec', data['bytes-per-sec'])
	self.setVariable('num_dropped_frames', data['num-dropped-frames'])
	self.setVariable('num_total_frames', data['num-total-frames'])

	if (data['kbits-per-sec']) {
		self.setVariable('kbits_per_sec', data['kbits-per-sec'].toLocaleString())
	}

	self.setVariable('average_frame_time', self.roundIfDefined(data['average-frame-time'], 2))
	self.setVariable('strain', data['strain'])
	self.setVariable('stream_timecode', data['stream-timecode'] ? data['stream-timecode'].slice(0, 8) : '00:00:00')
	self.setVariable('streaming', data['streaming'] ? 'Live' : 'Off-Air')

	const toTimecode = (value) => {
		let valueNum = parseInt(value, 10)
		let hours = Math.floor(valueNum / 3600)
		let minutes = Math.floor(valueNum / 60) % 60
		let seconds = valueNum % 60

		return [hours, minutes, seconds].map((v) => (v < 10 ? '0' + v : v)).join(':')
	}

	self.setVariable('total_stream_time', toTimecode(data['total-stream-time']))

	self.process_obs_stats(data)

	self.checkFeedbacks('streaming')
}

instance.prototype.process_obs_stats = function (data) {
	var self = this

	for (var s in data) {
		self.states[s] = data[s]
	}

	self.setVariable('fps', self.roundIfDefined(data['fps'], 2))
	self.setVariable('render_total_frames', data['render-total-frames'])
	self.setVariable('render_missed_frames', data['render-missed-frames'])
	self.setVariable('output_total_frames', data['output-total-frames'])
	self.setVariable('output_skipped_frames', data['output-skipped-frames'])
	self.setVariable('average_frame_time', self.roundIfDefined(data['average-frame-time'], 2))
	self.setVariable('cpu_usage', self.roundIfDefined(data['cpu-usage'], 2) + '%')
	self.setVariable('memory_usage', self.roundIfDefined(data['memory-usage'], 0) + ' MB')
	let freeSpace = self.roundIfDefined(data['free-disk-space'], 0)
	if (freeSpace > 1000) {
		self.setVariable('free_disk_space', self.roundIfDefined(freeSpace / 1000, 0) + ' GB')
	} else {
		self.setVariable('free_disk_space', self.roundIfDefined(freeSpace, 0) + ' MB')
	}
}

// Return config fields for web config
instance.prototype.config_fields = function () {
	var self = this
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 8,
			regex: self.REGEX_IP,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 4,
			default: 4449,
			regex: self.REGEX_PORT,
		},
		{
			type: 'textinput',
			id: 'pass',
			label: 'Password',
			width: 4,
		},
	]
}

instance.prototype.getVersionInfo = async function () {
	let self = this

	self.obs.send('GetVersion').then((data) => {
		var websocketVersion = parseInt(data['obs-websocket-version'].replaceAll('.', ''))
		if (websocketVersion < 491) {
			self.log(
				'warn',
				'Update to the latest version of the OBS Websocket plugin to ensure full feature compatibility. A download link is available in the help menu for the OBS module.'
			)
		} else if (websocketVersion >= 500) {
			self.log('error', 'Version 5.0.0 of OBS Websocket is not yet supported. Please use the 4.9.1 release.')
		}
	})
}

instance.prototype.getStats = async function () {
	let { stats } = await this.obs.send('GetStats')
	this.process_obs_stats(stats)
}

instance.prototype.startStatsPoller = function () {
	this.stopStatsPoller()

	let self = this
	this.statsPoller = setInterval(() => {
		if (self.obs && !self.states['streaming']) {
			self.getStats()
		}
		if (self.obs && self.states['recording'] === true) {
			self.getRecordingStatus()
		}
		if (self.obs) {
			self.updateOutputs()
		}
	}, 1000)
}

instance.prototype.stopStatsPoller = function () {
	if (this.statsPoller) {
		clearInterval(this.statsPoller)
		this.statsPoller = null
	}
}

instance.prototype.getStreamStatus = function () {
	var self = this

	self.obs.send('GetStreamingStatus').then((data) => {
		self.setVariable('streaming', data['streaming'] ? 'Live' : 'Off-Air')
		self.setVariable('stream_timecode', data['stream-timecode'] ? data['stream-timecode'].slice(0, 8) : '00:00:00')
		self.states['streaming'] = data['streaming']
		self.checkFeedbacks('streaming')
		if (data['streaming'] === false) {
			self.setVariable('bytes_per_sec', 0)
			self.setVariable('kbits_per_sec', 0)
			self.setVariable('num_dropped_frames', 0)
			self.setVariable('num_total_frames', 0)
			self.setVariable('strain', 0)
			self.setVariable('total_stream_time', '00:00:00')
		}
		self.init_feedbacks()
	})
}

instance.prototype.getRecordingStatus = async function () {
	var self = this

	self.obs.send('GetRecordingStatus').then((data) => {
		if (data['isRecordingPaused']) {
			self.setVariable('recording', 'Paused')
			self.states['recording'] = 'paused'
		} else {
			self.setVariable('recording', data['isRecording'] == true ? 'Recording' : 'Stopped')
			self.states['recording'] = data['isRecording']
		}
		self.checkFeedbacks('recording')
		self.states['recording_timecode'] = data['recordTimecode'] ? data['recordTimecode'].slice(0, 8) : '00:00:00'
		self.setVariable('recording_timecode', self.states['recording_timecode'])
		if (self.states['recordingFilename'] === undefined) {
			self.states['recordingFilename'] = 'No current recording'
			self.setVariable('recording_file_name', self.states['recordingFilename'])
		}
	})
}

instance.prototype.updateTransitionList = async function () {
	var self = this

	let data = await self.obs.send('GetTransitionList')
	self.transitions = {}
	self.states['current_transition'] = data['current-transition']
	self.setVariable('current_transition', self.states['current_transition'])
	self.checkFeedbacks('current_transition')
	self.states['transition_active'] = false
	for (var s in data.transitions) {
		var transition = data.transitions[s]
		self.transitions[transition.name] = transition
	}
	self.obs.send('GetTransitionDuration').then((data) => {
		self.states['transition_duration'] = data['transition-duration'] === undefined ? 0 : data['transition-duration']
		self.setVariable('transition_duration', self.states['transition_duration'])
		self.checkFeedbacks('transition_duration')
	})
	self.actions()
	self.init_presets()
	self.init_feedbacks()
}

instance.prototype.updateScenesAndSources = async function () {
	var self = this

	await self.obs.send('GetSourcesList').then((data) => {
		self.sources = {}
		self.imageSources = {}
		for (var s in data.sources) {
			var source = data.sources[s]
			self.sources[source.name] = source
			self.updateTextSources(source.name, source.typeId)
			if (source.typeId === 'image_source') {
				self.imageSources[source.name] = source
				self.updateImageSources(source.name, source)
			}
		}
	})

	let sceneList = await self.obs.send('GetSceneList')
	self.scenes = {}
	self.states['scene_active'] = sceneList.currentScene
	self.setVariable('scene_active', sceneList.currentScene)
	for (let scene of sceneList.scenes) {
		self.scenes[scene.name] = scene
	}

	if (self.states['studio_mode'] == true) {
		let previewScene = await self.obs.send('GetPreviewScene')
		self.states['scene_preview'] = previewScene.name
		self.setVariable('scene_preview', previewScene.name)
	} else {
		self.states['scene_preview'] = 'None'
		self.setVariable('scene_preview', 'None')
	}

	let updateSceneSources = (source, scene) => {
		if (self.sources[source.name] && self.sources[source.name]['visible']) {
			self.sources[source.name]['visible'] = true
		} else {
			self.sources[source.name] = source
			if (source.name == sceneList.currentScene) {
				self.sources[source.name]['visible'] = true
			}
			if (source.render === true && scene.name == sceneList.currentScene) {
				self.sources[source.name]['visible'] = true
				for (let nestedSource of self.scenes[source.name].sources) {
					self.sources[nestedSource.name] = nestedSource
					if (nestedSource.render === true && nestedSource.type == 'scene') {
						self.sources[nestedSource.name]['visible'] = true
						for (let nestedSceneSource of self.scenes[nestedSource.name].sources) {
							self.sources[nestedSceneSource.name] = nestedSceneSource
							if (nestedSceneSource.render === true) {
								self.sources[nestedSceneSource.name]['visible'] = true
							}
							if (nestedSceneSource.render === true && nestedSceneSource.type === 'group') {
								updateGroupedSources(nestedSceneSource, scene)
							}
						}
					} else if (nestedSource.render === true && nestedSource.type == 'group') {
						self.sources[nestedSource.name]['visible'] = true
						updateGroupedSources(nestedSource, scene)
					} else if (nestedSource.render === true) {
						self.sources[nestedSource.name]['visible'] = true
					}
				}
			}
		}
	}

	let updateGroupedSources = (source, scene) => {
		if (source.render === true && self.sources[source.name] && scene.name == sceneList.currentScene) {
			self.sources[source.name]['visible'] = true
		}
		if (source.render === true) {
			for (let s in source.groupChildren) {
				let groupedSource = source.groupChildren[s]
				if (groupedSource.type == 'scene') {
					updateSceneSources(groupedSource, scene)
				} else if (groupedSource.render === true && source.render === true && scene.name == sceneList.currentScene) {
					self.sources[groupedSource.name]['visible'] = true
				}
			}
		}
	}

	let updateRegularSources = (source, scene) => {
		if (self.sources[source.name] && self.sources[source.name]['visible'] === true) {
			self.sources[source.name]['visible'] = true
		} else if (source.render === true && scene.name && scene.name == sceneList.currentScene) {
			self.sources[source.name]['visible'] = true
		}
	}

	sceneList.scenes.forEach((scene) => {
		for (let source of scene.sources) {
			if (source.type == 'scene') {
				updateSceneSources(source, scene)
			} else if (source.type == 'group') {
				updateGroupedSources(source, scene)
			} else {
				updateRegularSources(source, scene)
			}
		}
	})

	self.actions()
	self.init_presets()
	self.init_feedbacks()
	self.checkFeedbacks('scene_item_active')
	self.checkFeedbacks('scene_item_active_in_scene')
	self.checkFeedbacks('scene_item_previewed')
	self.checkFeedbacks('scene_active')
}

instance.prototype.updateInfo = function () {
	var self = this
	self.obs.send('GetStudioModeStatus').then((data) => {
		if (data['studio-mode'] == true) {
			self.states['studio_mode'] = true
		} else {
			self.states['studio_mode'] = false
		}
	})
	self.obs.send('GetRecordingFolder').then((data) => {
		self.states['rec-folder'] = data['rec-folder']
	})
}

instance.prototype.updateProfiles = function () {
	this.updateProfileList()
	this.updateCurrentProfile()
}

instance.prototype.updateProfileList = async function () {
	let data = await this.obs.send('ListProfiles')
	this.profiles = data.profiles.map((p) => p['profile-name'])
	this.actions()
	this.init_feedbacks()
}

instance.prototype.updateCurrentProfile = async function () {
	let { profileName } = await this.obs.send('GetCurrentProfile')

	this.states['current_profile'] = profileName
	this.setVariable('profile', profileName)
	this.checkFeedbacks('profile_active')
}

instance.prototype.updateSceneCollections = function () {
	this.updateSceneCollectionList()
	this.updateCurrentSceneCollection()
}

instance.prototype.updateSceneCollectionList = async function () {
	let data = await this.obs.send('ListSceneCollections')
	this.sceneCollections = data.sceneCollections.map((s) => s['sc-name'])
	this.actions()
	this.init_feedbacks()
}

instance.prototype.updateCurrentSceneCollection = async function () {
	let { scName } = await this.obs.send('GetCurrentSceneCollection')

	this.states['current_scene_collection'] = scName
	this.setVariable('scene_collection', scName)
	this.checkFeedbacks('scene_collection_active')
}

instance.prototype.updateOutputList = async function () {
	var self = this

	await self.obs.send('ListOutputs').then((data) => {
		self.outputs = {}
		for (var s in data.outputs) {
			var output = data.outputs[s]
			self.outputs[output.name] = output
			self.states[output.name] = output.active
		}
		self.actions()
		self.checkFeedbacks('output_active')
	})
}

instance.prototype.updateOutputs = async function () {
	var self = this

	await self.obs.send('ListOutputs').then((data) => {
		self.outputs = {}
		for (var s in data.outputs) {
			var output = data.outputs[s]
			self.outputs[output.name] = output
			self.states[output.name] = output.active
		}
		self.checkFeedbacks('output_active')
	})
}

instance.prototype.updateFilterList = function () {
	var self = this
	self.filters = {}
	self.sourceFilters = {}
	self.obs.send('GetSourcesList').then((data) => {
		for (var s in data.sources) {
			let source = data.sources[s]
			getSourceFilters(source.name)
		}
	})
	self.obs.send('GetSceneList').then((data) => {
		for (var s in data.scenes) {
			let source = data.scenes[s]
			getSourceFilters(source.name)
		}
	})
	let getSourceFilters = (source) => {
		self.obs
			.send('GetSourceFilters', {
				sourceName: source,
			})
			.then((data) => {
				if (data.filters.length !== 0) {
					for (var s in data.filters) {
						var filter = data.filters[s]
						self.filters[filter.name] = filter
					}
					self.sourceFilters[source] = data.filters
					self.actions()
					self.init_feedbacks()
					self.checkFeedbacks('filter_enabled')
				}
			})
	}
}

instance.prototype.updateFilters = function (source) {
	var self = this
	self.obs
		.send('GetSourceFilters', {
			sourceName: source,
		})
		.then((data) => {
			self.sourceFilters[source] = data.filters
			self.checkFeedbacks('filter_enabled')
		})
}

instance.prototype.updateSourceAudio = function () {
	var self = this
	self.sourceAudio = {
		volume: [],
		muted: [],
		audio_monitor_type: [],
	}
	self.obs.send('GetSourcesList').then((data) => {
		for (var s in data.sources) {
			let source = data.sources[s]
			getSourceAudio(source.name)
		}
	})
	let getSourceAudio = (source) => {
		self.obs
			.send('GetVolume', {
				source: source,
				useDecibel: true,
			})
			.then((data) => {
				self.sourceAudio['volume'][source] = self.roundIfDefined(data.volume, 1)
				self.sourceAudio['muted'][source] = data.muted
				self.checkFeedbacks('audio_muted')
				self.checkFeedbacks('volume')
				self.setVariable('volume_' + source, self.sourceAudio['volume'][source] + ' dB')
			})
		self.obs
			.send('GetAudioMonitorType', {
				sourceName: source,
			})
			.then((data) => {
				self.sourceAudio['audio_monitor_type'][source] = data.monitorType
				self.checkFeedbacks('audio_monitor_type')
			})
	}
}

instance.prototype.updateMediaSources = function () {
	var self = this
	self.mediaSources = {}
	self.obs.send('GetMediaSourcesList').then((data) => {
		for (var s in data.mediaSources) {
			let mediaSource = data.mediaSources[s]
			self.mediaSources[mediaSource.sourceName] = mediaSource
			self.mediaSources[mediaSource.sourceName]['mediaState'] =
				mediaSource.mediaState.charAt(0).toUpperCase() + mediaSource.mediaState.slice(1)
			if (self.mediaSources[mediaSource.sourceName]['mediaState'] === 'Opening') {
				self.mediaSources[mediaSource.sourceName]['mediaState'] = 'Playing'
			}
			self.setVariable(
				'media_status_' + mediaSource.sourceName,
				self.mediaSources[mediaSource.sourceName]['mediaState']
			)
			self.obs
				.send('GetMediaDuration', {
					sourceName: mediaSource.sourceName,
				})
				.then((data) => {
					self.mediaSources[mediaSource.sourceName]['mediaDuration'] = data.mediaDuration
				})
			self.obs
				.send('GetMediaTime', {
					sourceName: mediaSource.sourceName,
				})
				.then((data) => {
					self.mediaSources[mediaSource.sourceName]['mediaTime'] = data.timestamp
					self.mediaSources[mediaSource.sourceName]['mediaTimeRemaining'] =
						self.mediaSources[mediaSource.sourceName]['mediaDuration'] - data.timestamp
					if (self.mediaSources[mediaSource.sourceName]['mediaTime'] > 0) {
						self.setVariable(
							'media_time_elapsed_' + mediaSource.sourceName,
							new Date(data.timestamp).toISOString().slice(11, 19)
						)
					} else {
						self.setVariable('media_time_elapsed_' + mediaSource.sourceName, '--:--:--')
					}
					if (self.mediaSources[mediaSource.sourceName]['mediaTimeRemaining'] > 0) {
						self.setVariable(
							'media_time_remaining_' + mediaSource.sourceName,
							'-' +
								new Date(self.mediaSources[mediaSource.sourceName]['mediaTimeRemaining']).toISOString().slice(11, 19)
						)
					} else {
						self.setVariable('media_time_remaining_' + mediaSource.sourceName, '--:--:--')
					}
				})
			self.obs
				.send('GetSourceSettings', {
					sourceName: mediaSource.sourceName,
				})
				.then((data) => {
					if (data.sourceSettings.is_local_file && data.sourceSettings.local_file) {
						let filePath = data.sourceSettings.local_file
						self.mediaSources[mediaSource.sourceName]['fileName'] = filePath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
						self.setVariable(
							'media_file_name_' + mediaSource.sourceName,
							self.mediaSources[mediaSource.sourceName]['fileName']
						)
					} else if (data.sourceSettings.playlist) {
						let vlcFiles = []
						for (var s in data.sourceSettings.playlist) {
							let filePath = data.sourceSettings.playlist[s].value
							vlcFiles.push(filePath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/))
						}
						self.mediaSources[mediaSource.sourceName]['fileName'] = vlcFiles.length ? vlcFiles.join('\\n') : 'None'
					} else {
						self.mediaSources[mediaSource.sourceName]['fileName'] = 'None'
					}
					self.setVariable(
						'media_file_name_' + mediaSource.sourceName,
						self.mediaSources[mediaSource.sourceName]['fileName']
					)
				})
		}
		self.init_variables()
		self.actions()
		self.checkFeedbacks('media_playing')
	})
}

instance.prototype.updateMediaSourcesInfo = function () {
	var self = this
	for (var s in self.mediaSources) {
		let mediaSource = self.mediaSources[s]
		self.mediaSources[mediaSource.sourceName] = mediaSource
		self.mediaSources[mediaSource.sourceName]['mediaState'] =
			mediaSource.mediaState.charAt(0).toUpperCase() + mediaSource.mediaState.slice(1)
		if (self.mediaSources[mediaSource.sourceName]['mediaState'] === 'Opening') {
			self.mediaSources[mediaSource.sourceName]['mediaState'] = 'Playing'
		}
		self.setVariable('media_status_' + mediaSource.sourceName, self.mediaSources[mediaSource.sourceName]['mediaState'])
		self.obs
			.send('GetSourceSettings', {
				sourceName: mediaSource.sourceName,
			})
			.then((data) => {
				if (data.sourceSettings.is_local_file && data.sourceSettings.local_file) {
					let filePath = data.sourceSettings.local_file
					self.mediaSources[mediaSource.sourceName]['fileName'] = filePath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/)
					self.setVariable(
						'media_file_name_' + mediaSource.sourceName,
						self.mediaSources[mediaSource.sourceName]['fileName']
					)
				} else if (data.sourceSettings.playlist) {
					let vlcFiles = []
					for (var s in data.sourceSettings.playlist) {
						let filePath = data.sourceSettings.playlist[s].value
						vlcFiles.push(filePath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/))
					}
					self.mediaSources[mediaSource.sourceName]['fileName'] = vlcFiles.length ? vlcFiles.join('\\n') : 'None'
				} else {
					self.mediaSources[mediaSource.sourceName]['fileName'] = 'None'
				}
				self.setVariable(
					'media_file_name_' + mediaSource.sourceName,
					self.mediaSources[mediaSource.sourceName]['fileName']
				)
			})
	}
	self.init_variables()
	self.actions()
	self.checkFeedbacks('media_playing')
}

instance.prototype.startMediaPoller = function () {
	this.stopMediaPoller()
	let self = this
	this.mediaPoller = setInterval(() => {
		let mediaSourcesPlaying = []
		if (self.mediaSources) {
			for (var s in self.mediaSources) {
				let mediaSource = self.mediaSources[s]
				if (self.mediaSources[mediaSource.sourceName]['mediaState'] === 'Playing') {
					mediaSourcesPlaying.push(self.mediaSources[mediaSource.sourceName])
					self.obs
						.send('GetMediaTime', {
							sourceName: mediaSource.sourceName,
						})
						.then((data) => {
							self.mediaSources[mediaSource.sourceName]['mediaTime'] = data.timestamp
							let timeRemaining = self.mediaSources[mediaSource.sourceName]['mediaDuration'] - data.timestamp
							self.setVariable(
								'media_time_elapsed_' + mediaSource.sourceName,
								new Date(data.timestamp).toISOString().slice(11, 19)
							)
							self.setVariable(
								'media_time_remaining_' + mediaSource.sourceName,
								'-' + new Date(timeRemaining).toISOString().slice(11, 19)
							)
							self.setVariable('current_media_time_elapsed', new Date(data.timestamp).toISOString().slice(11, 19))
							self.setVariable(
								'current_media_time_remaining',
								'-' + new Date(timeRemaining).toISOString().slice(11, 19)
							)
							self.setVariable('current_media_name', mediaSource.sourceName)
						})
				} else if (self.mediaSources[mediaSource.sourceName]['mediaState'] === 'Stopped' || 'Ended') {
					self.setVariable('current_media_time_elapsed_' + mediaSource.sourceName, '--:--:--')
					self.setVariable('current_media_time_remaining_' + mediaSource.sourceName, '--:--:--')
				}
			}
			if (mediaSourcesPlaying.length == 0) {
				self.setVariable('current_media_time_elapsed', '--:--:--')
				self.setVariable('current_media_time_remaining', '--:--:--')
				self.setVariable('current_media_name', 'None')
			}
		}
	}, 1000)
}

instance.prototype.stopMediaPoller = function () {
	if (this.mediaPoller) {
		clearInterval(this.mediaPoller)
		this.mediaPoller = null
	}
}

instance.prototype.updateTextSources = function (source, typeId) {
	var self = this
	if (typeId === 'text_ft2_source_v2') {
		self.obs
			.send('GetTextFreetype2Properties', {
				source: source,
			})
			.then((data) => {
				self.setVariable('current_text_' + source, data.text)
			})
	}
	if (typeId === 'text_gdiplus_v2') {
		self.obs
			.send('GetTextGDIPlusProperties', {
				source: source,
			})
			.then((data) => {
				self.setVariable('current_text_' + source, data.text)
			})
	}
}

instance.prototype.updateImageSources = function (sourceName) {
	var self = this
	self.obs
		.send('GetSourceSettings', {
			sourceName: sourceName,
		})
		.then((data) => {
			if (data.sourceSettings.file) {
				let filePath = data.sourceSettings.file
				self.setVariable('image_file_name_' + sourceName, filePath.match(/[^\\\/]+(?=\.[\w]+$)|[^\\\/]+$/))
			} else {
				self.setVariable('image_file_name_' + sourceName, 'None')
			}
		})
}

// When module gets deleted
instance.prototype.destroy = function () {
	var self = this
	self.scenes = []
	self.transitions = []
	self.states = {}
	self.scenelist = []
	self.sourcelist = []
	self.profiles = []
	self.sceneCollections = []
	self.outputs = []
	self.filterlist = []
	self.filters = {}
	self.sourceFilters = {}
	self.sourceAudio = {}
	self.mediaSources = {}
	self.mediaSourceList = []
	self.feedbacks = {}
	if (self.obs !== undefined) {
		self.obs.disconnect()
	}
	if (self.tcp !== undefined) {
		self.tcp.destroy()
	}
	self.disable = true
	self.authenticated = null
	self.stopStatsPoller()
	self.stopMediaPoller()
}

instance.prototype.actions = function () {
	var self = this
	self.scenelist = []
	self.scenelistToggle = []
	self.sourcelist = []
	self.transitionlist = []
	self.profilelist = []
	self.scenecollectionlist = []
	self.outputlist = []
	self.filterlist = []
	self.mediaSourceList = []

	var s
	if (self.sources !== undefined) {
		for (s in self.sources) {
			self.sourcelist.push({ id: s, label: s })
		}
		for (s in self.scenes) {
			if (self.sourcelist.some((sourcelist) => sourcelist.id === s) === false) {
				self.sourcelist.push({ id: s, label: s })
			}
		}
		if (self.sourcelist[0]) {
			self.sourcelist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.sourcelistDefault = self.sourcelist[0].id
		} else {
			self.sourcelistDefault = ''
		}
	}

	if (self.scenes !== undefined) {
		self.scenelistToggle.push({ id: 'Current Scene', label: 'Current Scene' })
		self.scenelistToggle.push({ id: 'Preview Scene', label: 'Preview Scene' })
		for (s in self.scenes) {
			self.scenelist.push({ id: s, label: s })
			self.scenelistToggle.push({ id: s, label: s })
		}
		if (self.scenelist[0]) {
			self.scenelist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.scenelistDefault = self.scenelist[0].id
		} else {
			self.scenelistDefault = ''
		}
		if (self.scenelistToggle[0]) {
			self.scenelistToggle.sort((a, b) => (a.id < b.id ? -1 : 1))
		}
	}

	if (self.transitions !== undefined) {
		self.transitionlist.push({ id: 'Default', label: 'Default' })
		for (s in self.transitions) {
			self.transitionlist.push({ id: s, label: s })
		}
		if (self.transitionlist[0]) {
			self.transitionlist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.transitionlistDefault = self.transitionlist[0].id
		} else {
			self.transitionlistDefault = ''
		}
	}

	if (self.profiles !== undefined) {
		for (let s of self.profiles) {
			self.profilelist.push({ id: s, label: s })
		}
		if (self.profilelist[0]) {
			self.profilelist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.profilelistDefault = self.profilelist[0].id
		} else {
			self.profilelistDefault = ''
		}
	}

	if (self.sceneCollections !== undefined) {
		for (let s of self.sceneCollections) {
			self.scenecollectionlist.push({ id: s, label: s })
		}
		if (self.scenecollectionlist[0]) {
			self.scenecollectionlist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.scenecollectionlistDefault = self.scenecollectionlist[0].id
		} else {
			self.scenecollectionlistDefault = ''
		}
	}

	if (self.outputs !== undefined) {
		for (s in self.outputs) {
			if (s == 'adv_file_output') {
				//do nothing, this option doesn't work
			} else if (s == 'simple_file_output') {
				//do nothing, this option doesn't work
			} else if (s == 'simple_stream') {
				//do nothing, this option is covered with other streaming actions
			} else if (s == 'virtualcam_output') {
				self.outputlist.push({ id: s, label: 'Virtual Camera' })
			} else {
				self.outputlist.push({ id: s, label: s })
			}
		}
	}

	if (self.filters !== undefined) {
		for (s in self.filters) {
			self.filterlist.push({ id: s, label: s })
		}
		if (self.filterlist[0]) {
			self.filterlist.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.filterlistDefault = self.filterlist[0].id
		} else {
			self.filterlistDefault = ''
		}
	}

	if (self.mediaSources !== undefined) {
		for (s in self.mediaSources) {
			self.mediaSourceList.push({ id: s, label: s })
		}
		if (self.mediaSourceList[0]) {
			self.mediaSourceList.sort((a, b) => (a.id < b.id ? -1 : 1))
			self.mediaSourceListDefault = self.mediaSourceList[0].id
		} else {
			self.mediaSourceListDefault = ''
		}
	}

	self.setActions({
		enable_studio_mode: {
			label: 'Enable Studio Mode',
		},
		disable_studio_mode: {
			label: 'Disable Studio Mode',
		},
		toggle_studio_mode: {
			label: 'Toggle Studio Mode',
		},
		start_recording: {
			label: 'Start Recording',
		},
		stop_recording: {
			label: 'Stop Recording',
		},
		pause_recording: {
			label: 'Pause Recording',
		},
		resume_recording: {
			label: 'Resume Recording',
		},
		start_streaming: {
			label: 'Start Streaming',
		},
		stop_streaming: {
			label: 'Stop Streaming',
		},
		start_replay_buffer: {
			label: 'Start Replay Buffer',
		},
		stop_replay_buffer: {
			label: 'Stop Replay Buffer',
		},
		save_replay_buffer: {
			label: 'Save Replay Buffer',
		},
		set_scene: {
			label: 'Change Scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: self.scenelistDefault,
					choices: self.scenelist,
					minChoicesForSearch: 5,
				},
			],
		},
		preview_scene: {
			label: 'Preview Scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: self.scenelistDefault,
					choices: self.scenelist,
					minChoicesForSearch: 5,
				},
			],
		},
		smart_switcher: {
			label: 'Smart Scene Switcher',
			description: 'Previews selected scene or, if scene is already in preview, transitions the scene to program',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: self.scenelistDefault,
					choices: self.scenelist,
					minChoicesForSearch: 5,
				},
			],
		},
		do_transition: {
			label: 'Transition Preview to Program',
			description: 'Performs the selected transition and then makes the transition the new default',
			options: [
				{
					type: 'dropdown',
					label: 'Transition',
					id: 'transition',
					default: 'Default',
					choices: self.transitionlist,
					required: false,
					minChoicesForSearch: 5,
				},
				{
					type: 'number',
					label: 'Duration (optional; in ms)',
					id: 'transition_time',
					default: null,
					min: 0,
					max: 60 * 1000, //max is required by api
					range: false,
					required: false,
				},
			],
		},
		quick_transition: {
			label: 'Quick Transition',
			description: 'Performs the selected transition and then returns to the default transition',
			options: [
				{
					type: 'dropdown',
					label: 'Transition',
					id: 'transition',
					default: 'Default',
					choices: self.transitionlist,
					required: false,
					minChoicesForSearch: 5,
				},
				{
					type: 'number',
					label: 'Duration (optional; in ms)',
					id: 'transition_time',
					default: null,
					min: 0,
					max: 60 * 1000, //max is required by api
					range: false,
					required: false,
				},
			],
		},
		set_transition: {
			label: 'Set Transition Type',
			options: [
				{
					type: 'dropdown',
					label: 'Transitions',
					id: 'transitions',
					default: self.transitionlistDefault,
					choices: self.transitionlist,
					minChoicesForSearch: 5,
				},
			],
		},
		set_transition_duration: {
			label: 'Set Transition Duration',
			options: [
				{
					type: 'number',
					label: 'Transition time (in ms)',
					id: 'duration',
					default: null,
					min: 0,
					max: 60 * 1000, //max is required by api
					range: false,
				},
			],
		},
		StartStopStreaming: {
			label: 'Toggle Streaming',
		},
		set_stream_settings: {
			label: 'Set Stream Settings',
			options: [
				{
					type: 'textinput',
					label: 'Stream URL',
					id: 'streamURL',
					default: '',
				},
				{
					type: 'textinput',
					label: 'Stream Key',
					id: 'streamKey',
					default: '',
				},
				{
					type: 'checkbox',
					label: 'Use Authentication',
					id: 'streamAuth',
					default: false,
				},
				{
					type: 'textinput',
					label: 'User Name (Optional)',
					id: 'streamUserName',
					default: '',
				},
				{
					type: 'textinput',
					label: 'Password (Optional)',
					id: 'streamPassword',
					default: '',
				},
			],
		},
		StartStopRecording: {
			label: 'Toggle Recording',
		},
		set_source_mute: {
			label: 'Set Source Mute',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					minChoicesForSearch: 5,
				},
				{
					type: 'dropdown',
					label: 'Mute',
					id: 'mute',
					default: 'true',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
					],
				},
			],
		},
		toggle_source_mute: {
			label: 'Toggle Source Mute',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					minChoicesForSearch: 5,
				},
			],
		},
		set_volume: {
			label: 'Set Source Volume',
			description: 'Sets the volume of a source to a specific value',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					minChoicesForSearch: 5,
				},
				{
					type: 'number',
					label: 'Volume in dB (-100 to 26) ',
					id: 'volume',
					default: 0,
					min: -100,
					max: 26,
					range: false,
					required: false,
				},
			],
		},
		adjust_volume: {
			label: 'Adjust Source Volume',
			description: 'Adjusts the volume of a source by a specific increment',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					minChoicesForSearch: 5,
				},
				{
					type: 'number',
					label: 'Volume adjustment amount in dB',
					id: 'volume',
					default: 0,
					range: false,
					required: false,
				},
			],
		},
		toggle_scene_item: {
			label: 'Set Source Visibility',
			description: 'Set or toggle the visibility of a source within a scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene',
					default: 'Current Scene',
					choices: self.scenelistToggle,
					minChoicesForSearch: 5,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					minChoicesForSearch: 5,
				},
				{
					type: 'dropdown',
					label: 'Visible',
					id: 'visible',
					default: 'toggle',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
		},
		reconnect: {
			label: 'Reconnect to OBS',
		},
		'set-freetype-text': {
			label: 'Set Source Text (FreeType 2)',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					required: true,
					minChoicesForSearch: 5,
				},
				{
					type: 'textinput',
					label: 'Text',
					id: 'text',
					required: true,
				},
			],
		},
		'set-gdi-text': {
			label: 'Set Source Text (GDI+)',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					required: true,
					minChoicesForSearch: 5,
				},
				{
					type: 'textinput',
					label: 'Text',
					id: 'text',
					required: true,
				},
			],
		},
		'trigger-hotkey': {
			label: 'Trigger Hotkey by ID',
			description: 'Find the hotkey ID in your profile settings file (see module help for more info)',
			options: [
				{
					type: 'textinput',
					label: 'Hotkey ID',
					id: 'id',
					default: 'OBSBasic.StartRecording',
					required: true,
				},
			],
		},
		'trigger-hotkey-sequence': {
			label: 'Trigger Hotkey by Key',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'keyId',
					default: 'OBS_KEY_A',
					choices: hotkeys.hotkeyList,
					required: true,
					minChoicesForSearch: 5,
				},
				{
					type: 'checkbox',
					label: 'Shift',
					id: 'keyShift',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Alt / Option',
					id: 'keyAlt',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Control',
					id: 'keyControl',
					default: false,
				},
				{
					type: 'checkbox',
					label: 'Command (Mac)',
					id: 'keyCommand',
					default: false,
				},
			],
		},
		set_profile: {
			label: 'Set Profile',
			options: [
				{
					type: 'dropdown',
					label: 'Profile',
					id: 'profile',
					default: self.profilelistDefault,
					choices: self.profilelist,
					minChoicesForSearch: 5,
				},
			],
		},
		set_scene_collection: {
			label: 'Set Scene Collection',
			options: [
				{
					type: 'dropdown',
					label: 'Scene Collection',
					id: 'scene_collection',
					default: self.scenecollectionlistDefault,
					choices: self.scenecollectionlist,
					minChoicesForSearch: 5,
				},
			],
		},
		start_output: {
			label: 'Start Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.outputlist,
					required: false,
					minChoicesForSearch: 3,
				},
			],
		},
		stop_output: {
			label: 'Stop Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.outputlist,
					required: false,
					minChoicesForSearch: 3,
				},
			],
		},
		start_stop_output: {
			label: 'Toggle Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.outputlist,
					required: false,
					minChoicesForSearch: 3,
				},
			],
		},
		refresh_browser_source: {
			label: 'Refresh Browser Source',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					required: false,
					minChoicesForSearch: 5,
				},
			],
		},
		set_audio_monitor: {
			label: 'Set Audio Monitor',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					required: true,
					minChoicesForSearch: 5,
				},
				{
					type: 'dropdown',
					label: 'Monitor',
					id: 'monitor',
					default: 'none',
					choices: [
						{ id: 'none', label: 'None' },
						{ id: 'monitorOnly', label: 'Monitor Only' },
						{ id: 'monitorAndOutput', label: 'Monitor and Output' },
					],
					required: true,
				},
			],
		},
		take_screenshot: {
			label: 'Take Screenshot',
			options: [
				{
					type: 'dropdown',
					label: 'Format',
					id: 'format',
					default: 'png',
					choices: [
						{ id: 'png', label: 'png' },
						{ id: 'jpg', label: 'jpg' },
						{ id: 'bmp', label: 'bmp' },
					],
					required: true,
				},
				{
					type: 'number',
					label: 'Compression Quality (1-100, 0 is automatic)',
					id: 'compression',
					default: 0,
					min: 0,
					max: 100,
					range: false,
					required: false,
				},
				{
					type: 'dropdown',
					label: 'Source (Optional, default is current scene)',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
					required: false,
					minChoicesForSearch: 5,
				},
				{
					type: 'textinput',
					label: 'Custom File Path (Optional, default is recording path)',
					id: 'path',
					required: true,
				},
			],
		},
		toggle_filter: {
			label: 'Set Filter Visibility',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
				},
				{
					type: 'dropdown',
					label: 'Filter',
					id: 'filter',
					default: self.filterlistDefault,
					choices: self.filterlist,
				},
				{
					type: 'dropdown',
					label: 'Visibility',
					id: 'visible',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'true', label: 'On' },
						{ id: 'false', label: 'Off' },
					],
				},
			],
		},
		play_pause_media: {
			label: 'Play / Pause Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
				{
					type: 'dropdown',
					label: 'Action',
					id: 'playPause',
					default: 'toggle',
					choices: [
						{ id: 'toggle', label: 'Toggle' },
						{ id: 'false', label: 'Play' },
						{ id: 'true', label: 'Pause' },
					],
				},
			],
		},
		restart_media: {
			label: 'Restart Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
			],
		},
		stop_media: {
			label: 'Stop Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
			],
		},
		next_media: {
			label: 'Next Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
			],
		},
		previous_media: {
			label: 'Previous Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
			],
		},
		set_media_time: {
			label: 'Set Media Time',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
				{
					type: 'number',
					label: 'Timecode (in seconds)',
					id: 'mediaTime',
					default: 1,
					required: true,
				},
			],
		},
		scrub_media: {
			label: 'Scrub Media',
			options: [
				{
					type: 'dropdown',
					label: 'Media Source',
					id: 'source',
					default: self.mediaSourceListDefault,
					choices: self.mediaSourceList,
				},
				{
					type: 'number',
					label: 'Scrub Amount (in seconds, positive or negative)',
					id: 'scrubAmount',
					default: 1,
					required: true,
				},
			],
		},
		open_projector: {
			label: 'Open Projector',
			options: [
				{
					type: 'dropdown',
					label: 'Projector Type',
					id: 'type',
					default: 'Multiview',
					choices: [
						{ id: 'Multiview', label: 'Multiview' },
						{ id: 'Preview', label: 'Preview' },
						{ id: 'StudioProgram', label: 'Program' },
						{ id: 'Source', label: 'Source' },
						{ id: 'Scene', label: 'Scene' },
					],
				},
				{
					type: 'dropdown',
					label: 'Window Type',
					id: 'window',
					default: 'window',
					choices: [
						{ id: 'window', label: 'Window' },
						{ id: 'fullscreen', label: 'Fullscreen' },
					],
				},
				{
					type: 'number',
					label: 'Fullscreen Display (required for fullscreen mode) ',
					id: 'display',
					default: 1,
					min: 1,
					range: false,
				},
				{
					type: 'dropdown',
					label: 'Source / Scene (required if selected as projector type)',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
				},
			],
		},
		source_properties: {
			label: 'Set Source Properties',
			description: 'All values optional, any parameter left blank is ignored',
			options: [
				{
					type: 'dropdown',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene',
					default: 'Current Scene',
					choices: self.scenelistToggle,
					minChoicesForSearch: 5,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: self.sourcelistDefault,
					choices: self.sourcelist,
				},
				{
					type: 'number',
					label: 'Position - X (pixels)',
					id: 'positionX',
					default: '',
				},
				{
					type: 'number',
					label: 'Position - Y (pixels)',
					id: 'positionY',
					default: '',
				},
				{
					type: 'number',
					label: 'Scale - X (multiplier, 1 is 100%)',
					id: 'scaleX',
					default: '',
				},
				{
					type: 'number',
					label: 'Scale - Y (multiplier, 1 is 100%)',
					id: 'scaleY',
					default: '',
				},
				{
					type: 'number',
					label: 'Rotation (degrees clockwise)',
					id: 'rotation',
					default: '',
				},
			],
		},
	})
}

instance.prototype.action = function (action) {
	var self = this
	var handle

	if (action.action == 'reconnect') {
		self.log('warn', 'Reconnecting to OBS.')
		self.obs.disconnect()
		self.init()
		return
	}

	if (self.obs == null || self.obs.OBSWebSocket) {
		self.log('warn', 'Unable to perform action, connection lost to OBS')
		return
	}

	switch (action.action) {
		case 'enable_studio_mode':
			handle = self.obs.send('EnableStudioMode')
			break
		case 'disable_studio_mode':
			handle = self.obs.send('DisableStudioMode')
			break
		case 'toggle_studio_mode':
			handle = self.obs.send('ToggleStudioMode')
			break
		case 'start_recording':
			handle = self.obs.send('StartRecording')
			break
		case 'stop_recording':
			handle = self.obs.send('StopRecording')
			break
		case 'pause_recording':
			handle = self.obs.send('PauseRecording')
			break
		case 'resume_recording':
			handle = self.obs.send('ResumeRecording')
			break
		case 'start_streaming':
			handle = self.obs.send('StartStreaming')
			break
		case 'stop_streaming':
			handle = self.obs.send('StopStreaming')
			break
		case 'start_replay_buffer':
			handle = self.obs.send('StartReplayBuffer')
			break
		case 'stop_replay_buffer':
			handle = self.obs.send('StopReplayBuffer')
			break
		case 'save_replay_buffer':
			handle = self.obs.send('SaveReplayBuffer')
			break
		case 'set_scene':
			handle = self.obs.send('SetCurrentScene', {
				'scene-name': action.options.scene,
			})
			break
		case 'preview_scene':
			handle = self.obs.send('SetPreviewScene', {
				'scene-name': action.options.scene,
			})
			break
		case 'smart_switcher':
			if (self.states['scene_preview'] == action.options.scene) {
				handle = self.obs.send('TransitionToProgram')
			} else {
				handle = self.obs.send('SetPreviewScene', {
					'scene-name': action.options.scene,
				})
			}
			break
		case 'do_transition':
			var options = {}
			if (action.options && action.options.transition) {
				if (action.options.transition == 'Default') {
					options['with-transition'] = {}
					if (action.options.transition_time > 0) {
						options['with-transition']['duration'] = action.options.transition_time
					}
				} else {
					options['with-transition'] = {
						name: action.options.transition,
					}
					if (action.options.transition_time > 0) {
						options['with-transition']['duration'] = action.options.transition_time
					}
				}
			}
			handle = self.obs.send('TransitionToProgram', options)
			break
		case 'quick_transition':
			if (action.options.transition == 'Default') {
				handle = self.obs.send('TransitionToProgram')
			} else {
				let revertTransition = self.states['current_transition']
				let revertTransitionDuration = self.states['transition_duration']
				if (action.options.transition != 'Cut' && action.options.transition_time > 50) {
					var transitionWaitTime = action.options.transition_time + 50
				} else if (action.options.transition_time == null) {
					var transitionWaitTime = self.states['transition_duration'] + 50
				} else {
					var transitionWaitTime = 100
				}
				if (action.options.transition_time != null) {
					var transitionDuration = action.options.transition_time
				} else {
					var transitionDuration = self.states['transition_duration']
				}
				var requests = [
					{
						'request-type': 'TransitionToProgram',
						'with-transition': {
							name: action.options.transition,
							duration: transitionDuration,
						},
					},
					{
						'request-type': 'Sleep',
						sleepMillis: transitionWaitTime,
					},
					{
						'request-type': 'SetCurrentTransition',
						'transition-name': revertTransition,
					},
					{
						'request-type': 'SetTransitionDuration',
						duration: revertTransitionDuration,
					},
				]
				handle = self.obs.send('ExecuteBatch', { requests })
			}
			break
		case 'set_source_mute':
			handle = self.obs.send('SetMute', {
				source: action.options.source,
				mute: action.options.mute == 'true' ? true : false,
			})
			break
		case 'toggle_source_mute':
			handle = self.obs.send('ToggleMute', {
				source: action.options.source,
			})
			break
		case 'set_volume':
			handle = self.obs.send('SetVolume', {
				source: action.options.source,
				volume: action.options.volume,
				useDecibel: true,
			})
			break
		case 'adjust_volume':
			var newVolume = self.sourceAudio['volume'][action.options.source] + action.options.volume
			if (newVolume > 26) {
				var newVolume = 26
			} else if (newVolume < -100) {
				var newVolume = -100
			}
			handle = self.obs.send('SetVolume', {
				source: action.options.source,
				volume: newVolume,
				useDecibel: true,
			})
			break
		case 'set_transition':
			handle = self.obs.send('SetCurrentTransition', {
				'transition-name': action.options.transitions,
			})
			break
		case 'set_transition_duration':
			handle = self.obs.send('SetTransitionDuration', {
				duration: action.options.duration,
			})
			break
		case 'StartStopStreaming':
			handle = self.obs.send('StartStopStreaming')
			break
		case 'set_stream_settings':
			var streamSettings = {}

			streamSettings['settings'] = {
				server: action.options.streamURL,
				key: action.options.streamKey,
				use_auth: action.options.streamAuth,
				username: action.options.streamUserName,
				password: action.options.streamPassword,
			}

			handle = self.obs.send('SetStreamSettings', streamSettings)
			break
		case 'StartStopRecording':
			handle = self.obs.send('StartStopRecording')
			break
		case 'toggle_scene_item':
			let visible = true
			let sceneName = action.options.scene
			if (action.options.scene == 'Current Scene') {
				sceneName = self.states['scene_active']
			} else if (action.options.scene == 'Preview Scene') {
				sceneName = self.states['scene_preview']
			} else {
				sceneName = action.options.scene
			}
			if (action.options.visible == 'toggle') {
				if (sceneName) {
					let scene = self.scenes[sceneName]
					if (scene) {
						for (let source of scene.sources) {
							if (source.type == 'scene' && source.name == action.options.source) {
								visible = !source.render
							} else if (source.type == 'group') {
								if (source.name == action.options.source) {
									visible = !source.render
								} else {
									for (let groupedSource of source.groupChildren) {
										if (groupedSource.name == action.options.source) {
											visible = !groupedSource.render
										}
									}
								}
							} else if (source.name == action.options.source) {
								visible = !source.render
							}
						}
					}
				} else if (self.sources[action.options.source]) {
					visible = !self.sources[action.options.source].render
				}
			} else {
				visible = action.options.visible == 'true'
			}
			handle = self.obs.send('SetSceneItemProperties', {
				item: action.options.source,
				visible: visible,
				'scene-name': sceneName,
			})
			break
		case 'set-freetype-text':
			handle = self.obs.send('SetTextFreetype2Properties', {
				source: action.options.source,
				text: action.options.text,
			})
			self.updateTextSources(action.options.source, 'text_ft2_source_v2')
			break
		case 'set-gdi-text':
			handle = self.obs.send('SetTextGDIPlusProperties', {
				source: action.options.source,
				text: action.options.text,
			})
			self.updateTextSources(action.options.source, 'text_gdiplus_v2')
			break
		case 'trigger-hotkey':
			handle = self.obs.send('TriggerHotkeyByName', {
				hotkeyName: action.options.id,
			})
			break
		case 'trigger-hotkey-sequence':
			var keyModifiers = {}

			keyModifiers = {
				shift: action.options.keyShift,
				alt: action.options.keyAlt,
				control: action.options.keyControl,
				command: action.options.keyCommand,
			}

			handle = self.obs.send('TriggerHotkeyBySequence', {
				keyId: action.options.keyId,
				keyModifiers: keyModifiers,
			})
			break
		case 'set_profile':
			handle = self.obs.send('SetCurrentProfile', {
				'profile-name': action.options.profile,
			})
			break
		case 'set_scene_collection':
			handle = self.obs.send('SetCurrentSceneCollection', {
				'sc-name': action.options.scene_collection,
			})
			break
		case 'start_output':
			handle = self.obs.send('StartOutput', {
				outputName: action.options.output,
			})
			break
		case 'stop_output':
			handle = self.obs.send('StopOutput', {
				outputName: action.options.output,
			})
			break
		case 'start_stop_output':
			if (self.states[action.options.output] === true) {
				handle = self.obs.send('StopOutput', {
					outputName: action.options.output,
				})
			} else {
				handle = self.obs.send('StartOutput', {
					outputName: action.options.output,
				})
			}
			break
		case 'refresh_browser_source':
			handle = self.obs.send('RefreshBrowserSource', {
				sourceName: action.options.source,
			})
			break
		case 'set_audio_monitor':
			handle = self.obs.send('SetAudioMonitorType', {
				sourceName: action.options.source,
				monitorType: action.options.monitor,
			})
			break
		case 'take_screenshot':
			let date = new Date().toISOString()
			let day = date.slice(0, 10)
			let time = date.slice(11, 19).replaceAll(':', '.')
			let fileName = action.options.source ? action.options.source : self.states['scene_active']
			let fileLocation = action.options.path ? action.options.path : self.states['rec-folder']
			let filePath = fileLocation + '/' + day + '_' + fileName + '_' + time + '.' + action.options.format
			let quality = action.options.compression == 0 ? -1 : action.options.compression
			handle = self.obs.send('TakeSourceScreenshot', {
				sourceName: fileName,
				embedPictureFormat: action.options.format,
				saveToFilePath: filePath,
				fileFormat: action.options.format,
				compressionQuality: quality,
			})
		case 'toggle_filter':
			if (action.options.visible !== 'toggle') {
				var filterVisibility = action.options.visible === 'true' ? true : false
			} else if (action.options.visible === 'toggle') {
				if (self.sourceFilters[action.options.source]) {
					for (s in self.sourceFilters[action.options.source]) {
						let filter = self.sourceFilters[action.options.source][s]
						if (filter.name === action.options.filter) {
							var filterVisibility = !filter.enabled
						}
					}
				}
			}
			handle = self.obs.send('SetSourceFilterVisibility', {
				sourceName: action.options.source,
				filterName: action.options.filter,
				filterEnabled: filterVisibility,
			})
			break
		case 'play_pause_media':
			if (action.options.playPause === 'toggle') {
				handle = self.obs.send('PlayPauseMedia', {
					sourceName: action.options.source,
				})
			} else {
				handle = self.obs.send('PlayPauseMedia', {
					sourceName: action.options.source,
					playPause: action.options.playPause == 'true' ? true : false,
				})
			}
			break
		case 'restart_media':
			handle = self.obs.send('RestartMedia', {
				sourceName: action.options.source,
			})
			break
		case 'stop_media':
			handle = self.obs.send('StopMedia', {
				sourceName: action.options.source,
			})
			break
		case 'next_media':
			handle = self.obs.send('NextMedia', {
				sourceName: action.options.source,
			})
			break
		case 'previous_media':
			handle = self.obs.send('PreviousMedia', {
				sourceName: action.options.source,
			})
			break
		case 'set_media_time':
			handle = self.obs.send('SetMediaTime', {
				sourceName: action.options.source,
				timestamp: action.options.mediaTime * 1000,
			})
			break
		case 'scrub_media':
			handle = self.obs.send('ScrubMedia', {
				sourceName: action.options.source,
				timeOffset: action.options.scrubAmount * 1000,
			})
			break
		case 'open_projector':
			let monitor = action.options.window === 'window' ? -1 : action.options.display - 1
			handle = self.obs.send('OpenProjector', {
				type: action.options.type,
				monitor: monitor,
				name: action.options.source,
			})
			break
		case 'source_properties':
			let sourceScene = action.options.scene
			if (action.options.scene == 'Current Scene') {
				sourceScene = self.states['scene_active']
			} else if (action.options.scene == 'Preview Scene') {
				sourceScene = self.states['scene_preview']
			} else {
				sourceScene = action.options.scene
			}
			handle = self.obs.send('SetSceneItemProperties', {
				'scene-name': sourceScene,
				item: action.options.source,
				position: {
					x: parseFloat(action.options.positionX),
					y: parseFloat(action.options.positionY),
				},
				scale: {
					x: parseFloat(action.options.scaleX),
					y: parseFloat(action.options.scaleY),
				},
				rotation: parseFloat(action.options.rotation),
			})
			break
	}

	handle.catch((error) => {
		if (error.code == 'NOT_CONNECTED') {
			self.log('warn', 'Unable to connect to OBS. Please re-start OBS manually.')
			self.obs.disconnect()
			self.init()
		} else {
			self.log('debug', error.error)
		}
	})
}

instance.prototype.init_feedbacks = function () {
	var self = this

	var feedbacks = {}
	feedbacks['streaming'] = {
		type: 'boolean',
		label: 'Streaming Active',
		description: 'If streaming is active, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
	}

	feedbacks['recording'] = {
		label: 'Recording Status',
		description: 'If recording is active or paused, change the style of the button',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color (Recording)',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color (Recording)',
				id: 'bg',
				default: self.rgb(200, 0, 0),
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (Paused)',
				id: 'fg_paused',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color (Paused)',
				id: 'bg_paused',
				default: self.rgb(212, 174, 0),
			},
		],
	}

	feedbacks['scene_active'] = {
		label: 'Scene in Preview / Program',
		description: 'If a scene is in preview or program, change colors of the button',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color (program)',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color (program)',
				id: 'bg',
				default: self.rgb(200, 0, 0),
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (preview)',
				id: 'fg_preview',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color (preview)',
				id: 'bg_preview',
				default: self.rgb(0, 200, 0),
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: self.scenelistDefault,
				choices: self.scenelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['scene_item_active'] = {
		type: 'boolean',
		label: 'Source Visible in Program',
		description: 'If a source is visible in the program, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(200, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['scene_item_previewed'] = {
		type: 'boolean',
		label: 'Source Active in Preview',
		description: 'If a source is enabled in the preview scene, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['profile_active'] = {
		type: 'boolean',
		label: 'Profile Active',
		description: 'If a profile is active, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Profile name',
				id: 'profile',
				default: self.profilelistDefault,
				choices: self.profilelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['scene_collection_active'] = {
		type: 'boolean',
		label: 'Scene Collection Active',
		description: 'If a scene collection is active, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene collection name',
				id: 'scene_collection',
				default: self.scenecollectionlistDefault,
				choices: self.scenecollectionlist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['scene_item_active_in_scene'] = {
		type: 'boolean',
		label: 'Source Enabled in Scene',
		description: 'If a source is enabled in a specific scene, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Scene name',
				id: 'scene',
				default: self.scenelistDefault,
				choices: self.scenelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['output_active'] = {
		type: 'boolean',
		label: 'Output Active',
		description: 'If an output is currently active, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(200, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Output name',
				id: 'output',
				default: 'virtualcam_output',
				choices: self.outputlist,
				minChoicesForSearch: 3,
			},
		],
	}

	feedbacks['transition_active'] = {
		type: 'boolean',
		label: 'Transition in Progress',
		description: 'If a transition is in progress, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
	}

	feedbacks['current_transition'] = {
		type: 'boolean',
		label: 'Current Transition Type',
		description: 'If a transition type is selected, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Transition',
				id: 'transition',
				default: self.transitionlistDefault,
				choices: self.transitionlist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['transition_duration'] = {
		type: 'boolean',
		label: 'Transition Duration',
		description: 'If the transition duration is matched, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'number',
				label: 'Transition time (in ms)',
				id: 'duration',
				default: null,
				min: 0,
				max: 60 * 1000, //max is required by api
				range: false,
			},
		],
	}

	feedbacks['filter_enabled'] = {
		type: 'boolean',
		label: 'Filter Enabled',
		description: 'If a filter is enabled, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
			},
			{
				type: 'dropdown',
				label: 'Filter',
				id: 'filter',
				default: self.filterlistDefault,
				choices: self.filterlist,
			},
		],
	}

	feedbacks['audio_muted'] = {
		type: 'boolean',
		label: 'Audio Muted',
		description: 'If an audio source is muted, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(200, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
		],
	}

	feedbacks['audio_monitor_type'] = {
		type: 'boolean',
		label: 'Audio Monitor Type',
		description: 'If the audio monitor type is matched, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(200, 0, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'dropdown',
				label: 'Monitor',
				id: 'monitor',
				default: 'none',
				choices: [
					{ id: 'none', label: 'None' },
					{ id: 'monitorOnly', label: 'Monitor Only' },
					{ id: 'monitorAndOutput', label: 'Monitor and Output' },
				],
				required: true,
			},
		],
	}

	feedbacks['volume'] = {
		type: 'boolean',
		label: 'Volume',
		description: 'If an audio source volume is matched, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: self.sourcelistDefault,
				choices: self.sourcelist,
				minChoicesForSearch: 5,
			},
			{
				type: 'number',
				label: 'Volume in dB (-100 to 26) ',
				id: 'volume',
				default: 0,
				min: -100,
				max: 26,
				range: false,
				required: false,
			},
		],
	}

	feedbacks['media_playing'] = {
		type: 'boolean',
		label: 'Media Playing',
		description: 'If a media source is playing, change the style of the button',
		style: {
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(0, 200, 0),
		},
		options: [
			{
				type: 'dropdown',
				label: 'Media Source',
				id: 'source',
				default: self.mediaSourceListDefault,
				choices: self.mediaSourceList,
				minChoicesForSearch: 5,
			},
		],
	}

	self.setFeedbackDefinitions(feedbacks)
}

instance.prototype.feedback = function (feedback) {
	var self = this

	if (self.states === undefined) {
		return
	}

	if (feedback.type === 'scene_active') {
		if (self.states['scene_active'] === feedback.options.scene) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		} else if (
			self.states['scene_preview'] === feedback.options.scene &&
			typeof feedback.options.fg_preview === 'number' &&
			self.states['studio_mode'] === true
		) {
			return { color: feedback.options.fg_preview, bgcolor: feedback.options.bg_preview }
		} else {
			return {}
		}
	}

	if (feedback.type === 'streaming') {
		if (self.states['streaming'] === true) {
			return true
		}
	}

	if (feedback.type === 'recording') {
		if (self.states['recording'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		} else if (self.states['recording'] === 'paused') {
			return { color: feedback.options.fg_paused, bgcolor: feedback.options.bg_paused }
		} else {
			return {}
		}
	}

	if (feedback.type === 'scene_item_active') {
		if (self.sources[feedback.options.source] && self.sources[feedback.options.source]['visible'] === true) {
			return true
		}
	}

	if (feedback.type === 'profile_active') {
		if (self.states['current_profile'] === feedback.options.profile) {
			return true
		}
	}

	if (feedback.type === 'scene_collection_active') {
		if (self.states['current_scene_collection'] === feedback.options.scene_collection) {
			return true
		}
	}

	if (feedback.type === 'scene_item_active_in_scene') {
		let scene = self.scenes[feedback.options.scene]
		if (scene && scene.sources) {
			for (let source of scene.sources) {
				if (source.name == feedback.options.source && source.render === true) {
					return true
				}
				if (source.type == 'group') {
					for (let s in source.groupChildren) {
						if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
							return true
						}
					}
				}
			}
		}
	}

	if (feedback.type === 'scene_item_previewed') {
		let scene = self.scenes[self.states['scene_preview']]
		if (scene && scene.sources) {
			for (let source of scene.sources) {
				if (source.name == feedback.options.source && source.render === true) {
					return true
				}
				if (source.type == 'group' && source.render === true) {
					for (let s in source.groupChildren) {
						if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
							return true
						}
						if (source.groupChildren[s].type == 'scene' && source.groupChildren[s].render === true) {
							let scene = self.scenes[source.groupChildren[s].name]
							for (let source of scene.sources) {
								if (source.name == feedback.options.source && source.render === true) {
									return true
								}
								if (source.type == 'group' && source.render === true) {
									for (let s in source.groupChildren) {
										if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
											return true
										}
									}
								}
							}
						}
					}
				}
				if (source.type == 'scene' && source.render === true) {
					let scene = self.scenes[source.name]
					for (let source of scene.sources) {
						if (source.name == feedback.options.source && source.render === true) {
							return true
						}
						if (source.type == 'group' && source.render === true) {
							for (let s in source.groupChildren) {
								if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
									return true
								}
							}
						}
					}
				}
			}
		}
	}

	if (feedback.type === 'output_active') {
		if (self.states[feedback.options.output] === true) {
			return true
		}
	}

	if (feedback.type === 'transition_active') {
		if (self.states['transition_active'] === true) {
			return true
		}
	}

	if (feedback.type === 'current_transition') {
		if (feedback.options.transition === self.states['current_transition']) {
			return true
		}
	}

	if (feedback.type === 'transition_duration') {
		if (feedback.options.duration === self.states['transition_duration']) {
			return true
		}
	}

	if (feedback.type === 'filter_enabled') {
		let filters = self.sourceFilters[feedback.options.source]
		if (filters) {
			for (let filter of filters) {
				if (filter.name === feedback.options.filter && filter.enabled === true) {
					return true
				}
			}
		}
	}

	if (feedback.type === 'audio_muted') {
		if (self.sourceAudio['muted'][feedback.options.source] === true) {
			return true
		}
	}

	if (feedback.type === 'audio_monitor_type') {
		if (self.sourceAudio['audio_monitor_type'][feedback.options.source] === feedback.options.monitor) {
			return true
		}
	}

	if (feedback.type === 'volume') {
		if (self.sourceAudio['volume'][feedback.options.source] === feedback.options.volume) {
			return true
		}
	}

	if (feedback.type === 'media_playing') {
		if (
			self.mediaSources[feedback.options.source] &&
			self.mediaSources[feedback.options.source]['mediaState'] === 'Playing'
		) {
			return true
		}
	}

	return false
}

instance.prototype.init_presets = function () {
	var self = this
	var presets = []

	for (var s in self.scenelist) {
		var scene = self.scenelist[s]

		let baseObj = {
			category: 'Scene to Program',
			label: scene.label,
			bank: {
				style: 'text',
				text: scene.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_active',
					options: {
						bg: self.rgb(200, 0, 0),
						fg: self.rgb(255, 255, 255),
						bg_preview: self.rgb(0, 200, 0),
						fg_preview: self.rgb(255, 255, 255),
						scene: scene.id,
					},
				},
			],
			actions: [
				{
					action: 'set_scene',
					options: {
						scene: scene.id,
					},
				},
			],
		}

		presets.push(baseObj)

		let toPreview = {}
		presets.push(
			Object.assign(toPreview, baseObj, {
				category: 'Scene to Preview',
				actions: [
					{
						action: 'preview_scene',
						options: {
							scene: scene.id,
						},
					},
				],
				feedbacks: [
					{
						type: 'scene_active',
						options: {
							bg: self.rgb(200, 0, 0),
							fg: self.rgb(255, 255, 255),
							bg_preview: self.rgb(0, 200, 0),
							fg_preview: self.rgb(255, 255, 255),
							scene: scene.id,
						},
					},
				],
			})
		)
	}

	presets.push({
		category: 'Transitions',
		label: 'Send previewed scene to program',
		bank: {
			style: 'text',
			text: 'AUTO',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		actions: [
			{
				action: 'do_transition',
				options: {
					transition: 'Default',
				},
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
				},
			},
		],
	})

	for (var s in self.transitionlist) {
		var transition = self.transitionlist[s]

		let baseObj = {
			category: 'Transitions',
			label: transition.label,
			bank: {
				style: 'text',
				text: transition.label,
				size: 14,
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'transition_active',
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
					},
				},
			],
			actions: [
				{
					action: 'quick_transition',
					options: {
						transition: transition.id,
					},
				},
			],
		}
		presets.push(baseObj)
	}

	// Preset for Start Streaming button with colors indicating streaming status
	presets.push({
		category: 'Streaming',
		label: 'OBS Streaming',
		bank: {
			style: 'text',
			text: 'OBS STREAM',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopStreaming',
			},
		],
	})

	presets.push({
		category: 'Streaming',
		label: 'Streaming Status / Timecode',
		bank: {
			style: 'text',
			text: 'Streaming:\\n$(obs:streaming)\\n$(obs:stream_timecode)',
			size: 14,
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: self.rgb(0, 200, 0),
					color: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopStreaming',
			},
		],
	})

	// Preset for Start Recording button with colors indicating recording status
	presets.push({
		category: 'Recording',
		label: 'OBS Recording',
		bank: {
			style: 'text',
			text: 'OBS RECORD',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(200, 0, 0),
					fg: self.rgb(255, 255, 255),
					bg_paused: self.rgb(212, 174, 0),
					fg_paused: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

	presets.push({
		category: 'Recording',
		label: 'Recording Status / Timecode',
		bank: {
			style: 'text',
			text: 'Recording:\\n$(obs:recording)\\n$(obs:recording_timecode)',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(200, 0, 0),
					fg: self.rgb(255, 255, 255),
					bg_paused: self.rgb(212, 174, 0),
					fg_paused: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

	for (var s in self.outputlist) {
		let output = self.outputlist[s]

		let baseObj = {
			category: 'Outputs',
			label: 'Toggle ' + output.label,
			bank: {
				style: 'text',
				text: 'OBS ' + output.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'output_active',
					options: {
						output: output.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
					},
				},
			],
			actions: [
				{
					action: 'start_stop_output',
					options: {
						output: output.id,
					},
				},
			],
		}
		presets.push(baseObj)
	}

	for (var s in self.sourcelist) {
		let source = self.sourcelist[s]

		let baseObj = {
			category: 'Sources',
			label: source.label + 'Status',
			bank: {
				style: 'text',
				text: source.label,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_item_previewed',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
					},
				},
				{
					type: 'scene_item_active',
					options: {
						source: source.id,
					},
					style: {
						bgcolor: self.rgb(200, 0, 0),
						color: self.rgb(255, 255, 255),
					},
				},
			],
		}
		presets.push(baseObj)
	}

	presets.push({
		category: 'General',
		label: 'Computer Stats',
		bank: {
			style: 'text',
			text: 'CPU:\\n$(obs:cpu_usage)\\nRAM:\\n$(obs:memory_usage)',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
	})

	for (var s in self.mediaSourceList) {
		let mediaSource = self.mediaSourceList[s]

		let baseObj = {
			category: 'Media Sources',
			label: 'Play Pause' + mediaSource.label,
			bank: {
				style: 'text',
				text: mediaSource.label + '\\n$(obs:media_status_' + mediaSource.label + ')',
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'media_playing',
					options: {
						source: mediaSource.id,
					},
					style: {
						bgcolor: self.rgb(0, 200, 0),
						color: self.rgb(255, 255, 255),
					},
				},
			],
			actions: [
				{
					action: 'play_pause_media',
					options: {
						source: mediaSource.id,
						playPause: 'toggle',
					},
				},
			],
		}
		presets.push(baseObj)
	}

	self.setPresetDefinitions(presets)
}

instance.prototype.init_variables = function () {
	var self = this

	var variables = []

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

	for (var s in self.mediaSources) {
		let media = self.mediaSources[s]
		variables.push({ name: 'media_status_' + media.sourceName, label: 'Media status for ' + media.sourceName })
		variables.push({ name: 'media_file_name_' + media.sourceName, label: 'Media file name for ' + media.sourceName })
		variables.push({ name: 'media_time_elapsed_' + media.sourceName, label: 'Time elapsed for ' + media.sourceName })
		variables.push({
			name: 'media_time_remaining_' + media.sourceName,
			label: 'Time remaining for ' + media.sourceName,
		})
	}

	for (var s in self.sources) {
		let source = self.sources[s]
		if (source.typeId === 'text_ft2_source_v2') {
			variables.push({ name: 'current_text_' + source.name, label: 'Current text for ' + source.name })
		}
		if (source.typeId === 'text_gdiplus_v2') {
			variables.push({ name: 'current_text_' + source.name, label: 'Current text for ' + source.name })
		}
		if (source.typeId === 'image_source') {
			variables.push({ name: 'image_file_name_' + source.name, label: 'Image file name for ' + source.name })
		}
		variables.push({ name: 'volume_' + source.name, label: 'Current volume for ' + source.name })
	}

	self.setVariableDefinitions(variables)
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
