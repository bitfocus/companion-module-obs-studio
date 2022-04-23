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
		self.mediaSources = {}

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
			self.log('error', 'OBS Error: ' + err)
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
			//self.states['current_scene_collection'] = data.sceneCollection
			//self.setVariable('scene_collection', data.sceneCollection)
			//self.checkFeedbacks('scene_collection_active')
			self.obs.disconnect()
			self.log('warn', 'Briefly disconnecting from OBS while Scene Collection is changed')
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
			if (self.textSources[data.itemName]) {
				let type = self.textSources[data.itemName]?.typeId
				self.updateTextSources(data.itemName, type)
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
		self.textSources = {}
		for (var s in data.sources) {
			var source = data.sources[s]
			self.sources[source.name] = source
			if (source.typeId === 'text_ft2_source_v2' || source.typeId === 'text_gdiplus_v2') {
				self.textSources[source.name] = source
				self.updateTextSources(source.name, source.typeId)
			}
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
	self.obs.send('GetMediaSourcesList').then((data) => {
		for (var s in data.mediaSources) {
			let mediaSource = data.mediaSources[s]
			if (!self.mediaSources[mediaSource.sourceName]) self.mediaSources[mediaSource.sourceName] = {}
			self.mediaSources[mediaSource.sourceName] = Object.assign(self.mediaSources[mediaSource.sourceName], mediaSource)
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
							self.mediaSources[mediaSource.sourceName]['mediaTimeRemaining'] = timeRemaining
							try {
								self.setVariable(
									'media_time_elapsed_' + mediaSource.sourceName,
									new Date(data.timestamp).toISOString().slice(11, 19)
								)
							} catch (e) {
								self.debug(`Media time elapsed parse error: ${e}`)
							}
							try {
								self.setVariable(
									'media_time_remaining_' + mediaSource.sourceName,
									'-' + new Date(timeRemaining).toISOString().slice(11, 19)
								)
							} catch (e) {
								self.debug(`Media time remaining parse error: ${e}`)
							}
							self.setVariable('current_media_time_elapsed', new Date(data.timestamp).toISOString().slice(11, 19))
							try {
								self.setVariable(
									'current_media_time_remaining',
									'-' + new Date(timeRemaining).toISOString().slice(11, 19)
								)
							} catch (e) {
								self.log('error', `Media time remaining parse error: ${e}`)
							}
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
			self.checkFeedbacks('media_source_time_remaining')
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

// Returns true if a given scene name is in the active (on program) source, else false
instance.prototype.isSourceOnProgram = function (sourceName) {
	var self = this
	let scene = self.scenes[self.states['scene_active']]
	if (scene && scene.sources) {
		for (let source of scene.sources) {
			if (source.type == 'group') {
				for (let sourceGroupChild of source.groupChildren) {
					if (sourceGroupChild.name === sourceName) {
						//console.log('source ' + sourceGroupChild.name + ' is on program')
						return true
					}
				}
			} else if (source.name === sourceName) {
				//console.log('source ' + source.name + ' is on program')
				return true
			}
		}
	}
	return false
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
			let sceneName = action.options.scene
			let sourceName = action.options.source

			// special scene names
			if (!sceneName || sceneName === 'Current Scene') {
				sceneName = self.states['scene_active']
			} else if (sceneName === 'Preview Scene') {
				sceneName = self.states['scene_preview']
			}
			let scene = self.scenes[sceneName]

			let setSourceVisibility = function (sourceName, render) {
				let visible
				if (action.options.visible === 'toggle') {
					visible = !render
				} else {
					visible = action.options.visible == 'true'
				}
				handle = self.obs.send('SetSceneItemProperties', {
					item: sourceName,
					visible: visible,
					'scene-name': sceneName,
				})
			}

			if (scene) {
				let finished = false
				for (let source of scene.sources) {
					// allSources does not include the group, is there any use case for considering groups as well?
					if (source.type === 'group') {
						if (sourceName === source.name) {
							setSourceVisibility(source.name, source.render) // this is the group
							if (sourceName !== 'allSources') break
						}
						for (let sourceGroupChild of source.groupChildren) {
							if (sourceName === 'allSources' || sourceGroupChild.name === sourceName) {
								setSourceVisibility(sourceGroupChild.name, sourceGroupChild.render)
								if (sourceName !== 'allSources') {
									finished = true
									break
								}
							}
						}
						if (finished) break
					} else if (sourceName === 'allSources' || source.name === sourceName) {
						setSourceVisibility(source.name, source.render)
						if (sourceName !== 'allSources') break
					}
				}
			}
			break
		case 'set-freetype-text':
			var text
			self.system.emit('variable_parse', action.options.text, function (value) {
				text = value
			})
			handle = self.obs.send('SetTextFreetype2Properties', {
				source: action.options.source,
				text: text,
			})
			self.updateTextSources(action.options.source, 'text_ft2_source_v2')
			break
		case 'set-gdi-text':
			var text
			self.system.emit('variable_parse', action.options.text, function (value) {
				text = value
			})
			handle = self.obs.send('SetTextGDIPlusProperties', {
				source: action.options.source,
				text: text,
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
			let positionX
			let positionY
			let scaleX
			let scaleY
			let rotation

			this.parseVariables(action.options.positionX, function (value) {
				positionX = parseFloat(value)
			})
			this.parseVariables(action.options.positionY, function (value) {
				positionY = parseFloat(value)
			})
			this.parseVariables(action.options.scaleX, function (value) {
				scaleX = parseFloat(value)
			})
			this.parseVariables(action.options.scaleY, function (value) {
				scaleY = parseFloat(value)
			})
			this.parseVariables(action.options.rotation, function (value) {
				rotation = parseFloat(value)
			})

			handle = self.obs.send('SetSceneItemProperties', {
				'scene-name': sourceScene,
				item: action.options.source,
				position: {
					x: positionX,
					y: positionY,
				},
				scale: {
					x: scaleX,
					y: scaleY,
				},
				rotation: rotation,
			})
			break
		case 'custom_command':
			let arg
			if (action.options.arg) {
				try {
					arg = JSON.parse(action.options.arg)
				} catch (e) {
					self.log('warn', 'Request data must be formatted as valid JSON.')
					return
				}
			}
			handle = self.obs.send(action.options.command, arg)
			break
	}
	if (handle) {
		handle.catch((error) => {
			if (error.code == 'NOT_CONNECTED') {
				self.log('error', 'Unable to connect to OBS. Please re-start OBS manually.')
				self.obs.disconnect()
				self.init()
			} else {
				self.log('warn', error.error)
			}
		})
	}
}

instance.prototype.feedback = function (feedback) {
	var self = this

	if (self.states === undefined) {
		return
	}

	if (feedback.type === 'scene_active') {
		let mode = feedback.options.mode
		if (!mode) {
			mode = 'programAndPreview'
		}
		if (
			self.states['scene_active'] === feedback.options.scene &&
			(mode === 'programAndPreview' || mode === 'program')
		) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		} else if (
			self.states['scene_preview'] === feedback.options.scene &&
			typeof feedback.options.fg_preview === 'number' &&
			self.states['studio_mode'] === true &&
			(mode === 'programAndPreview' || mode === 'preview')
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
				} else if (source.type != 'group' && feedback.options.source === 'anySource' && source.render === true) {
					return true
				}
				if (source.type == 'group') {
					for (let s in source.groupChildren) {
						if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
							return true
						} else if (source.render === true) {
							// consider group members only if the parent group is active
							if (feedback.options.source === 'anySource' && source.groupChildren[s].render) {
								return true
							}
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

	if (feedback.type === 'media_source_time_remaining') {
		const {
			source: sourceName,
			rtThreshold,
			onlyIfSourceIsOnProgram,
			onlyIfSourceIsPlaying,
			blinkingEnabled,
		} = feedback.options

		let remainingTime // remaining time in seconds
		let mediaState
		if (self.mediaSources && self.mediaSources[sourceName]) {
			remainingTime = Math.round(self.mediaSources[sourceName].mediaTimeRemaining / 1000)
			mediaState = self.mediaSources[sourceName].mediaState
		}
		if (remainingTime === undefined) return false

		if (onlyIfSourceIsOnProgram && !self.isSourceOnProgram(sourceName)) {
			return false
		}

		if (onlyIfSourceIsPlaying && mediaState !== 'Playing') {
			return false
		}

		if (remainingTime <= rtThreshold) {
			if (blinkingEnabled && mediaState === 'Playing') {
				// TODO: implement a better button blinking, or wait for https://github.com/bitfocus/companion/issues/674
				if (remainingTime % 2 != 0) {
					// flash in seconds interval (checkFeedbacks interval = media poller interval)
					return false
				}
			}
			return true
		}
	}

	return false
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
