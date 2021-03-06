var ved = {
  version: '1.0.1',
  data: undefined,
  renderType: 'canvas',
  editor: null
};

ved.params = function() {
  var query = location.search.slice(1);
  if (query.slice(-1) === '/') query = query.slice(0,-1);
  return query
    .split('&')
    .map(function(x) { return x.split('='); })
    .reduce(function(a, b) {
      a[b[0]] = b[1]; return a;
    }, {});
};

ved.select = function(spec) {
  var desc = ved.$d3.select('.spec_desc');

  if (spec) {
    ved.editor.setValue(spec);
    ved.editor.gotoLine(0);
    desc.html('');
    ved.parse();
    return;
  }
  
  var sel = ved.$d3.select('.sel_spec').node(),
      idx = sel.selectedIndex;
  spec = d3.select(sel.options[idx]).datum();

  if (idx > 0) {
    d3.xhr(ved.uri(spec), function(error, response) {
      ved.editor.setValue(response.responseText);
      ved.editor.gotoLine(0);
      ved.parse(function() { desc.html(spec.desc || ''); });
    });
  } else {
    ved.editor.setValue('');
    ved.editor.gotoLine(0);
    desc.html('');
  }
};

ved.uri = function(entry) {
  return ved.path + 'spec/' + entry.name + '.json';
};

ved.renderer = function() {
  var sel = ved.$d3.select('.sel_render').node(),
      idx = sel.selectedIndex,
      ren = sel.options[idx].value;

  ved.renderType = ren;
  ved.parse();
};

ved.format = function() {
  var spec = JSON.parse(ved.editor.getValue()),
      text = JSON.stringify(spec, null, 2);
  ved.editor.setValue(text);
};

ved.parse = function(callback) {
  var opt, source;
  try {
    opt = JSON.parse(ved.editor.getValue());
  } catch (e) {
    console.log(e);
    return;
  }

  if (!opt.spec && !opt.url && !opt.source) {
    // wrap spec for handoff to vega-embed
    opt = {spec: opt};
  }
  opt.actions = false;
  opt.renderer = opt.renderer || ved.renderType;
  opt.parameter_el = '.mod_params';

  if (ved.view) ved.view.destroy();
  d3.select('.mod_params').html('');
  d3.select('.spec_desc').html('');
  vg.embed('.vis', opt, function(view, spec) {
    ved.spec = spec;
    ved.view = view;
    if (callback) callback(view);
  });
};

ved.resize = function(event) {
  ved.editor.resize();
};

ved.init = function(el, dir) {
  // Set base directory
  var PATH = dir || 'app/';
  vg.config.load.baseURL = PATH;
  ved.path = PATH;

  el = (ved.$d3 = d3.select(el));

  d3.text(PATH + 'template.html', function(err, text) {
    el.html(text);

    // Specification drop-down menu               
    var sel = el.select('.sel_spec');
    sel.on('change', ved.select);
    sel.append('option').text('Custom');
    sel.selectAll('optgroup')
      .data(Object.keys(SPECS))
     .enter().append('optgroup')
      .attr('label', function(key) { return key; })
     .selectAll('option.spec')
      .data(function(key) { return SPECS[key]; })
     .enter().append('option')
      .text(function(d) { return d.name; });

    // Renderer drop-down menu
    var ren = el.select('.sel_render');
    ren.on('change', ved.renderer)
    ren.selectAll('option')
      .data(['Canvas', 'SVG'])
     .enter().append('option')
      .attr('value', function(d) { return d.toLowerCase(); })
      .text(function(d) { return d; });

    // Code Editor
    var editor = ved.editor = ace.edit(ved.$d3.select('.spec').node());
    editor.getSession().setMode('ace/mode/json');
    editor.getSession().setTabSize(2);
    editor.getSession().setUseSoftTabs(true);
    editor.setShowPrintMargin(false);
    editor.on('focus', function() {
      editor.setHighlightActiveLine(true);
      d3.selectAll('.ace_gutter-active-line').style('background', '#DCDCDC');
      d3.selectAll('.ace-tm .ace_cursor').style('visibility', 'visible');
    });
    editor.on('blur', function() {
      editor.setHighlightActiveLine(false);
      d3.selectAll('.ace_gutter-active-line').style('background', 'transparent');
      d3.selectAll('.ace-tm .ace_cursor').style('visibility', 'hidden');
      editor.clearSelection();
    });
    editor.$blockScrolling = Infinity;

    // Initialize application
    el.select('.btn_spec_format').on('click', ved.format);
    el.select('.btn_spec_parse').on('click', ved.parse);
    d3.select(window).on('resize', ved.resize);
    ved.resize();

    ved.specs = Object.keys(SPECS).reduce(function(a, k) {
      return a.concat(SPECS[k].map(function(d) { return d.name; }));
    }, []);

    // Handle application parameters
    var p = ved.params();
    if (p.renderer) {
      ren.node().selectedIndex = p.renderer.toLowerCase() === 'svg' ? 1 : 0;
      ved.renderType = p.renderer;
    }
    if (p.spec) {
      var spec = decodeURIComponent(p.spec),
          idx = ved.specs.indexOf(spec) + 1;

      if (idx > 0) {
        sel.node().selectedIndex = idx;
        ved.select();
      } else {
        try {
          var json = JSON.parse(spec);
          ved.select(spec);
        } catch (err) {
          console.error(err);
          console.error('Specification loading failed: ' + spec);
        }
      }
    }

    // Handle post messages
    window.addEventListener('message', function(evt) {
      var data = evt.data;
      console.log('[Vega-Editor] Received Message', evt.origin, data);

      // send acknowledgement
      if (data.spec || data.file) {
        evt.source.postMessage(true, '*');
      }

      // load spec
      if (data.spec) {
        ved.select(data.spec);
      } else if (data.file) {
        sel.node().selectedIndex = ved.specs.indexOf(data.file) + 1;
        ved.select();
      }
    }, false);
  });
};
