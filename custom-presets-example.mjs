// companion module obs studio custom presets example file
// 16.02.2022

export const customPresets = (self, presets) => {
	const DEBUG_LEVEL = 1
	if (DEBUG_LEVEL > 1) self.log('debug', 'START customPresets()');

	let category = 'My OBS Buttons';

	// Streaming button
	presets.push({
		category: category,
		label: 'OBS Streaming',
		bank: {
			style: 'text',
			text: 'STREAM\\n$(obs:streaming)\\n$(obs:stream_timecode)',
			size: '14',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'streaming',
				style: {
					bgcolor: self.rgb(255, 0, 0),
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

	// Recording button
	presets.push({
		category: category,
		label: 'OBS Recording',
		bank: {
			style: 'text',
			text: 'REC:\\n$(obs:recording)\\n$(obs:recording_timecode)',
			size: '14',
			color: self.rgb(255, 255, 255),
			bgcolor: 0,
		},
		feedbacks: [
			{
				type: 'recording',
				options: {
					bg: self.rgb(255, 0, 0),
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

	// cut button
	presets.push({
		category: category,
		label: 'Cut',
		bank: {
			style: 'text',
			text: 'Cut',
			size: '18',
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(51, 102, 153),
		},
		actions: [
			{
				action: 'do_transition',
				options: {
					transition: 'Cut',
					transition_time: 0,
				},
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					color: self.rgb(255, 255, 0),
					bgcolor: self.rgb(51, 102, 153),
				},
			},
		],
	})
	
	// fade 1s button
	presets.push({
		category: category,
		label: 'Fade 1s',
		bank: {
			style: 'text',
			text: 'Fade\\n1s',
			size: '18',
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(51, 102, 153),
		},
		actions: [
			{
				action: 'do_transition',
				options: {
					transition: 'Fade',
					transition_time: 1000,
				},
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					color: self.rgb(255, 255, 0),
					bgcolor: self.rgb(51, 102, 153),
				},
			},
		],
	})
	
	// fade 3s button
	presets.push({
		category: category,
		label: 'Fade 3s',
		bank: {
			style: 'text',
			text: 'Fade\\n3s',
			size: '18',
			alignment: 'center:center',
			pngalignment: 'center:center',
			color: self.rgb(255, 255, 255),
			bgcolor: self.rgb(51, 102, 153),
		},
		actions: [
			{
				action: 'do_transition',
				options: {
					transition: 'Fade',
					transition_time: 3000,
				},
			},
		],
		feedbacks: [
			{
				type: 'transition_active',
				style: {
					color: self.rgb(255, 255, 0),
					bgcolor: self.rgb(51, 102, 153),
				},
			},
		],
	})
	
	// stinger button's
	let stingerNumbers = ['1', '2'];
	stingerNumbers.forEach(function (stingerNumber) {
		presets.push({
			category: category,
			label: 'Stinger ' + stingerNumber,
			bank: {
				style: 'text',
				text: 'Stinger\\n' + stingerNumber,
				size: '18',
				alignment: 'center:center',
				pngalignment: 'center:center',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(51, 102, 153),
			},
			actions: [
				{
					action: 'do_transition',
					options: {
						transition: 'Stinger ' + stingerNumber,
						transition_time: 0,
					},
				},
			],
			feedbacks: [
				{
					type: 'transition_active',
					style: {
						color: self.rgb(255, 255, 0),
						bgcolor: self.rgb(51, 102, 153),
					},
				},
			],
		})
	});

	// lower third presets (for all sources of the scene "Lower Thirds")
	let lowerThirdsSceneId = 'Lower Thirds'
	if (self.scenes && self.scenes[lowerThirdsSceneId] ) {

		// lower thirds all off button preset
		let myLowerThirdAllOffPreset = {
			category: 'My Lower Thirds',
			label: 'LT All Off',
			bank: {
				style: 'text',
				text: 'LT\\nAll OFF',
				size: '14',
				alignment: 'center:center',
				pngalignment: 'center:center',
				color: self.rgb(255, 255, 255),
				bgcolor: self.rgb(45, 50, 57),
			},
			actions: [
				{
					action: 'toggle_scene_item',
					options: {
						scene: lowerThirdsSceneId,
						source: '__all_sources__',
						visible: 'false', // true, false, toggle
					},
				},
			],
			feedbacks: [
				{
					type: 'scene_item_active_in_scene',
					style: {
						color: self.rgb(255, 255, 255),
						bgcolor: self.rgb(255, 0, 0),
					},
					options: {
						scene: lowerThirdsSceneId,
						source: '__all_sources__',
					},
				},
			],
		}

		presets.push(myLowerThirdAllOffPreset)

		// lower third source button presets
		for (let source of self.scenes[lowerThirdsSceneId].sources) {

			let buttonLabel = source.name;
			
			// does this source has remaining time (ffmpeg_source)
			if (source.type === 'ffmpeg_source') {
				buttonLabel = '$(' + self.label + ':src_remaining_time_' + source.name + ')\\n' + buttonLabel
			}

			let myLowerThirdPreset = {
				category: 'My Lower Thirds',
				label: source.name,
				bank: {
					style: 'text',
					text: buttonLabel,
					size: '7',
					alignment: 'center:center', // 'center:top',
					pngalignment: 'center:center',
					color: self.rgb(255, 255, 255),
					bgcolor: self.rgb(90, 100, 115),
				},
				actions: [
					{
						action: 'toggle_scene_item',
						options: {
							scene: lowerThirdsSceneId,
							source: source.name,
							visible: 'toggle', // true, false, toggle
						},
					},
				],
				feedbacks: [
					{
						type: 'scene_item_active_in_scene',
						style: {
							color: self.rgb(255, 255, 255),
							bgcolor: self.rgb(255, 0, 0),
						},
						options: {
							scene: lowerThirdsSceneId,
							source: source.name,
						},
					},
				],
			}
			presets.push(myLowerThirdPreset)
		}
	}

	// scene to program presets
	for (var s in self.scenelist) {
		var scene = self.scenelist[s]
		if (self.scenes && self.scenes[scene.id]) {

			// does this scene have a source which has remaining time (ffmpeg_source)
			let remainingTimeSourceName;
			for (let source of self.scenes[scene.id].sources) {
				if (source.type === 'ffmpeg_source') {
					remainingTimeSourceName = source.name;
					break;
				}
			}

			let size = '7';
			let buttonLabel = scene.label;

			// some exceptions for the ATEM scenes			
			if (scene.label === 'LIVE (ATEM) gray') {
				buttonLabel = 'LIVE (gray)';
				size = '14';
			} else if (scene.label === 'LIVE (ATEM)') {
				buttonLabel = 'LIVE';
				size = '14';				
			}

			// button label program (remaining time only if there is a source which has remaining time)
			let buttonLabelProgram = buttonLabel;
			if (remainingTimeSourceName) {
				buttonLabelProgram = '$(' + self.label + ':src_remaining_time_' + remainingTimeSourceName + ')\\n' + buttonLabel
			}

			let myToPrg = {
				category: 'My Scenes',
				label: scene.label,
				bank: {
					style: 'text',
					text: buttonLabelProgram,
					size: size,
					alignment: 'center:center',
					pngalignment: 'center:center',
					color: self.rgb(255, 0, 0),
					bgcolor: 0,
				},
				actions: [
					{
						action: 'set_transition',
						options: {
							transitions: 'Cut',
						},
					},
					{
						action: 'set_scene',
						options: {
							scene: scene.id,
						},
					},
				],
				feedbacks: [
					{
						type: 'scene_active',
						options: {
							mode: 'program',
							bg: self.rgb(255, 0, 0),
							fg: self.rgb(255, 255, 255),
							bg_preview: self.rgb(0, 0, 0),
							fg_preview: self.rgb(255, 0, 0),
							scene: scene.id,
						},
					},
				],
			}

			if (remainingTimeSourceName) {
				myToPrg.feedbacks.push(
					{
						type: 'media_source_remaining_time',
						style: {
							color: self.rgb(0, 0, 0),
							bgcolor: self.rgb(255, 0, 0),
						},
						options: {
							source: remainingTimeSourceName,
							rtThreshold: '20',
						},
					}
				)
			}
			presets.push(myToPrg)

			// scene to preview presets
			let myToPre = {
				category: 'My Scenes',
				label: scene.label,
				bank: {
					style: 'text',
					text: buttonLabel,
					size: size,
					alignment: 'center:center',
					pngalignment: 'center:center',
					color: self.rgb(0, 153, 0), // green
					bgcolor: 0, // black
				},
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
							mode: 'preview',
							bg: self.rgb(0, 0, 0),
							fg: self.rgb(0, 153, 0),
							bg_preview: self.rgb(0, 200, 0),
							fg_preview: self.rgb(255, 255, 255),
							scene: scene.id,
						},
					},
				],
			}
			presets.push(myToPre)
		}
	}
	if (DEBUG_LEVEL > 0) self.log('debug', 'Number of custom presets loaded: ' + presets.length);
	if (DEBUG_LEVEL > 1) self.log('debug', 'END customPresets()');
}