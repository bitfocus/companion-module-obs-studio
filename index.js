var instance_skel = require('../../instance_skel');
var tcp = require("../../tcp");
const OBSWebSocket = require('obs-websocket-js');
var debug;
var log;

function instance(system, id, config) {
	var self = this;

	// super-constructor
	instance_skel.apply(this, arguments);

	self.actions();

	return self;
}

instance.prototype.updateConfig = function(config) {
	var self = this;
	self.config = config;
	self.log('debug','updateConfig() destroying and reiniting..');
	if (self.obs !== undefined) {
		self.obs.disconnect();
	}
	if (self.tcp !== undefined) {
		self.tcp.destroy();
		delete self.tcp;
	}
	self.init();
};

instance.prototype.init = function() {
	var self = this;
	self.stopStatsPoller()
	self.disable = false;
	self.status(self.STATUS_WARN, "Connecting");
	if (self.obs !== undefined) {
		self.obs.disconnect();
		self.obs = undefined;
	}

	// Connecting on init not neccesary for OBSWebSocket. But during init try to tcp connect
	// to get the status of the module right and automatically try reconnecting. Which is
	// implemented in ../../tcp by Companion core developers.
	self.tcp = new tcp((self.config.host !== '' ? self.config.host : '127.0.0.1'), (self.config.port !== '' ? self.config.port : '4444'));

	self.tcp.on('status_change', function (status, message) {
		self.status(status, message);
	});

	self.tcp.on('error', function () {
		// Ignore
	});
	self.tcp.on('connect', function () {
		// disconnect immediately because further comm takes place via OBSWebSocket and not
		// via this tcp sockets.
		self.tcp.destroy();
		delete self.tcp;

		// original init procedure continuing. Use OBSWebSocket to make the real connection.
		self.obs = new OBSWebSocket();
		self.states = {};
		self.scenes = {};
		self.transitions = {};

		self.obs.connect({
			address: (self.config.host !== '' ? self.config.host : '127.0.0.1') + ':' + (self.config.port !== '' ? self.config.port : '4444'),
			password: self.config.pass
		}).then(() => {
			self.status(self.STATUS_OK);
			self.log('info','Success! Connected to OBS.');
			self.getStats();
			self.startStatsPoller();
			self.getStreamStatus();
			self.updateTransitionList();
			self.updateScenesAndSources();
			self.updateInfo();
		}).catch(err => {
			self.status(self.STATUS_ERROR, err);
		});

		self.obs.on('error', err => {
			self.log('debug','Error received: ' + err);
			self.status(self.STATUS_ERROR, err);
		});

		self.obs.on('ConnectionClosed', function() {
			if (self.disable != true) {	
				self.log('error','Connection lost to OBS.');
				self.status(self.STATUS_ERROR);
				self.init();
			} else {
				
			}
		});

		self.obs.on('SceneCollectionChanged', function() {
			self.updateTransitionList();
			self.updateScenesAndSources();
		})

		self.obs.on('SceneCollectionListChanged', function() {
			self.updateTransitionList();
			self.updateScenesAndSources();
		})

		self.obs.on('SwitchScenes', function(data) {
			self.states['scene_active'] = data['scene-name'];
			self.setVariable('scene_active', data['scene-name']);
			self.checkFeedbacks('scene_active');
			self.updateScenesAndSources();
		});

		self.obs.on('PreviewSceneChanged', function(data) {
			self.states['scene_preview'] = data['scene-name'];
			self.setVariable('scene_preview', data['scene-name']);
			self.checkFeedbacks('scene_active');
		});

		self.obs.on('ScenesChanged', function() {
			self.updateScenesAndSources();
		});

		self.obs.on('SceneItemAdded', function() {
			self.updateScenesAndSources();
		});

		self.obs.on('SourceDestroyed', function(data) {
			self.states[data.sourceName] = false;
			self.sources[data.sourceName] = null;

			self.actions();
			self.init_presets();
			self.init_feedbacks();
			self.checkFeedbacks('scene_item_active');
			self.checkFeedbacks('scene_active');
		});

		self.obs.on('StreamStarted', function(data) {
			self.process_stream_vars(data);
			self.checkFeedbacks('streaming');
		});

		self.obs.on('StreamStopped', function() {
			self.setVariable('streaming', false);
			self.states['streaming'] = false;
			self.checkFeedbacks('streaming');
		});

		self.obs.on('StreamStatus', function(data) {
			self.process_stream_vars(data);
		});

		self.obs.on('RecordingStarted', function() {
			self.setVariable('recording', true);
			self.states['recording'] = true;
			self.checkFeedbacks('recording');
		});

		self.obs.on('RecordingStopped', function() {
			self.setVariable('recording', false);
			self.states['recording'] = false;
			self.checkFeedbacks('recording');
		});

		self.obs.on('StudioModeSwitched', function(data) {
			if (data['new-state'] == true) {
				self.states['studio_mode'] = true;
			} else {
				self.states['studio_mode'] = false;
			}
		});
		
		self.obs.on('SceneItemVisibilityChanged', function(data) {
			if (self.states['studio_mode'] == true) { 
				//Item in preview, no change
			} else {
				self.updateScenesAndSources();
			}
		});

		self.obs.on('TransitionListChanged', function(data) {
			self.updateTransitionList();
		});

		self.obs.on('TransitionDurationChanged', function(data) {
			self.updateTransitionList();
		});
	});

	debug = self.debug;
	log = self.log;

};

