module.exports = {
	v2_0_0: function (context, config, actions, feedbacks) {
		let changed = false

		if (config.port == undefined || config.port == '' || config.port == 4444) {
			config.port = 4455
			changed = true
		}

		actions.forEach((action) => {
			if (action.action === 'set-freetype-text' || action.action === 'set-gdi-text') {
				action.action = 'setText'
				changed = true
			}
			if (action.action === 'take_screenshot') {
				action.options.source == 'programScene'
				action.options.custom == ''
				changed = true
			}
		})

		return changed
	},
}
