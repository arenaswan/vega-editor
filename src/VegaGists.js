var HOST = 'http://vega.github.io/vega-editor/',
    SPEC_FILE = 'spec.json',
    DEPS = [
      'topojson', 'd3.min', 'd3.geo.projection.min', 'd3.layout.cloud',
      'vega', 'vega-embed'
    ],
    GistAPI = require('./GistAPI');

function VegaGists(auth) {
  this._api = new GistAPI(auth);
  this._id = null;
}

var proto = VegaGists.prototype;

function onSave(error, resp) {
  if (error || !resp) {
    console.error(error);
    alert('Failed to save gist.');
  } else if (this._id && resp.id !== this._id) {
    alert('Inconsistent ids. Expected ' + this._id + ', received ' + resp.id + '.');
  } else {
    this._id = resp.id;
    alert('Successfuly saved gist: ' + resp.id + '.');
    console.log('SAVED GIST', resp.url, 'http://bl.ocks.org/' + resp.id);
  }
}

function onDelete(error, id) {
  if (error || !id) {
    console.error(error);
    alert('Failed to delete gist: ' + id + '.');
  } else {
    this._id = null;
    alert('Successfully deleted gist: ' + id + '.');
  }
}

proto.create = function(ved, name) {
  var self = this,
      done = onSave.bind(self);

  self._id = null; // creating new gist, clear any prior id
  marshal(ved, name, function(error, data) {
    self._api.post(data, done);
  });
};

proto.save = function(ved) {
  var self = this,
      done = onSave.bind(self),
      id = this._id;

  if (!id) throw Error('No current gist exists.');
  marshal(ved, function(error, data) {
    self._api.patch(id, data, done);
  });
};

proto.open = function(ved, id) {
  var self = this;
  self._api.get(id, function(error, gist) {
    if (error) throw Error(error);
    var spec_file = gist.files[SPEC_FILE];
    if (!spec_file) throw Error('No specification file found.');

    if (spec_file.truncated) {
      // request file directly
      d3.text(spec_file.raw_url, function(error, data) {
        if (error) throw Error(error);
        open(ved, data, gist);
        self._id = id;
      });
    } else {
      // use file contents
      open(ved, spec_file.content, gist);
      self._id = id;
    }
  });
};

proto.delete = function() {
  var self = this, id = this._id;
  if (!id) throw Error('No current gist exists.');
  return this._api.delete(id, function(err, resp) {
    onDelete.call(self, err, id);
  });
};

function open(ved, spec_text, gist) {
  // TODO handle data sets? (Set Vega base URL to gist 'url'?)
  ved.open(spec_text);
}

function marshal(ved, name, callback) {
  var data = {
    'description': name,
    'public': false, // TODO toggle
    'files': {
      'README.md': {'content': name},
      'index.html': {'content': index_html()}
    }
  };

  var text = ved.editor.getValue();
  data.files[SPEC_FILE] = {'content': text};

  // TODO collect data, etc files...
  callback(null, data);
}

function index_html(embed_spec) {
  return '<!DOCTYPE HTML>\n<meta charset="utf-8">\n' +
  '<link type="text/css" href="' + HOST + 'editor.css">\n' +
  DEPS.map(function(file) {
    return '<script src="' + HOST + 'vendor/' + file + '.js"></script>';
  }).join('\n') + '\n' +
  '<div id="view"></div>\n' +
  '<script>\n' +
  '  vg.embed("#view", "spec.json", function(view, spec) {\n' +
  '    window.vega = {view: view, spec: spec};\n' +
  '  });\n' +
  '</script>';
}

module.exports = VegaGists;