instance.prototype.roundIfDefined = (number, decimalPlaces) => {
	if (number) {
		return Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces)
	} else {
		return number
	}
}

instance.prototype.process_stream_vars = function(data) {
	var self = this;

	for (var s in data) {
		self.states[s] = data[s];
	}

	self.setVariable('bytes_per_sec', data['bytes-per-sec']);
	self.setVariable('num_dropped_frames', data['num-dropped-frames']);
	self.setVariable('num_total_frames', data['num-total-frames']);

	if (data['kbits-per-sec']) {
		self.setVariable('kbits_per_sec', data['kbits-per-sec'].toLocaleString());
	}

	self.setVariable('average_frame_time', self.roundIfDefined(data['average-frame-time'], 2));
	self.setVariable('preview_only', data['preview-only']);
	self.setVariable('recording', data['recording']);
	self.setVariable('strain', data['strain']);
	self.setVariable('stream_timecode', data['stream-timecode']);
	self.setVariable('streaming', data['streaming']);
	self.setVariable('total_stream_time', data['total-stream-time']);

	self.process_obs_stats(data);

	self.checkFeedbacks('streaming');
};

instance.prototype.process_obs_stats = function(data) {
	var self = this;

	for (var s in data) {
		self.states[s] = data[s];
	}

	self.setVariable('fps', self.roundIfDefined(data['fps'], 2));
	self.setVariable('render_total_frames', data['render-total-frames']);
	self.setVariable('render_missed_frames', data['render-missed-frames']);
	self.setVariable('output_total_frames', data['output-total-frames']);
	self.setVariable('output_skipped_frames', data['output-skipped-frames']);
	self.setVariable('average_frame_time', self.roundIfDefined(data['average-frame-time'], 2));
	self.setVariable('cpu_usage', self.roundIfDefined(data['cpu-usage'], 2));
	self.setVariable('memory_usage', self.roundIfDefined(data['memory-usage'], 2));
	self.setVariable('free_disk_space', self.roundIfDefined(data['free-disk-space'], 2));
};


// Return config fields for web config
instance.prototype.config_fields = function() {
	var self = this;
	return [
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 8,
			regex: self.REGEX_IP
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 4,
			default: 4449,
			regex: self.REGEX_PORT
		},
		{
			type: 'textinput',
			id: 'pass',
			label: 'Password',
			width: 4,
		}
	]
};

instance.prototype.getStats = async function() {
	let {stats} = await this.obs.send('GetStats')
	this.process_obs_stats(stats);
};

instance.prototype.startStatsPoller = function() {
	this.stopStatsPoller()

	let self = this
	this.statsPoller = setInterval(() => {
		if (self.obs && !self.states['streaming']) {
			self.getStats()
		}
	}, 1000)
}

instance.prototype.stopStatsPoller = function() {
	if (this.statsPoller) {
		clearInterval(this.statsPoller)
		this.statsPoller = null
	}
}

instance.prototype.getStreamStatus = function() {
	var self = this;

	self.obs.send('GetStreamingStatus').then(data => {
		self.setVariable('recording', data['recording']);
		self.states['recording'] = data['recording'];
		self.checkFeedbacks('recording');

		self.setVariable('streaming', data['streaming']);
		self.states['streaming'] = data['streaming'];
		self.checkFeedbacks('streaming');

		self.init_feedbacks();
	});
};

