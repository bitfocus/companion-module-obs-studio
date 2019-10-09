var instance_skel = require('../../instance_skel');
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
	debug('updateConfig() destroying and reiniting..');
	self.destroy();
	self.init();
};

instance.prototype.init = function() {
	var self = this;

	self.status(self.STATUS_ERROR, "Connecting");
	if (self.obs !== undefined) {
		self.obs.disconnect();
		self.obs = undefined;
	}
	self.obs = new OBSWebSocket();
	self.states = {};
	self.scenes = {};
	self.transitions = {};

	self.obs.connect({
		address: (self.config.host !== '' ? self.config.host : '127.0.0.1') + ':' + (self.config.port !== '' ? self.config.port : '4444'),
		password: self.config.pass
	}).then(() => {
		self.status(self.STATUS_OK);
		debug('Success! Connected.');
		self.getStreamStatus();
		self.updateScenes();
	}).catch(err => {
		self.status(self.STATUS_ERROR, err);
	});

	self.obs.on('error', err => {
		debug('Error received: ' + err);
		self.stats(self.STATUS_ERROR, err);
	});

	self.obs.on('SwitchScenes', function(data) {
		self.states['scene_active'] = data['scene-name'];
		self.setVariable('scene_active', data['scene-name']);
		self.checkFeedbacks('scene_active');
	});

	self.obs.on('PreviewSceneChanged', function(data) {
		self.states['scene_preview'] = data['scene-name'];
		self.setVariable('scene_preview', data['scene-name']);
		self.checkFeedbacks('scene_active');
	});

	self.obs.on('ScenesChanged', function() {
		self.updateScenes();
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

	debug = self.debug;
	log = self.log;

};

instance.prototype.process_stream_vars = function(data) {
	var self = this;

	for (var s in data) {
		self.states[s] = data[s];
	}

	self.setVariable('bytes_per_sec', data['bytes-per-sec']);
	self.setVariable('fps', data['fps']);
	self.setVariable('kbits_per_sec', data['kbits-per-sec']);
	self.setVariable('num_dropped_frames', data['num-dropped-frames']);
	self.setVariable('num_total_frames', data['num-total-frames']);
	self.setVariable('preview_only', data['preview-only']);
	self.setVariable('recording', data['recording']);
	self.setVariable('strain', data['strain']);
	self.setVariable('stream_timecode', data['stream-timecode']);
	self.setVariable('streaming', data['streaming']);
	self.setVariable('total_stream_time', data['total-stream-time']);

	self.checkFeedbacks('streaming');

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
			default: 4444,
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

instance.prototype.getStreamStatus = function() {
	var self = this;

	self.obs.send('GetStreamingStatus').then(data => {
		self.setVariable('recording', data['recording']);
		self.states['recording'] = data['recording'];
		self.checkFeedbacks('recording');

		self.setVariable('streaming', data['streaming']);
		self.states['streaming'] = data['streaming'];
		self.checkFeedbacks('streaming');

		self.actions();
		self.init_presets();
		self.init_feedbacks();
		self.init_variables();
	});
};

instance.prototype.updateScenes = function() {
	var self = this;

	self.obs.send('GetTransitionList').then(data => {
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
	});

	self.obs.send('GetSceneList').then(data => {
		self.scenes = {};
		self.states['scene_active'] = data['current-scene'];
		for (var s in data.scenes) {
			var scene = data.scenes[s];
			self.scenes[scene.name] = scene;
		}
		self.actions();
		self.init_presets();
		self.init_feedbacks();
		self.init_variables();
	});
};

// When module gets deleted
instance.prototype.destroy = function() {
	var self = this;
	self.scenes = [];
	self.transitions = [];
	self.states = {};
	self.scenelist = [];
	self.obs.disconnect();
	debug('destroy');
};

instance.prototype.actions = function() {
	var self = this;

	self.scenelist = [];
	self.transitionlist = [];

	var s;
	if (self.scenes !== undefined) {
		for (s in self.scenes) {
			self.scenelist.push({ id: s, label: s });
		}
	}

	if (self.transitions !== undefined) {
		for (s in self.transitions) {
			self.transitionlist.push({ id: s, label: s });
		}
	}

	self.setActions({
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
		'reconnect' : {
			label: 'reconnect to OBS'
		}
	});
};

instance.prototype.action = function(action) {
	var self = this;

	switch (action.action) {
		case 'set_scene':
			self.obs.send('SetCurrentScene', {
				'scene-name': action.options.scene
			});
			break;
		case 'preview_scene':
			self.obs.send('SetPreviewScene', {
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

			self.obs.send('TransitionToProgram', options);
			break;
		case 'set_source_mute':
			self.obs.send('SetMute', {
				'source': action.options.source,
				'mute': (action.options.mute == 'true' ? true : false)
			});
			break;
		case 'set_transition':
			self.obs.send('SetCurrentTransition', {
				'transition-name': action.options.transitions
			});
			break;
		case 'StartStopStreaming':
			self.obs.send('StartStopStreaming');
			break;
		case 'StartStopRecording':
			self.obs.send('StartStopRecording');
			break;
		case 're-connect':
			var self = this;
			self.config = config;
			debug('reconnecting, destroying and reiniting..');
			self.destroy();
			self.init();
			break;
	}
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

	self.setFeedbackDefinitions(feedbacks);
};

instance.prototype.feedback = function(feedback) {
	var self = this;

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

	variables.push({ name: 'bytes_per_sec', label: 'Stream is active' });
	variables.push({ name: 'fps', label: 'Frames per second' });
	variables.push({ name: 'kbits_per_sec', label: 'Kilobits per second' });
	variables.push({ name: 'num_dropped_frames', label: 'Number of dropped frames' });
	variables.push({ name: 'num_total_frames', label: 'Number of total frames' });
	variables.push({ name: 'preview_only', label: 'Preview only' });
	variables.push({ name: 'recording', label: 'Recording State' });
	variables.push({ name: 'strain', label: 'Strain' });
	variables.push({ name: 'stream_timecode', label: 'Stream Timecode' });
	variables.push({ name: 'streaming', label: 'Streaming State' });
	variables.push({ name: 'total_stream_time', label: 'Total streaming time' });

	self.setVariableDefinitions(variables);
};

instance_skel.extendedBy(instance);
exports = module.exports = instance;
