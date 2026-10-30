// Motor de pantallas: plantillas con {{valores}}, <sc-if>, <sc-for> y eventos.
// Al actualizar NO reemplaza la página: compara y cambia solo lo necesario,
// así el campo donde estás escribiendo conserva el foco, el cursor y lo escrito.
(function () {
  function DCLogic(props) { this.props = props || {}; this.state = {}; }
  DCLogic.prototype.setState = function (s) { Object.assign(this.state, s); if (this.__render) this.__render(); };
  DCLogic.prototype.forceUpdate = function () { if (this.__render) this.__render(); };

  var whole = /^\s*\{\{([^}]+)\}\}\s*$/;
  function lookup(scope, path) {
    path = path.trim();
    if (path === 'true') return true;
    if (path === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(path)) return Number(path);
    var v = scope, parts = path.split('.');
    for (var i = 0; i < parts.length; i++) { if (v == null) return undefined; v = v[parts[i]]; }
    return v;
  }
  function interp(s, scope) {
    return s.replace(/\{\{([^}]+)\}\}/g, function (_, p) { var v = lookup(scope, p); return v == null ? '' : String(v); });
  }
  // eventos: cada elemento guarda sus manejadores actuales; un solo listener por tipo los despacha
  function setHandler(el, type, fn) {
    el.__h = el.__h || {};
    el.__h[type] = fn;
    el.__hi = el.__hi || {};
    if (!el.__hi[type]) { el.__hi[type] = true; el.addEventListener(type, function (e) { var f = el.__h && el.__h[type]; if (f) f(e); }); }
  }
  var BOOL = ['disabled', 'checked', 'selected', 'readonly', 'required', 'open'];
  function renderInto(parent, nodes, scope) {
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (n.nodeType === 3) { parent.appendChild(document.createTextNode(interp(n.nodeValue, scope))); continue; }
      if (n.nodeType !== 1) continue;
      var tag = n.localName;
      if (tag === 'sc-if') {
        var m = whole.exec(n.getAttribute('value') || '');
        if (m && lookup(scope, m[1])) renderInto(parent, n.childNodes, scope);
        continue;
      }
      if (tag === 'sc-for') {
        var mf = whole.exec(n.getAttribute('list') || '');
        var list = (mf && lookup(scope, mf[1])) || [];
        var as = n.getAttribute('as') || 'item';
        for (var j = 0; j < list.length; j++) { var sub = Object.create(scope); sub[as] = list[j]; sub.$index = j; renderInto(parent, n.childNodes, sub); }
        continue;
      }
      var el = document.createElementNS(n.namespaceURI, tag);
      el.__h = {};
      for (var k = 0; k < n.attributes.length; k++) {
        var a = n.attributes[k], name = a.name;
        if (name.indexOf('hint-') === 0) continue;
        var ma = whole.exec(a.value);
        if (/^on[a-z]+$/i.test(name)) {
          if (ma) { var fn = lookup(scope, ma[1]); if (typeof fn === 'function') el.__h[name.slice(2).toLowerCase()] = fn; }
          continue;
        }
        if (ma) {
          var v = lookup(scope, ma[1]);
          if (BOOL.indexOf(name.toLowerCase()) !== -1) { if (v) el.setAttribute(name, ''); continue; }
          if (v == null || (v === false && name.indexOf('aria') !== 0)) continue;
          el.setAttribute(name, String(v));
        } else el.setAttribute(name, interp(a.value, scope));
      }
      renderInto(el, n.childNodes, scope);
      parent.appendChild(el);
    }
  }
  function bindAll(el) {
    if (el.nodeType !== 1) return;
    var h = el.__h || {}; el.__h = {};
    Object.keys(h).forEach(function (t) { setHandler(el, t, h[t]); });
    for (var c = el.firstChild; c; c = c.nextSibling) bindAll(c);
  }
  function isField(el) { return el.localName === 'input' || el.localName === 'textarea' || el.localName === 'select'; }
  function morphEl(o, n) {
    var focused = o === document.activeElement;
    // atributos
    for (var i = o.attributes.length - 1; i >= 0; i--) { var an = o.attributes[i].name; if (!n.hasAttribute(an)) { o.removeAttribute(an); if (an === 'checked') o.checked = false; if (an === 'selected') o.selected = false; } }
    for (var j = 0; j < n.attributes.length; j++) {
      var a = n.attributes[j], cur = o.getAttribute(a.name);
      if (cur !== a.value) {
        o.setAttribute(a.name, a.value);
        if (a.name === 'value' && isField(o) && o.type !== 'file' && !focused) o.value = a.value;
        if (a.name === 'checked') o.checked = true;
        if (a.name === 'selected') o.selected = true;
      }
    }
    // manejadores de eventos
    var nh = n.__h || {}, oh = o.__h || {};
    Object.keys(oh).forEach(function (t) { if (!nh[t]) oh[t] = null; });
    Object.keys(nh).forEach(function (t) { setHandler(o, t, nh[t]); });
    if (o.localName === 'textarea') { if (!focused && o.value !== n.textContent && o.__tx !== n.textContent) o.value = n.textContent; o.__tx = n.textContent; return; }
    morphChildren(o, n);
  }
  function same(o, n) { return o.nodeType === n.nodeType && (o.nodeType !== 1 || (o.localName === n.localName && o.namespaceURI === n.namespaceURI && (o.localName !== 'input' || o.type === (n.getAttribute('type') || 'text')))); }
  function morphChildren(op, np) {
    var nk = Array.prototype.slice.call(np.childNodes);
    for (var i = 0; i < nk.length; i++) {
      var o = op.childNodes[i], n = nk[i];
      if (!o) { bindAll(n); op.appendChild(n); continue; }
      if (same(o, n)) {
        if (o.nodeType === 3) { if (o.nodeValue !== n.nodeValue) o.nodeValue = n.nodeValue; }
        else morphEl(o, n);
      } else { bindAll(n); op.replaceChild(n, o); }
    }
    while (op.childNodes.length > nk.length) op.removeChild(op.lastChild);
  }

  function boot() {
    var host = document.querySelector('x-dc');
    if (!host) return;
    var helmet = host.querySelector('helmet');
    if (helmet) { Array.prototype.slice.call(helmet.children).forEach(function (c) { document.head.appendChild(c); }); helmet.remove(); }
    var template = Array.prototype.slice.call(host.childNodes);
    var mount = document.createElement('div');
    mount.setAttribute('data-dc-root', '');
    host.replaceWith(mount);
    var script = document.querySelector('script[data-dc-script]');
    var inst = { state: {}, renderVals: function () { return {}; } };
    if (script) {
      var Component = new Function('DCLogic', script.textContent + '\n;return Component;')(DCLogic);
      inst = new Component({});
      if (!inst.state) inst.state = {};
    }
    var rendering = false, again = false;
    inst.__render = function () {
      if (rendering) { again = true; return; }
      rendering = true;
      try {
        do {
          again = false;
          var vals = inst.renderVals() || {};
          var fresh = document.createElement('div');
          renderInto(fresh, template, vals);
          morphChildren(mount, fresh);
        } while (again);
      } finally { rendering = false; }
    };
    inst.__render();
    if (inst.componentDidMount) inst.componentDidMount();
    window.addEventListener('udem-cambio', function () { inst.forceUpdate(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