instance.prototype.updateTransitionList = async function() {
	var self = this;

	let data = await self.obs.send('GetTransitionList')
	self.transitions = {};
	self.states['current_transition'] = data['current-transition'];
	for (var s in data.transitions) {
		var transition = data.transitions[s];
		self.transitions[transition.name] = transition;
	}
	self.actions();
	self.init_presets();
	self.init_feedbacks();
	self.init_variables();
}

instance.prototype.updateScenesAndSources = async function() {
	var self = this;

	await self.obs.send('GetSourcesList').then(data => {
		self.sources = {};
		for (var s in data.sources) {
			var source = data.sources[s];
			self.sources[source.name] = source;
		}
		self.actions();
		self.init_feedbacks();
		data.sources.forEach(source => {
			self.states[source.name] = false;
		});
	});

	let sceneList = await self.obs.send('GetSceneList')
	self.scenes = {};
	self.states['scene_active'] = sceneList.currentScene;
	self.setVariable('scene_active', sceneList.currentScene);
	for (let scene of sceneList.scenes) {
		self.scenes[scene.name] = scene;
	}

	let findNestedScenes = (sceneName) => {
		let nested = []
		if (self.scenes[sceneName]){
			for (let source of self.scenes[sceneName].sources) {
				if (self.scenes[source.name] && source.render) {
					nested.push(source.name)
				}
			}
		}
		return nested;
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

	self.actions();
	self.init_presets();
	self.init_feedbacks();
	self.init_variables();
	self.checkFeedbacks('scene_item_active');
	self.checkFeedbacks('scene_active');
};

instance.prototype.updateInfo = function() {
	var self = this;
	self.obs.send('GetStudioModeStatus').then(data => {
		if (data['studio-mode'] == true) {
			self.states['studio_mode'] = true;
		} else {
			self.states['studio_mode'] = false;
		}
	});
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	self.scenes = [];
	self.transitions = [];
	self.states = {};
	self.scenelist = [];
	self.sourcelist = [];
	self.feedbacks = {};
	if (self.obs !== undefined) {
		self.obs.disconnect();
	}
	if (self.tcp !== undefined) {
		self.tcp.destroy();
	}
	self.disable = true;
	self.stopStatsPoller();
};

instance.prototype.actions = function() {
	var self = this;

	self.scenelist = [];
	self.sourcelist = [];
	self.transitionlist = [];

	var s;
	if (self.sources !== undefined) {
		for (s in self.sources) {
			self.sourcelist.push({ id: s, label: s });
		}
	}

	if (self.scenes !== undefined) {
		for (s in self.scenes) {
			self.scenelist.push({ id: s, label: s });

			// Scenes can also be sources
			self.sourcelist.push({ id: s, label: s });
		}
	}

	if (self.transitions !== undefined) {
		for (s in self.transitions) {
			self.transitionlist.push({ id: s, label: s });
		}
	}

	self.setActions({
		'enable_studio_mode': {
			label: 'Enable StudioMode',
		},
		'disable_studio_mode': {
			label: 'Disable StudioMode',
		},
		'toggle_studio_mode': {
			label: 'Toggle StudioMode',
		},
		'start_recording': {
			label: 'Start Recording',
		},
		'stop_recording': {
			label: 'Stop Recording',
		},
		'pause_recording': {
			label: 'Pause Recording',
		},
		'resume_recording': {
			label: 'Resume Recording',
		},
		'start_streaming': {
			label: 'Start Streaming',
		},
		'stop_streaming': {
			label: 'Stop Streaming',
		},
		'start_replay_buffer': {
			label: 'Start Replay Buffer',
		},
		'stop_replay_buffer': {
			label: 'Stop Replay Buffer',
		},
		'save_replay_buffer': {
			label: 'Save Replay Buffer',
		},
		'set_scene': {
			label: 'Change scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: '0',
					choices: self.scenelist
				}
			]
		},
		'preview_scene': {
			label: 'Preview scene',
			options: [
				{
					type: 'dropdown',
					label: 'Scene',
					id: 'scene',
					default: '0',
					choices: self.scenelist
				}
			]
		},
		'do_transition': {
			label: 'Transition preview to program',
			options: [
				{
					type: 'dropdown',
					label: 'Transition to use',
					id: 'transition',
					default: null,
					choices: self.transitionlist,
					required: false
				},
				{
					type: 'number',
					label: 'Transition time (in ms)',
					id: 'transition_time',
					default: null,
					min: 0,
					max: 60 * 1000, //max is required by api
					range: false,
					required: false
				}
			]
		},
		'set_transition': {
			label: 'Change transition type',
			options: [
				{
					type: 'dropdown',
					label: 'Transitions',
					id: 'transitions',
					default: '0',
					choices: self.transitionlist
				}
			]
		},
		'StartStopStreaming': {
			label: 'Start and Stop Streaming'
		},
		'StartStopRecording': {
			label: 'Start and Stop Recording'
		},
		'set_source_mute' : {
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
					choices: [ { id: 'false', label: 'False' }, { id: 'true', label: 'True' } ]
				}
			]
		},
		'toggle_source_mute' : {
			label: 'Toggle Source Mute',
			options: [
				{
					type: 'textinput',
					label: 'Source',
					id: 'source',
					default: '',
				}
			]
		},
		'toggle_scene_item' : {
			label: 'Toggle visibility scene item',
			options: [
				{
					type: 'textinput',
					label: 'Scene (optional, defaults to current scene)',
					id: 'scene'
				},
				{
					type: 'textinput',
					label: 'Source',
					id: 'source',
					default: '',
				},
				{
					type: 'dropdown',
					label: 'Visible',
					id: 'visible',
					default: 'true',
					choices: [ { id: 'false', label: 'False' }, { id: 'true', label: 'True' } ]
				}
			]
		},
		'reconnect' : {
			label: 'reconnect to OBS'
		},
		'set-freetype-text': {
			label: 'Set Source Text (FreeType 2)',
			options: [
				{
					type: 'textinput',
					label: 'Source Name',
					id: 'source',
					required: true
				},
				{
					type: 'textinput',
					label: 'Text',
					id: 'text',
					required: true
				}
			]
		},
		'set-gdi-text': {
			label: 'Set Source Text (GDI+)',
			options: [
				{
					type: 'textinput',
					label: 'Source Name',
					id: 'source',
					required: true
				},
				{
					type: 'textinput',
					label: 'Text',
					id: 'text',
					required: true
				}
			]
		},
		'trigger-hotkey': {
			label: 'Trigger hotkey by ID',
			tooltip: 'Find the hotkey ID in your profile settings file',
			options: [
				{
					type: 'textinput',
					label: 'Hotkey ID',
					id: 'id',
					required: true
				}
			]
		}
	});
};

