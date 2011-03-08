/* */
(function() {
  /* backbone success and error methods */
  var backboneSuccess = function(onSuccess, model, options) {
    return function(response) {
      if(!model.set(model.parse(response), options)){ return false; }
      if(onSuccess){ onSuccess(model, response); }
    };
  };
  var backboneError = function(onError, model, options) {
    return function(response) {
      if(onError) {
        onError(model, resp);
      } else {
        model.trigger('error', model, response, options);
      }
    };
  };
  var checkName = function(model) {
    if(!model.rails_name){ throw("A 'rails_name' property must be specified."); }
    return model;
  };
  var wrapAttributes = function(model, attrs) {
    checkName(model);
    var data = {}
    data[model.rails_name] = attrs;
    return data;
  };
  var unwrapAttributes = function(model, attrs) {
    checkName(model);
    return attrs[model.rails_name];
  };

  Backbone.Rails = {};

  Backbone.Rails.Model = Backbone.Model.extend({
    _rails_model: true,
    associations: {},

    parse: function(response) {
      return unwrapAttributes(this, response);
    },
    toJSON: function() {
      return wrapAttributes(this, _.clone(this.attributes));
    },
    /* backbone's default toJSON method */
    toBackboneJSON: function() {
      return _.clone(this.attributes);
    },
    save: function(attrs, options) {
      options || (options = {});
      if(!this.isNew()) {
        var updated = _.extend(_.clone(this.attributes), attrs);
        var changed = this.changedAttributes(updated);
      }
      /* This is code from backbone's default save method */
      if (attrs && !this.set(attrs, options)) return false;
      var model = this;
      var success = backboneSuccess(options.success, model, options);
      var error = backboneError(options.error, model, options);
      var method = this.isNew() ? 'create' : 'update';
      if(changed){ this.attributes = changed; }
      (this.sync || Backbone.sync)(method, this, success, error);
      if(changed){ this.attributes = updated; }
      return this;
    },

    isRails: function() {
      return this._rails_model;
    }
  });

  Backbone.Rails.Collection = Backbone.Collection.extend({
    _rails_model: true,

    parse: function(response) {
      var attrs = _.map(response, function(data){ return unwrapAttributes(this, data); }, this);
      return attrs;
    },

    isRails: function() {
      return this._rails_model;
    }
  });

  var afterLoad = function(model, association, name) {
    var options = model.associations[name];
    options.loaded = true;
    model.associations[name] = options;
    model.trigger("loaded:" + name, model, association);
    var allLoaded = _.inject(_.values(model.associations), function(sum, data) {
      return (sum && !!data.loaded);
    }, true);
    if(allLoaded){ model.trigger("loaded:associations", model) };
    return model;
  };

  Backbone.Rails.Association = {
    loadAssociations: function() {
      var names = _.isEmpty(arguments) ? _.keys(this.associations) : arguments;
      _.each(names, function(name) {
        var options = this.associations[name];
        if(!options['class']){ throw("Associations require a 'class' option"); }
        options['key'] || (options['key'] = name + "_id");
        var onChange = _.bind(this.refreshAssociation, this, name);
        this.bind("change:" + name, onChange);
        if(options['auto_load']){ this.bind("change:" + options['key'], onChange); }
        this.refreshAssociation(name);
      }, this);
    },
    refreshAssociation: function(name) {
      var options = this.associations[name];
      var id = this.attributes[options['key']];
      if(this.attributes[name]) {
        attrs = _.clone(this.attributes[name]);
        this[name] = new options['class'](attrs);
        this.unset(name, { silent: true });
        afterLoad(this, this[name], name);
      } else if(id && options['auto_load']) {
        var model = this;
        this[name] = new options['class']({ 'id': id });
        this[name].fetch({
          success: function(){ afterLoad(model, model[name], name); }
        });
      } else {
        this[name] = undefined;
        afterLoad(this, this[name], name);
      }
    },
    associationLoaded: function(name, onLoad) {
      var options = this.associations[name];
      if(options.loaded) {
        if(onLoad){ onLoad() }
        return true;
      } else if(onLoad) {
        this.bind("loaded:" + name, onLoad);
      }
      return false;
    }
  };

  _.extend(Backbone.Rails.Model.prototype, Backbone.Rails.Association);

})();
