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

instance.prototype.updateConfig = function (config) {
	var self = this
	self.config = config
	self.log('debug', 'updateConfig() destroying and reiniting..')
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
	self.init_presets()
	self.init_variables()
	self.init_feedbacks()
	self.disable = false
	self.status(self.STATUS_WARN, 'Connecting')
	if (self.obs !== undefined) {
		self.obs.disconnect()
		self.obs = undefined
	}

	// Connecting on init not neccesary for OBSWebSocket. But during init try to tcp connect
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
				self.log('info', 'Success! Connected to OBS.')
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
			})
			.catch((err) => {
				self.status(self.STATUS_ERROR, err)
			})

		self.obs.on('error', (err) => {
			self.log('debug', 'Error received: ' + err)
			self.status(self.STATUS_ERROR, err)
		})

		self.obs.on('ConnectionClosed', function () {
			if (self.disable != true && self.authenticated != false) {
				self.log('error', 'Connection lost to OBS.')
				self.status(self.STATUS_ERROR)
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

		self.obs.on('SceneCollectionChanged', function () {
			self.updateTransitionList()
			self.updateScenesAndSources()
			self.updateCurrentSceneCollection()
		})

		self.obs.on('SceneCollectionListChanged', function () {
			self.updateTransitionList()
			self.updateScenesAndSources()
			self.updateSceneCollectionList()
		})

		self.obs.on('SwitchScenes', function (data) {
			self.states['scene_active'] = data['scene-name']
			self.setVariable('scene_active', data['scene-name'])
			self.checkFeedbacks('scene_active')
			self.updateScenesAndSources()
		})

		self.obs.on('PreviewSceneChanged', function (data) {
			self.states['scene_preview'] = data['scene-name']
			self.setVariable('scene_preview', data['scene-name'])
			self.checkFeedbacks('scene_active')
		})

		self.obs.on('ScenesChanged', function () {
			self.updateScenesAndSources()
		})

		self.obs.on('SceneItemAdded', function () {
			self.updateScenesAndSources()
		})

		self.obs.on('SourceDestroyed', function (data) {
			self.states[data.sourceName] = false
			self.sources[data.sourceName] = null

			self.actions()
			self.init_presets()
			self.init_feedbacks()
			self.checkFeedbacks('scene_item_active')
			self.checkFeedbacks('scene_active')
		})

		self.obs.on('StreamStarted', function (data) {
			self.process_stream_vars(data)
			self.checkFeedbacks('streaming')
		})

		self.obs.on('StreamStopped', function () {
			self.setVariable('streaming', false)
			self.states['streaming'] = false
			self.checkFeedbacks('streaming')
			self.states['stream_timecode'] = '00:00:00.000'
			self.setVariable('stream_timecode', self.states['stream_timecode'])
			self.states['total_stream_time'] = '00:00:00'
			self.setVariable('total_stream_time', self.states['total_stream_time'])
		})

		self.obs.on('StreamStatus', function (data) {
			self.process_stream_vars(data)
		})

		self.obs.on('RecordingStarted', function (data) {
			self.setVariable('recording', true)
			self.states['recording'] = true
			self.setVariable('recording', true)
			self.states['recordingFilename'] = data['recordingFilename'].substring(
				data['recordingFilename'].lastIndexOf('/') + 1
			)
			self.setVariable('recording_file_name', self.states['recordingFilename'])
			self.checkFeedbacks('recording')
		})

		self.obs.on('RecordingStopped', function () {
			self.setVariable('recording', false)
			self.states['recording'] = false
			self.checkFeedbacks('recording')
			self.states['recording_timecode'] = '00:00:00'
			self.setVariable('recording_timecode', self.states['recording_timecode'])
		})

		self.obs.on('StudioModeSwitched', function (data) {
			if (data['new-state'] == true) {
				self.states['studio_mode'] = true
			} else {
				self.states['studio_mode'] = false
			}
		})

		self.obs.on('SceneItemVisibilityChanged', function (data) {
			self.updateScenesAndSources()
		})

		self.obs.on('SceneItemTransformChanged', function (data) {
			self.updateScenesAndSources()
		})

		self.obs.on('TransitionListChanged', function (data) {
			self.updateTransitionList()
		})

		self.obs.on('TransitionDurationChanged', function (data) {
			self.updateTransitionList()
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
			self.updateCurrentProfile()
		})

		self.obs.on('ProfileListChanged', (data) => {
			self.updateProfileList()
		})

		self.obs.on('SourceFilterVisibilityChanged', () => {
			self.updateScenesAndSources()
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
	self.setVariable('preview_only', data['preview-only'])
	self.setVariable('recording', data['recording'])
	self.setVariable('strain', data['strain'])
	self.setVariable('stream_timecode', data['stream-timecode'])
	self.setVariable('streaming', data['streaming'])

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
	self.setVariable('cpu_usage', self.roundIfDefined(data['cpu-usage'], 2))
	self.setVariable('memory_usage', self.roundIfDefined(data['memory-usage'], 2))
	self.setVariable('free_disk_space', self.roundIfDefined(data['free-disk-space'], 2))
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
		var websocketVersion = parseFloat(data['obs-websocket-version'])
		if (websocketVersion < 4.9) {
			self.log(
				'warn',
				'Update to the latest version of the OBS Websocket plugin to ensure full feature compatibility. A download link is available in the help menu for the OBS module.'
			)
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
		if (self.obs && self.states['recording']) {
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
		self.setVariable('recording', data['recording'])
		self.states['recording'] = data['recording']
		self.checkFeedbacks('recording')

		self.setVariable('streaming', data['streaming'])
		self.states['streaming'] = data['streaming']
		self.checkFeedbacks('streaming')

		self.init_feedbacks()
	})
}

instance.prototype.getRecordingStatus = async function () {
	var self = this

	self.obs.send('GetRecordingStatus').then((data) => {
		self.states['recording_timecode'] = data['recordTimecode'].slice(0, 8)
		self.setVariable('recording_timecode', self.states['recording_timecode'])
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
	self.actions()
	self.init_presets()
	self.init_feedbacks()
}

instance.prototype.updateScenesAndSources = async function () {
	var self = this

	await self.obs.send('GetSourcesList').then((data) => {
		self.sources = {}
		self.filters = {}
		for (var s in data.sources) {
			var source = data.sources[s]
			self.sources[source.name] = source
		}
		data.sources.forEach((source) => {
			self.states[source.name] = false
			self.obs.send('GetSourceFilters', {
				'sourceName': source.name,
			}).then((data) => {
				self.sources[source.name]['filters'] = data.filters
				for (var s in data.filters) {
					var filter = data.filters[s]
					self.filters[filter.name] = filter
					self.log('warn', filter.name)
				}
				self.debug(data.filters)
			})
		})
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
	}

	let findNestedScenes = (sceneName) => {
		let nested = []
		if (self.scenes[sceneName]) {
			for (let source of self.scenes[sceneName].sources) {
				if (self.scenes[source.name] && source.render) {
					nested.push(source.name)
				}
			}
		}
		return nested
	}

	// Recursively find all nested visible scenes
	let lastNestedCount
	let nestedVisibleScenes = {}
	nestedVisibleScenes[sceneList.currentScene] = true

	do {
		lastNestedCount = Object.keys(nestedVisibleScenes).length
		for (let sceneName in nestedVisibleScenes) {
			for (let nested of findNestedScenes(sceneName)) {
				nestedVisibleScenes[nested] = true
			}
		}
	} while (lastNestedCount != Object.keys(nestedVisibleScenes).length)

	for (let sceneName in nestedVisibleScenes) {
		for (let source of self.scenes[sceneName].sources) {
			self.states[source.name] = source.render
		}
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
	self.feedbacks = {}
	if (self.obs !== undefined) {
		self.obs.disconnect()
	}
	if (self.tcp !== undefined) {
		self.tcp.destroy()
	}
	self.disable = true
	self.stopStatsPoller()
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

	var s
	if (self.sources !== undefined) {
		for (s in self.sources) {
			self.sourcelist.push({ id: s, label: s })
		}
	}

	if (self.scenes !== undefined) {
		self.scenelistToggle.push({ id: 'Current Scene', label: 'Current Scene' })
		for (s in self.scenes) {
			self.scenelist.push({ id: s, label: s })
			self.scenelistToggle.push({ id: s, label: s })
		}
	}

	if (self.transitions !== undefined) {
		self.transitionlist.push({ id: 'Default', label: 'Default' })
		for (s in self.transitions) {
			self.transitionlist.push({ id: s, label: s })
		}
	}

	if (self.profiles !== undefined) {
		for (let s of self.profiles) {
			self.profilelist.push({ id: s, label: s })
		}
	}

	if (self.sceneCollections !== undefined) {
		for (let s of self.sceneCollections) {
			self.scenecollectionlist.push({ id: s, label: s })
		}
	}

	if (self.outputs !== undefined) {
		for (s in self.outputs) {
			if (s == 'adv_file_output') {
				//do nothing, this option doesn't work
			} else if (s == 'simple_file_output') {
				//do nothing, this option doesn't work
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
			self.filterlist.sort((a, b) => a.id < b.id ? -1 : 1)
			self.filterlistDefault = self.filterlist[0].id
		} else {
			self.filterlistDefault = ''
		}
	}

	self.setActions({
		enable_studio_mode: {
			label: 'Enable StudioMode',
		},
		disable_studio_mode: {
			label: 'Disable StudioMode',
		},
		toggle_studio_mode: {
			label: 'Toggle StudioMode',
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
			label: 'Change scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: '0',
					choices: self.scenelist,
				},
			],
		},
		preview_scene: {
			label: 'Preview scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: '0',
					choices: self.scenelist,
				},
			],
		},
		smart_switcher: {
			label: 'Smart switcher (Previews scene or transtions to scene if in preview)',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: '0',
					choices: self.scenelist,
				},
			],
		},
		do_transition: {
			label: 'Transition preview to program',
			options: [
				{
					type: 'dropdown',
					label: 'Transition to use',
					id: 'transition',
					default: 'Default',
					choices: self.transitionlist,
					required: false,
				},
				{
					type: 'number',
					label: 'Transition time (in ms)',
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
			label: 'Change transition type',
			options: [
				{
					type: 'dropdown',
					label: 'Transitions',
					id: 'transitions',
					default: '0',
					choices: self.transitionlist,
				},
			],
		},
		set_transition_duration: {
			label: 'Set transition duration',
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
			label: 'Start and Stop Streaming',
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
			label: 'Start and Stop Recording',
		},
		set_source_mute: {
			label: 'Set Source Mute',
			options: [
				{
					type: 'textinput',
					label: 'Source',
					id: 'source',
					default: '',
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
					type: 'textinput',
					label: 'Source',
					id: 'source',
					default: '',
				},
			],
		},
		set_volume: {
			label: 'Set Source Volume',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: '',
					choices: self.sourcelist,
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
		toggle_scene_item: {
			label: 'Toggle visibility scene item',
			options: [
				{
					type: 'dropdown',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene',
					default: 'Current Scene',
					choices: self.scenelistToggle,
				},
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: '',
					choices: self.sourcelist,
				},
				{
					type: 'dropdown',
					label: 'Visible',
					id: 'visible',
					default: 'true',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
		},
		reconnect: {
			label: 'reconnect to OBS',
		},
		'set-freetype-text': {
			label: 'Set Source Text (FreeType 2)',
			options: [
				{
					type: 'textinput',
					label: 'Source Name',
					id: 'source',
					required: true,
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
					type: 'textinput',
					label: 'Source Name',
					id: 'source',
					required: true,
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
			label: 'Trigger hotkey by ID',
			tooltip: 'Find the hotkey ID in your profile settings file',
			options: [
				{
					type: 'textinput',
					label: 'Hotkey ID',
					id: 'id',
					required: true,
				},
			],
		},
		'trigger-hotkey-sequence': {
			label: 'Trigger hotkey by key',
			options: [
				{
					type: 'dropdown',
					label: 'Key',
					id: 'keyId',
					minChoicesForSearch: 5,
					default: 'OBS_KEY_A',
					choices: hotkeys.hotkeyList,
					required: true,
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
					default: '',
					choices: self.profilelist,
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
					default: '',
					choices: self.scenecollectionlist,
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
				},
			],
		},
		start_stop_output: {
			label: 'Start and Stop Output',
			options: [
				{
					type: 'dropdown',
					label: 'Output',
					id: 'output',
					default: 'virtualcam_output',
					choices: self.outputlist,
					required: false,
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
					default: '',
					choices: self.sourcelist,
					required: false,
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
					default: '',
					choices: self.sourcelist,
					required: true,
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
					default: '',
					choices: self.sourcelist,
					required: false,
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
			label: 'Toggle filter visibility',
			options: [
				{
					type: 'dropdown',
					label: 'Source',
					id: 'source',
					default: '',
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
					label: 'Visible',
					id: 'visible',
					default: 'true',
					choices: [
						{ id: 'false', label: 'False' },
						{ id: 'true', label: 'True' },
						{ id: 'toggle', label: 'Toggle' },
					],
				},
			],
		},
	})
}

instance.prototype.action = function (action) {
	var self = this
	var handle

	if (action.action == 'reconnect') {
		self.log('debug', 'reconnecting, destroying and reiniting..')
		self.obs.disconnect()
		self.init()
		return
	}

	if (self.obs == null || self.obs.OBSWebSocket) {
		self.log('warn', 'OBS action not possible, connection lost')
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
			let sceneName =
				action.options.scene && action.options.scene != 'Current Scene'
					? action.options.scene
					: self.states['scene_active']
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
			break
		case 'set-gdi-text':
			handle = self.obs.send('SetTextGDIPlusProperties', {
				source: action.options.source,
				text: action.options.text,
			})
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
			break
		case 'toggle_filter':
			if (self.sources[action.options.source] && self.sources[action.options.source]['filters']) {
				for (s in self.sources[action.options.source]['filters']) {
					let filter = self.sources[action.options.source]['filters'][s]
					if (filter.name === action.options.filter && action.options.visible !== 'toggle') {
						var filterVisibility = action.options.visible === 'true' ? true : false
					} else if (filter.name === action.options.filter && action.options.visible === 'toggle') {
						var filterVisibility = !filter.enabled
					}
				}
			}
			handle = self.obs.send('SetSourceFilterVisibility', {
				sourceName: action.options.source,
				filterName: action.options.filter,
				filterEnabled: filterVisibility,
			})
			break
	}

	handle.catch((error) => {
		if (error.code == 'NOT_CONNECTED') {
			self.log('warn', 'Send to OBS failed. Re-start OBS manually. Starting re-init')
			self.obs.disconnect()
			self.init()
		} else {
			self.log('debug', error.error)
		}
	})
}

instance.prototype.init_feedbacks = function () {
	var self = this
	// feedbacks
	var feedbacks = {}
	feedbacks['streaming'] = {
		label: 'Stream is running',
		description: 'If the stream is running, change colors of the bank',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(100, 255, 0),
			},
		],
	}

	feedbacks['recording'] = {
		label: 'Recording is active',
		description: 'If the recording is active, change colors of the bank',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(100, 255, 0),
			},
		],
	}

	feedbacks['scene_active'] = {
		label: 'Change colors from active/previewed scene',
		description: 'If the scene specified is active or previewed in OBS, change colors of the bank',
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
				default: self.rgb(255, 0, 0),
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
				default: '',
				choices: self.scenelist,
			},
		],
	}

	feedbacks['scene_item_active'] = {
		label: 'Change colors when source visible',
		description: 'If a source become visible or invisible in current scene, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0),
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: '',
				choices: self.sourcelist,
			},
		],
	}

	feedbacks['profile_active'] = {
		label: 'Change colors when profile is active',
		description: 'If the profile is active, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(0, 204, 0),
			},
			{
				type: 'dropdown',
				label: 'Profile name',
				id: 'profile',
				default: '',
				choices: self.profilelist,
			},
		],
	}

	feedbacks['scene_collection_active'] = {
		label: 'Change colors when scene collection is active',
		description: 'If the scene collection is active, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(0, 204, 0),
			},
			{
				type: 'dropdown',
				label: 'Scene collection name',
				id: 'scene_collection',
				default: '',
				choices: self.scenecollectionlist,
			},
		],
	}

	feedbacks['scene_item_active_in_scene'] = {
		label: 'Change colors when source enabled in scene',
		description: 'If a source become visible or invisible in a specific scene, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0),
			},
			{
				type: 'dropdown',
				label: 'Scene name',
				id: 'scene',
				default: '',
				choices: self.scenelist,
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: '',
				choices: self.sourcelist,
			},
		],
	}

	feedbacks['output_active'] = {
		label: 'Change colors when output active',
		description: 'If an output is currently active, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0),
			},
			{
				type: 'dropdown',
				label: 'Output name',
				id: 'output',
				default: 'virtualcam_output',
				choices: self.outputlist,
			},
		],
	}

	feedbacks['transition_active'] = {
		label: 'Change colors when a transition is in progress',
		description: 'If a transition is in progress, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0),
			},
		],
	}

	feedbacks['current_transition'] = {
		label: 'Change colors when a transition is selected',
		description: 'If an transititon type is selected, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255),
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0),
			},
			{
				type: 'dropdown',
				label: 'Transition',
				id: 'transition',
				default: 'Default',
				choices: self.transitionlist,
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
			typeof feedback.options.fg_preview === 'number'
		) {
			//FIXME fg_preview/bg_preview is undefined when updating from an older version of the module
			return { color: feedback.options.fg_preview, bgcolor: feedback.options.bg_preview }
		}
	}

	if (feedback.type === 'streaming') {
		if (self.states['streaming'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'recording') {
		if (self.states['recording'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'scene_item_active') {
		if (self.sources[feedback.options.source] && self.sources[feedback.options.source]['visible'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'profile_active') {
		if (self.states['current_profile'] === feedback.options.profile) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'scene_collection_active') {
		if (self.states['current_scene_collection'] === feedback.options.scene_collection) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'scene_item_active_in_scene') {
		let scene = self.scenes[feedback.options.scene]
		if (scene && scene.sources) {
			for (let source of scene.sources) {
				if (source.name == feedback.options.source && source.render === true) {
					return { color: feedback.options.fg, bgcolor: feedback.options.bg }
				}
				if (source.type == 'group') {
					for (let s in source.groupChildren) {
						if (source.groupChildren[s].name == feedback.options.source && source.groupChildren[s].render) {
							return { color: feedback.options.fg, bgcolor: feedback.options.bg }
						}
					}
				}
			}
		}
	}

	if (feedback.type === 'output_active') {
		if (self.states[feedback.options.output] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'transition_active') {
		if (self.states['transition_active'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	if (feedback.type === 'current_transition') {
		if (feedback.options.transition === self.states['current_transition']) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg }
		}
	}

	return {}
}

instance.prototype.init_presets = function () {
	var self = this
	var presets = []

	for (var s in self.scenes) {
		var scene = self.scenes[s]

		let baseObj = {
			category: 'Scene to program',
			label: scene.name,
			bank: {
				style: 'text',
				text: scene.name,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0,
			},
			feedbacks: [
				{
					type: 'scene_active',
					options: {
						bg: self.rgb(255, 0, 0),
						fg: self.rgb(255, 255, 255),
						bg_preview: self.rgb(0, 200, 0),
						fg_preview: self.rgb(255, 255, 255),
						scene: scene.name,
					},
				},
			],
			actions: [
				{
					action: 'set_scene',
					options: {
						scene: scene.name,
					},
				},
			],
		}

		presets.push(baseObj)

		let toPreview = {}
		presets.push(
			Object.assign(toPreview, baseObj, {
				category: 'Scene to preview',
				actions: [
					{
						action: 'preview_scene',
						options: {
							scene: scene.name,
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
			},
		],
	})

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
				options: {
					bg: self.rgb(51, 204, 51),
					fg: self.rgb(255, 255, 255),
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
					bg: self.rgb(51, 204, 51),
					fg: self.rgb(255, 255, 255),
				},
			},
		],
		actions: [
			{
				action: 'StartStopRecording',
			},
		],
	})

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
	variables.push({ name: 'free_disk_space', label: 'Free recording disk space (in megabytes)' })
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
	variables.push({ name: 'preview_only', label: 'Preview only' })
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

	self.setVariableDefinitions(variables)
}

instance_skel.extendedBy(instance)
exports = module.exports = instance