instance.prototype.action = function(action) {
	var self = this;
	var handle;

	if (action.action == 'reconnect') {
		self.log('debug','reconnecting, destroying and reiniting..');
		self.obs.disconnect();
		self.init();
		return;
	}

	if (self.obs == null || self.obs.OBSWebSocket) {
		self.log('warn', 'OBS action not possible, connection lost');
		return;
	}

	switch (action.action) {
		case 'enable_studio_mode':
			handle = self.obs.send('EnableStudioMode');
			break;
		case 'disable_studio_mode':
			handle = self.obs.send('DisableStudioMode');
			break;
		case 'toggle_studio_mode':
			handle = self.obs.send('ToggleStudioMode');
			break;
		case 'start_recording':
			handle = self.obs.send('StartRecording');
			break;
		case 'stop_recording':
			handle = self.obs.send('StopRecording');
			break;
		case 'pause_recording':
			handle = self.obs.send('PauseRecording');
			break;
		case 'resume_recording':
			handle = self.obs.send('ResumeRecording');
			break;
		case 'start_streaming':
			handle = self.obs.send('StartStreaming');
			break;
		case 'stop_streaming':
			handle = self.obs.send('StopStreaming');
			break;
		case 'start_replay_buffer':
			handle = self.obs.send('StartReplayBuffer');
			break;
		case 'stop_replay_buffer':
			handle = self.obs.send('StopReplayBuffer');
			break;
		case 'save_replay_buffer':
			handle = self.obs.send('SaveReplayBuffer');
			break;
		case 'set_scene':
			handle = self.obs.send('SetCurrentScene', {
				'scene-name': action.options.scene
			})
			break;
		case 'preview_scene':
			handle = self.obs.send('SetPreviewScene', {
				'scene-name': action.options.scene
			});
			break;
		case 'do_transition':
			var options = {};
			if (action.options && action.options.transition) {
				options['with-transition'] = {
					name: action.options.transition
				};

				if (action.options.transition_time > 0) {
					options['with-transition']['duration'] = action.options.transition_time;
				}
			}

			handle = self.obs.send('TransitionToProgram', options);
			break;
		case 'set_source_mute':
			handle = self.obs.send('SetMute', {
				'source': action.options.source,
				'mute': (action.options.mute == 'true' ? true : false)
			});
			break;
		case 'toggle_source_mute':
			handle = self.obs.send('ToggleMute', {
				'source': action.options.source
			});
			break;
		case 'set_transition':
			handle = self.obs.send('SetCurrentTransition', {
				'transition-name': action.options.transitions
			});
			break;
		case 'StartStopStreaming':
			handle = self.obs.send('StartStopStreaming');
			break;
		case 'StartStopRecording':
			handle = self.obs.send('StartStopRecording');
			break;
		case 'toggle_scene_item':
			handle = self.obs.send('SetSceneItemProperties', {
				'item': action.options.source,
				'visible': (action.options.visible == 'true' ? true : false),
				'scene-name': action.options.scene && action.options.scene != "" ? action.options.scene : null
			});
			break;
		case 'set-freetype-text':
			handle = self.obs.send('SetTextFreetype2Properties', {
				'source': action.options.source,
				'text': action.options.text
			})
			break;
		case 'set-gdi-text':
			handle = self.obs.send('SetTextGDIPlusProperties', {
				'source': action.options.source,
				'text': action.options.text
			})
			break;
		case 'trigger-hotkey':
			handle = self.obs.send('TriggerHotkeyByName', {
				'hotkeyName': action.options.id,
			})
			break;
	}

	handle.catch(error => {
		if (error.code == "NOT_CONNECTED") {
			self.log('warn', 'Send to OBS failed. Re-start OBS manually. Starting re-init');
			self.obs.disconnect();
			self.init();
		} else {
			self.log('debug', error.error);
		}
	});
};

