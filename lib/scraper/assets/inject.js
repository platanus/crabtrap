if(!window.sg_window) {

	var gadget = window.sg_window = new SelectorGadget();

	function sendLog(_data, _success) {
		jQuerySG.post('https://www.crabtrap.io/api/logs', JSON.stringify(_data), _success);
	}

	gadget.setPath = function(prediction) {
		if(prediction && prediction.length > 0) {
			this.path_output_field.value = prediction;
			this.last_prediction = prediction;
		} else {
			this.path_output_field.value = 'No valid path found.';
			this.last_prediction = null;
		}
	};

	gadget.makeStandardInterface = function() {
		self = this;
		path = jQuerySG('<input>').attr('id', 'selectorgadget_path_field').addClass('selectorgadget_ignore').addClass('selectorgadget_input_field').keydown(function(e) {
			if(e.keyCode == 13) self.refreshFromPath(e);
		}).focus(function() {
			jQuerySG(this).select();
		});

		this.sg_div.append(path);
		this.clear_button = jQuerySG('<input type="button" value="Clear"/>')
			.bind("click", {'self': this}, this.clearEverything)
			.addClass('selectorgadget_ignore')
			.addClass('selectorgadget_input_field');

		this.sg_div.append(this.clear_button);
		this.sg_div.append(jQuerySG('<input type="button" value="Toggle Position"/>').click(function() {
			if(self.sg_div.hasClass('selectorgadget_top')) {
				self.sg_div.removeClass('selectorgadget_top').addClass('selectorgadget_bottom');
			} else {
				self.sg_div.removeClass('selectorgadget_bottom').addClass('selectorgadget_top');
			}
		}).addClass('selectorgadget_ignore').addClass('selectorgadget_input_field'));

		this.sg_div
			.append(jQuerySG('<input type="button" value="Focus"/>')
			.bind("click", { 'self': this }, function() {
				sendLog({ css: self.last_prediction, action: 'focus' }, function() {
					self.unbound = true;
					jQuerySG('.selectorgadget_selected')[0].focus();
					self.unbound = false;
				});
			})
			.addClass('selectorgadget_ignore')
			.addClass('selectorgadget_input_field'));

		this.sg_div
			.append(jQuerySG('<input type="button" value="Click"/>')
			.bind("click", { 'self': this }, function() {
				sendLog({ css: self.last_prediction, action: 'click' }, function() {
					self.unbound = true;
					jQuerySG('.selectorgadget_selected')[0].click();
					self.unbound = false;
				});
			})
			.addClass('selectorgadget_ignore')
			.addClass('selectorgadget_input_field'));

		this.sg_div
			.append(jQuerySG('<input type="button" value="?"/>')
			.bind("click", {'self': this}, this.showHelp)
			.addClass('selectorgadget_ignore')
			.addClass('selectorgadget_input_field'));


		this.sg_div
			.append(jQuerySG('<input type="button" value="X"/>')
			.bind("click", {'self': this}, this.unbindAndRemoveInterface)
			.addClass('selectorgadget_ignore')
			.addClass('selectorgadget_input_field'));

		this.path_output_field = path.get(0);
	};

	jQuerySG(function() {
		gadget.makeInterface();
		gadget.clearEverything();
		gadget.setMode('interactive');
	});
}