instance.prototype.init_feedbacks = function() {
	var self = this;
	// feedbacks
	var feedbacks = {};
	feedbacks['streaming'] = {
		label: 'Stream is running',
		description: 'If the stream is running, change colors of the bank',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(100, 255, 0)
			},
		]
	};

	feedbacks['recording'] = {
		label: 'Recording is active',
		description: 'If the recording is active, change colors of the bank',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(100, 255, 0)
			},
		]
	};


	feedbacks['scene_active'] = {
		label: 'Change colors from active/previewed scene',
		description: 'If the scene specified is active or previewed in OBS, change colors of the bank',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color (program)',
				id: 'fg',
				default: self.rgb(255, 255, 255)
			},
			{
				type: 'colorpicker',
				label: 'Background color (program)',
				id: 'bg',
				default: self.rgb(255, 0, 0)
			},
			{
				type: 'colorpicker',
				label: 'Foreground color (preview)',
				id: 'fg_preview',
				default: self.rgb(255, 255, 255)
			},
			{
				type: 'colorpicker',
				label: 'Background color (preview)',
				id: 'bg_preview',
				default: self.rgb(0, 200, 0)
			},
			{
				type: 'dropdown',
				label: 'Scene',
				id: 'scene',
				default: '',
				choices: self.scenelist
			}
		]
	};

	feedbacks['scene_item_active'] = {
		label: 'Change colors when source visible',
		description: 'If a source become visible or invisible in current scene, change color',
		options: [
			{
				type: 'colorpicker',
				label: 'Foreground color',
				id: 'fg',
				default: self.rgb(255, 255, 255)
			},
			{
				type: 'colorpicker',
				label: 'Background color',
				id: 'bg',
				default: self.rgb(255, 0, 0)
			},
			{
				type: 'dropdown',
				label: 'Source name',
				id: 'source',
				default: '',
				choices: self.sourcelist
			}
		]
	};

	self.setFeedbackDefinitions(feedbacks);
};

instance.prototype.feedback = function(feedback) {
	var self = this;

	if (self.states === undefined) {
		return;
	}

	if (feedback.type === 'scene_active') {
		if (self.states['scene_active'] === feedback.options.scene) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg };
		} else if (self.states['scene_preview'] === feedback.options.scene && typeof feedback.options.fg_preview === 'number') {
			//FIXME fg_preview/bg_preview is undefined when updating from an older version of the module
			return { color: feedback.options.fg_preview, bgcolor: feedback.options.bg_preview };
		}
	}

	if (feedback.type === 'streaming') {
		if (self.states['streaming'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg };
		}
	}

	if (feedback.type === 'recording') {
		if (self.states['recording'] === true) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg };
		}
	}
	if (feedback.type === 'scene_item_active')  {
		if ((self.states[feedback.options.source] === true)) {
			return { color: feedback.options.fg, bgcolor: feedback.options.bg };
		}
	}

	return {};
};

instance.prototype.init_presets = function() {
	var self = this;
	var presets = [];

	for (var s in self.scenes) {
		var scene = self.scenes[s];

		let baseObj = {
			category: 'Scene to program',
			label: scene.name,
			bank: {
				style: 'text',
				text: scene.name,
				size: 'auto',
				color: self.rgb(255, 255, 255),
				bgcolor: 0
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
					}
				}
			],
			actions: [
				{
					action: 'set_scene',
					options: {
						scene: scene.name
					}
				}
			]
		};

		presets.push(baseObj);

		let toPreview = {};
		presets.push(Object.assign(toPreview, baseObj, {
			category: 'Scene to preview',
			actions: [
				{
					action: 'preview_scene',
					options: {
						scene: scene.name
					}
				}
			]
		}));
	}

	presets.push({
		category: 'Transitions',
		label: 'Send previewed scene to program',
		bank: {
			style: 'text',
			text: 'AUTO',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0
		},
		actions: [
			{
				action: 'do_transition'
			}
		]
	});

	// Preset for Start Streaming button with colors indicating streaming status
	presets.push({
		category: 'Streaming',
		label: 'OBS Streaming',
		bank: {
			style: 'text',
			text: 'OBS STREAM',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0
		},
		feedbacks: [
			{
				type: 'streaming',
				options: {
					bg: self.rgb(51, 204, 51),
					fg: self.rgb(255, 255, 255),
				}
			}
		],
		actions: [
			{
				action: 'StartStopStreaming',
			}
		]
	});

	// Preset for Start Recording button with colors indicating recording status
	presets.push({
		category: 'Recording',
		label: 'OBS Recording',
		bank: {
			style: 'text',
			text: 'OBS RECORD',
			size: 'auto',
			color: self.rgb(255, 255, 255),
			bgcolor: 0
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(51, 204, 51),
					fg: self.rgb(255, 255, 255),
				}
			}
		],
		actions: [
			{
				action: 'StartStopRecording',
			}
		]
	});

	self.setPresetDefinitions(presets);
};

instance.prototype.init_variables = function() {
	var self = this;

	var variables = [];

	variables.push({ name: 'bytes_per_sec', label: 'Amount of data per second (in bytes) transmitted by the stream encoder' });
	variables.push({ name: 'fps', label: 'Current framerate' });
	variables.push({ name: 'cpu_usage', label: 'Current CPU usage (percentage)' });
	variables.push({ name: 'memory_usage', label: 'Current RAM usage (in megabytes)' });
	variables.push({ name: 'free_disk_space', label: 'Free recording disk space (in megabytes)' });
	variables.push({ name: 'kbits_per_sec', label: 'Amount of data per second (in kilobits) transmitted by the stream encoder' });
	variables.push({ name: 'render_missed_frames', label: 'Number of frames missed due to rendering lag' });
	variables.push({ name: 'render_total_frames', label: 'Number of frames rendered' });
	variables.push({ name: 'output_skipped_frames', label: 'Number of encoder frames skipped' });
	variables.push({ name: 'output_total_frames', label: 'Number of total encoder frames' });
	variables.push({ name: 'num_dropped_frames', label: 'Number of frames dropped by the encoder since the stream started' });
	variables.push({ name: 'num_total_frames', label: 'Total number of frames transmitted since the stream started' });
	variables.push({ name: 'average_frame_time', label: 'Average frame time (in milliseconds)' });
	variables.push({ name: 'preview_only', label: 'Preview only' });
	variables.push({ name: 'recording', label: 'Recording State' });
	variables.push({ name: 'strain', label: 'Strain' });
	variables.push({ name: 'stream_timecode', label: 'Stream Timecode' });
	variables.push({ name: 'streaming', label: 'Streaming State' });
	variables.push({ name: 'total_stream_time', label: 'Total streaming time' });
	variables.push({ name: 'scene_active', label: 'Current active scene' });
	variables.push({ name: 'scene_preview', label: 'Current preview scene' });

	self.setVariableDefinitions(variables);
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
