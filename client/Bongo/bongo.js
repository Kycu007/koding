!function(){
(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';

        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';

        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }

        var n = loadNodeModulesSync(x, y);
        if (n) return n;

        throw new Error("Cannot find module '" + x + "'");

        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }

            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }

        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }

            return loadAsFileSync(x + '/index');
        }

        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }

            var m = loadAsFileSync(x);
            if (m) return m;
        }

        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');

            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }

            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);

    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);

    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};

    require.define = function (filename, fn) {
        if (require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
        }

        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;

        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };

        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }

  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};
});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process){var process = module.exports = {};

process.nextTick = (function () {
    var queue = [];
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canPost) {
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);
    }

    return function (fn) {
        if (canPost) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        }
        else setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();
});

require.define("vm",function(require,module,exports,__dirname,__filename,process){module.exports = require("vm-browserify")});

require.define("/node_modules/vm-browserify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/vm-browserify/index.js",function(require,module,exports,__dirname,__filename,process){var Object_keys = function (obj) {
    if (Object.keys) return Object.keys(obj)
    else {
        var res = [];
        for (var key in obj) res.push(key)
        return res;
    }
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

var Script = exports.Script = function NodeScript (code) {
    if (!(this instanceof Script)) return new Script(code);
    this.code = code;
};

Script.prototype.runInNewContext = function (context) {
    if (!context) context = {};

    var iframe = document.createElement('iframe');
    if (!iframe.style) iframe.style = {};
    iframe.style.display = 'none';

    document.body.appendChild(iframe);

    var win = iframe.contentWindow;

    forEach(Object_keys(context), function (key) {
        win[key] = context[key];
    });

    if (!win.eval && win.execScript) {
        // win.eval() magically appears when this is called in IE:
        win.execScript('null');
    }

    var res = win.eval(this.code);

    forEach(Object_keys(win), function (key) {
        context[key] = win[key];
    });

    document.body.removeChild(iframe);

    return res;
};

Script.prototype.runInThisContext = function () {
    return eval(this.code); // maybe...
};

Script.prototype.runInContext = function (context) {
    // seems to be just runInNewContext on magical context objects which are
    // otherwise indistinguishable from objects except plain old objects
    // for the parameter segfaults node
    return this.runInNewContext(context);
};

forEach(Object_keys(Script.prototype), function (name) {
    exports[name] = Script[name] = function (code) {
        var s = Script(code);
        return s[name].apply(s, [].slice.call(arguments, 1));
    };
});

exports.createScript = function (code) {
    return exports.Script(code);
};

exports.createContext = Script.createContext = function (context) {
    // not really sure what this one does
    // seems to just make a shallow copy
    var copy = {};
    if(typeof context === 'object') {
        forEach(Object_keys(context), function (key) {
            copy[key] = context[key];
        });
    }
    return copy;
};
});

require.define("/node_modules/microemitter/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/microemitter/index.js",function(require,module,exports,__dirname,__filename,process){var EventEmitter,
  __slice = [].slice,
  __hasProp = {}.hasOwnProperty;

EventEmitter = (function() {
  'use strict';

  var createId, defineProperty, idKey, init, mixin;

  idKey = 'ಠ_ಠ';

  EventEmitter.listeners = {};

  EventEmitter.targets = {};

  EventEmitter.off = function(listenerId) {
    /*
        Note: @off, but no symmetrical "@on".  This is by design.
          One shouldn't add event listeners directly.  These static
          collections are maintained so that the listeners may be
          garbage collected and removed from the emitter's record.
          To that end, @off provides a handy interface.
    */
    delete this.listeners[listenerId];
    delete this.targets[listenerId];
    return this;
  };

  defineProperty = Object.defineProperty || function(obj, prop, _arg) {
    var value;
    value = _arg.value;
    return obj[prop] = value;
  };

  createId = (function() {
    var counter;
    counter = 0;
    return function() {
      return counter++;
    };
  })();

  mixin = function(obj) {
    var prop, prot, _results;
    prot = EventEmitter.prototype;
    _results = [];
    for (prop in prot) {
      _results.push(obj[prop] = prot[prop]);
    }
    return _results;
  };

  init = function(obj) {
    if (!(idKey in obj)) {
      defineProperty(obj, idKey, {
        value: "" + (Math.round(Math.random() * 1e9))
      });
    }
    if (!('_events' in obj)) {
      return defineProperty(obj, '_events', {
        value: {}
      });
    }
  };

  function EventEmitter(obj) {
    if (obj != null) {
      mixin(obj);
    } else {
      obj = this;
    }
  }

  EventEmitter.prototype.on = function(evt, listener) {
    var lid, listeners, _base;
    if (listener == null) {
      throw new Error('Listener is required!');
    }
    init(this);
    this.emit('newListener', evt, listener);
    listeners = (_base = this._events)[evt] || (_base[evt] = {});
    if (this[idKey] in listener) {
      lid = listener[this[idKey]];
    } else {
      lid = createId();
      defineProperty(listener, this[idKey], {
        value: lid
      });
    }
    EventEmitter.listeners[lid] = listeners[lid] = listener;
    EventEmitter.targets[lid] = this;
    return this;
  };

  EventEmitter.prototype.once = function(evt, listener) {
    var wrappedListener,
      _this = this;
    wrappedListener = function() {
      var rest;
      rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      _this.off(evt, wrappedListener);
      return listener.apply(_this, rest);
    };
    return this.on(evt, wrappedListener);
  };

  EventEmitter.prototype.when = function() {};

  EventEmitter.prototype.off = function(evt, listener) {
    var key, listenerId, listeners, _ref;
    init(this);
    switch (arguments.length) {
      case 0:
        _ref = this._events;
        for (key in _ref) {
          if (!__hasProp.call(_ref, key)) continue;
          delete this._events[key];
        }
        break;
      case 1:
        this._events[evt] = {};
        break;
      default:
        listeners = this._events[evt];
        listenerId = listener[this[idKey]];
        if (listeners != null) {
          delete listeners[listenerId];
        }
        EventEmitter.off(listenerId);
    }
    return this;
  };

  EventEmitter.prototype.emit = function() {
    var evt, id, listener, listeners, rest;
    evt = arguments[0], rest = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
    init(this);
    listeners = this._events[evt];
    for (id in listeners) {
      if (!__hasProp.call(listeners, id)) continue;
      listener = listeners[id];
      listener.call.apply(listener, [this].concat(__slice.call(rest)));
    }

    if (listeners === null){
      listeners = [];
    }

    if (evt === 'error' && listeners.length === 0) {
      throw rest[0];
    }
    return this;
  };

  return EventEmitter;

})();

if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
  module.exports.EventEmitter = EventEmitter;
} else if ((typeof define !== "undefined" && define !== null ? define.amd : void 0) != null) {
  define(function() {
    return EventEmitter;
  });
} else {
  this['EventEmitter'] = EventEmitter;
}
});

require.define("/node_modules/traverse/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/traverse/index.js",function(require,module,exports,__dirname,__filename,process){var traverse = module.exports = function (obj) {
    return new Traverse(obj);
};

function Traverse (obj) {
    this.value = obj;
}

Traverse.prototype.get = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            node = undefined;
            break;
        }
        node = node[key];
    }
    return node;
};

Traverse.prototype.has = function (ps) {
    var node = this.value;
    for (var i = 0; i < ps.length; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) {
            return false;
        }
        node = node[key];
    }
    return true;
};

Traverse.prototype.set = function (ps, value) {
    var node = this.value;
    for (var i = 0; i < ps.length - 1; i ++) {
        var key = ps[i];
        if (!Object.hasOwnProperty.call(node, key)) node[key] = {};
        node = node[key];
    }
    node[ps[i]] = value;
    return value;
};

Traverse.prototype.map = function (cb) {
    return walk(this.value, cb, true);
};

Traverse.prototype.forEach = function (cb) {
    this.value = walk(this.value, cb, false);
    return this.value;
};

Traverse.prototype.reduce = function (cb, init) {
    var skip = arguments.length === 1;
    var acc = skip ? this.value : init;
    this.forEach(function (x) {
        if (!this.isRoot || !skip) {
            acc = cb.call(this, acc, x);
        }
    });
    return acc;
};

Traverse.prototype.paths = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.path);
    });
    return acc;
};

Traverse.prototype.nodes = function () {
    var acc = [];
    this.forEach(function (x) {
        acc.push(this.node);
    });
    return acc;
};

Traverse.prototype.clone = function () {
    var parents = [], nodes = [];

    return (function clone (src) {
        // for (var i = 0; i < parents.length; i++) {
        //     if (parents[i] === src) {
        //         return nodes[i];
        //     }
        // }

        if (typeof src === 'object' && src !== null) {
            var dst = copy(src);

            parents.push(src);
            nodes.push(dst);

            forEach(objectKeys(src), function (key) {
                dst[key] = clone(src[key]);
            });

            parents.pop();
            nodes.pop();
            return dst;
        }
        else {
            return src;
        }
    })(this.value);
};

function walk (root, cb, immutable) {
    var path = [];
    var parents = [];
    var alive = true;

    return (function walker (node_) {
        var node = immutable ? copy(node_) : node_;
        var modifiers = {};

        var keepGoing = true;

        var state = {
            node : node,
            node_ : node_,
            path : [].concat(path),
            parent : parents[parents.length - 1],
            parents : parents,
            key : path.slice(-1)[0],
            isRoot : path.length === 0,
            level : path.length,
            // circular : null,
            update : function (x, stopHere) {
                if (!state.isRoot) {
                    state.parent.node[state.key] = x;
                }
                state.node = x;
                if (stopHere) keepGoing = false;
            },
            'delete' : function (stopHere) {
                delete state.parent.node[state.key];
                if (stopHere) keepGoing = false;
            },
            remove : function (stopHere) {
                if (isArray(state.parent.node)) {
                    state.parent.node.splice(state.key, 1);
                }
                else {
                    delete state.parent.node[state.key];
                }
                if (stopHere) keepGoing = false;
            },
            keys : null,
            before : function (f) { modifiers.before = f },
            after : function (f) { modifiers.after = f },
            pre : function (f) { modifiers.pre = f },
            post : function (f) { modifiers.post = f },
            stop : function () { alive = false },
            block : function () { keepGoing = false }
        };

        if (!alive) return state;

        function updateState() {
            if (typeof state.node === 'object' && state.node !== null) {
                if (!state.keys || state.node_ !== state.node) {
                    state.keys = objectKeys(state.node)
                }

                state.isLeaf = state.keys.length == 0;

                // for (var i = 0; i < parents.length; i++) {
                //     if (parents[i].node_ === node_) {
                //         state.circular = parents[i];
                //         break;
                //     }
                // }
            }
            else {
                state.isLeaf = true;
                state.keys = null;
            }

            state.notLeaf = !state.isLeaf;
            state.notRoot = !state.isRoot;
        }

        updateState();

        // use return values to update if defined
        var ret = cb.call(state, state.node);
        if (ret !== undefined && state.update) state.update(ret);

        if (modifiers.before) modifiers.before.call(state, state.node);

        if (!keepGoing) return state;

        if (typeof state.node == 'object'
        && state.node !== null /*&& !state.circular*/) {
            parents.push(state);

            // updateState();

            forEach(state.keys, function (key, i) {
                path.push(key);

                if (modifiers.pre) modifiers.pre.call(state, state.node[key], key);

                var child = walker(state.node[key]);
                if (immutable && Object.hasOwnProperty.call(state.node, key)) {
                    state.node[key] = child.node;
                }

                child.isLast = i == state.keys.length - 1;
                child.isFirst = i == 0;

                if (modifiers.post) modifiers.post.call(state, child);

                path.pop();
            });
            parents.pop();
        }

        if (modifiers.after) modifiers.after.call(state, state.node);

        return state;
    })(root).node;
}

function copy (src) {
    if (typeof src === 'object' && src !== null) {
        var dst;

        if (isArray(src)) {
            dst = [];
        }
        else if (isDate(src)) {
            dst = new Date(src);
        }
        else if (isRegExp(src)) {
            dst = new RegExp(src);
        }
        else if (isError(src)) {
            dst = { message: src.message };
        }
        else if (isBoolean(src)) {
            dst = new Boolean(src);
        }
        else if (isNumber(src)) {
            dst = new Number(src);
        }
        else if (isString(src)) {
            dst = new String(src);
        }
        else if (Object.create && Object.getPrototypeOf) {
            dst = Object.create(Object.getPrototypeOf(src));
        }
        else if (src.constructor === Object) {
            dst = {};
        }
        else {
            var proto =
                (src.constructor && src.constructor.prototype)
                || src.__proto__
                || {}
            ;
            var T = function () {};
            T.prototype = proto;
            dst = new T;
        }

        forEach(objectKeys(src), function (key) {
            dst[key] = src[key];
        });
        return dst;
    }
    else return src;
}

var objectKeys = Object.keys || function keys (obj) {
    var res = [];
    for (var key in obj) res.push(key)
    return res;
};

function toS (obj) { return Object.prototype.toString.call(obj) }
function isDate (obj) { return toS(obj) === '[object Date]' }
function isRegExp (obj) { return toS(obj) === '[object RegExp]' }
function isError (obj) { return toS(obj) === '[object Error]' }
function isBoolean (obj) { return toS(obj) === '[object Boolean]' }
function isNumber (obj) { return toS(obj) === '[object Number]' }
function isString (obj) { return toS(obj) === '[object String]' }

var isArray = Array.isArray || function isArray (xs) {
    return Object.prototype.toString.call(xs) === '[object Array]';
};

var forEach = function (xs, fn) {
    if (xs.forEach) return xs.forEach(fn)
    else for (var i = 0; i < xs.length; i++) {
        fn(xs[i], i, xs);
    }
};

forEach(objectKeys(Traverse.prototype), function (key) {
    traverse[key] = function (obj) {
        var args = [].slice.call(arguments, 1);
        var t = new Traverse(obj);
        return t[key].apply(t, args);
    };
});
});

require.define("/node_modules/hat/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/hat/index.js",function(require,module,exports,__dirname,__filename,process){var hat = module.exports = function (bits, base) {
    if (!base) base = 16;
    if (bits === undefined) bits = 128;
    if (bits <= 0) return '0';

    var digits = Math.log(Math.pow(2, bits)) / Math.log(base);
    for (var i = 2; digits === Infinity; i *= 2) {
        digits = Math.log(Math.pow(2, bits / i)) / Math.log(base) * i;
    }

    var rem = digits - Math.floor(digits);

    var res = '';

    for (var i = 0; i < Math.floor(digits); i++) {
        var x = Math.floor(Math.random() * base).toString(base);
        res = x + res;
    }

    if (rem) {
        var b = Math.pow(base, rem);
        var x = Math.floor(Math.random() * b).toString(base);
        res = x + res;
    }

    var parsed = parseInt(res, base);
    if (parsed !== Infinity && parsed >= Math.pow(2, bits)) {
        return hat(bits, base)
    }
    else return res;
};

hat.rack = function (bits, base, expandBy) {
    var fn = function (data) {
        var iters = 0;
        do {
            if (iters ++ > 10) {
                if (expandBy) bits += expandBy;
                else throw new Error('too many ID collisions, use more bits')
            }

            var id = hat(bits, base);
        } while (Object.hasOwnProperty.call(hats, id));

        hats[id] = data;
        return id;
    };
    var hats = fn.hats = {};

    fn.get = function (id) {
        return fn.hats[id];
    };

    fn.set = function (id, value) {
        fn.hats[id] = value;
        return fn;
    };

    fn.bits = bits || 128;
    fn.base = base || 16;
    return fn;
};
});

require.define("/node_modules/jspath/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/jspath/index.js",function(require,module,exports,__dirname,__filename,process){(function() {
  var JsPath,
    __slice = Array.prototype.slice;

  module.exports = JsPath = (function() {
    var primTypes,
      _this = this;

    primTypes = /^(string|number|boolean)$/;

    /*
      @constructor.
      @signature: new JsPath(path, val)
      @param: path - a dot-notation style "path" to identify a
        nested JS object.
      @description: Initialize a new js object with the provided
        path.  I've never actually used this constructor for any-
        thing, and it is here for the sake of "comprehensiveness"
        at this time, although I am incredulous as to it's overall
        usefulness.
    */

    function JsPath(path, val) {
      return JsPath.setAt({}, path, val || {});
    }

    ['forEach', 'indexOf', 'join', 'pop', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'push'].forEach(function(method) {
      return JsPath[method + 'At'] = function() {
        var obj, path, rest, target;
        obj = arguments[0], path = arguments[1], rest = 3 <= arguments.length ? __slice.call(arguments, 2) : [];
        target = JsPath.getAt(obj, path);
        if ('function' === typeof (target != null ? target[method] : void 0)) {
          return target[method].apply(target, rest);
        } else {
          throw new Error("Does not implement method " + method + " at " + path);
        }
      };
    });

    /*
      @method. property of the constructor.
      @signature: JsPath.getAt(ref, path)
      @param: ref - the object to traverse.
      @param: path - a dot-notation style "path" to identify a
        nested JS object.
      @return: the object that can be found inside ref at the path
        described by the second parameter or undefined if the path
        is not valid.
    */

    JsPath.getAt = function(ref, path) {
      var prop;
      if ('function' === typeof path.split) {
        path = path.split('.');
      } else {
        path = path.slice();
      }
      while ((ref != null) && (prop = path.shift())) {
        ref = ref[prop];
      }
      return ref;
    };

    /*
      @method. property of the constructor.
      @signature: JsPath.getAt(ref, path)
      @param: obj - the object to extend.
      @param: path - a dot-notation style "path" to identify a
        nested JS object.
      @param: val - the value to assign to the path of the obj.
      @return: the object that was extended.
      @description: set a property to the path provided by the
        second parameter with the value provided by the third
        parameter.
    */

    JsPath.setAt = function(obj, path, val) {
      var component, last, prev, ref;
      if ('function' === typeof path.split) {
        path = path.split('.');
      } else {
        path = path.slice();
      }
      last = path.pop();
      prev = [];
      ref = obj;
      while (component = path.shift()) {
        if (primTypes.test(typeof ref[component])) {
          throw new Error("" + (prev.concat(component).join('.')) + " is\nprimitive, and cannot be extended.");
        }
        ref = ref[component] || (ref[component] = {});
        prev.push(component);
      }
      ref[last] = val;
      return obj;
    };

    JsPath.assureAt = function(ref, path, initializer) {
      var obj;
      if (obj = JsPath.getAt(ref, path)) {
        return obj;
      } else {
        JsPath.setAt(ref, path, initializer);
        return initializer;
      }
    };

    /*
      @method. property of the constructor.
      @signature: JsPath.deleteAt(ref, path)
      @param: obj - the object to extend.
      @param: path - a dot-notation style "path" to identify a
        nested JS object to dereference.
      @return: boolean success.
      @description: deletes the reference specified by the last
        unit of the path from the object specified by other
        components of the path, belonging to the provided object.
    */

    JsPath.deleteAt = function(ref, path) {
      var component, last, prev;
      if ('function' === typeof path.split) {
        path = path.split('.');
      } else {
        path = path.slice();
      }
      prev = [];
      last = path.pop();
      while (component = path.shift()) {
        if (primTypes.test(typeof ref[component])) {
          throw new Error("" + (prev.concat(component).join('.')) + " is\nprimitive; cannot drill any deeper.");
        }
        if (!(ref = ref[component])) return false;
        prev.push(component);
      }
      return delete ref[last];
    };

    return JsPath;

  }).call(this);

  /*
  Footnotes:
    1 - if there's no .split() method, assume it's already an array
  */

}).call(this);
});

require.define("/node_modules/koding-dnode-protocol/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/koding-dnode-protocol/index.js",function(require,module,exports,__dirname,__filename,process){var DnodeScrubber, DnodeSession, DnodeStore, EventEmitter, Scrubber, createId, exports, getAt, parseArgs, setAt, stream, _ref;
var __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; }, __hasProp = Object.prototype.hasOwnProperty, __extends = function(child, parent) {
  for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; }
  function ctor() { this.constructor = child; }
  ctor.prototype = parent.prototype;
  child.prototype = new ctor;
  child.__super__ = parent.prototype;
  return child;
};
EventEmitter = require('events').EventEmitter;
_ref = require('jspath'), getAt = _ref.getAt, setAt = _ref.setAt;
Scrubber = require('scrubber');
createId = require('hat').rack();
stream = process.title === "browser" ? {} : require("stream");
JSON || (JSON = require('jsonify'));
exports = module.exports = function(wrapper) {
  return {
    sessions: {},
    create: function() {
      var id;
      id = createId();
      return this.sessions[id] = new DnodeSession(id, wrapper);
    },
    destroy: function(id) {
      return delete this.sessions[id];
    }
  };
};
/**
* @class DnodeSession
* @description an implementation of the Session class from dnode-protocol
*/
exports.Session = DnodeSession = (function() {
  var apply;
  __extends(DnodeSession, EventEmitter);
  function DnodeSession(id, wrapper) {
    this.id = id;
    this.parse = __bind(this.parse, this);
    this.remote = {};
    this.instance = 'function' === typeof wrapper ? new wrapper(this.remote, this) : wrapper || {};
    this.localStore = new DnodeStore;
    this.remoteStore = new DnodeStore;
    this.localStore.on('cull', __bind(function(id) {
      return this.emit('request', {
        method: 'cull',
        arguments: [id],
        callbacks: {}
      });
    }, this));
  }
  DnodeSession.prototype.start = function() {
    return this.request('methods', [this.instance]);
  };
  DnodeSession.prototype.request = function(method, args) {
    var scrubber;
    scrubber = new DnodeScrubber(this.localStore);
    return scrubber.scrub(args, __bind(function() {
      var scrubbed;
      scrubbed = scrubber.toDnodeProtocol();
      scrubbed.method = method;
      return this.emit('request', scrubbed);
    }, this));
  };
  DnodeSession.prototype.parse = function(line) {
    var msg;
    try {
      msg = JSON.parse(line);
    } catch (err) {
      this.emit('error', new SyntaxError("JSON parsing error: " + err));
    }
    return this.handle(msg);
  };
  DnodeSession.prototype.handle = function(msg) {
    var args, method, scrubber;
    scrubber = new DnodeScrubber(this.localStore);
    args = scrubber.unscrub(msg, __bind(function(callbackId) {
      if (!this.remoteStore.has(callbackId)) {
        this.remoteStore.add(callbackId, __bind(function() {
          return this.request(callbackId, [].slice.call(arguments));
        }, this));
      }
      return this.remoteStore.get(callbackId);
    }, this));
    method = msg.method;
    switch (method) {
      case 'methods':
        return this.handleMethods(args[0]);
      case 'error':
        return this.emit('remoteError', args[0]);
      case 'cull':
        return args.forEach(__bind(function(id) {
          return this.remoteStore.cull(id);
        }, this));
      default:
        switch (typeof method) {
          case 'string':
            if (this.instance.propertyIsEnumerable(method)) {
              return apply(this.instance[method], this.instance, args);
            } else {
              return this.emit('error', new Error("Request for non-enumerable method: " + method));
            }
            break;
          case 'number':
            return apply(this.localStore.get(method), this.instance, args);
        }
    }
  };
  DnodeSession.prototype.handleMethods = function(methods) {
    if (methods == null) {
      methods = {};
    }
    Object.keys(this.remote).forEach(__bind(function(key) {
      return delete this.remote[key];
    }, this));
    Object.keys(methods).forEach(__bind(function(key) {
      return this.remote[key] = methods[key];
    }, this));
    this.emit('remote', this.remote);
    return this.emit('ready');
  };
  apply = function(fn, ctx, args) {
    return fn.apply(ctx, args);
  };
  return DnodeSession;
})();
/**
* @class DnodeScrubber
* @description an implementation of the Scrubber class from dnode-protocol that supports a middleware stack
*/
exports.Scrubber = DnodeScrubber = (function() {
  __extends(DnodeScrubber, Scrubber);
  function DnodeScrubber(store) {
    var dnodeMutators, userStack;
    if (store == null) {
      store = new DnodeStore;
    }
    this.paths = {};
    this.links = [];
    dnodeMutators = [
      function(cursor) {
        var i, id, node, path;
        node = cursor.node, path = cursor.path;
        if ('function' === typeof node) {
          i = store.indexOf(node);
          if (~i && !(i in this.paths)) {
            this.paths[i] = path;
          } else {
            id = store.add(node);
            this.paths[id] = path;
          }
          return cursor.update('[Function]', true);
        }
      }, function(cursor) {
        if (cursor.circular) {
          this.links.push({
            from: cursor.circular.path,
            to: cursor.path
          });
          return cursor.update('[Circular]', true);
        }
      }
    ];
    userStack = DnodeScrubber.stack || [];
    Scrubber.apply(this, dnodeMutators.concat(userStack));
  }
  DnodeScrubber.prototype.unscrub = function(msg, getCallback) {
    var args;
    args = msg.arguments || [];
    Object.keys(msg.callbacks || {}).forEach(function(strId) {
      var callback, id, path;
      id = parseInt(strId, 10);
      path = msg.callbacks[id];
      callback = getCallback(id);
      callback.id = id;
      return setAt(args, path, callback);
    });
    (msg.links || []).forEach(function(link) {
      return setAt(args, link.to, getAt(args, link.from));
    });
    return args;
  };
  DnodeScrubber.prototype.toDnodeProtocol = function() {
    var out;
    out = {
      arguments: this.out
    };
    out.callbacks = this.paths;
    if (this.links.length) {
      out.links = this.links;
    }
    return out;
  };
  return DnodeScrubber;
})();
/**
* @class DnodeStore
* @description an implementation of the Store class from dnode-protocol
*/
exports.Store = DnodeStore = (function() {
  var autoCull, wrap;
  __extends(DnodeStore, EventEmitter);
  function DnodeStore() {
    this.items = [];
  }
  DnodeStore.prototype.has = function(id) {
    return this.items[id] != null;
  };
  DnodeStore.prototype.get = function(id) {
    var item;
    item = this.items[id];
    if (item == null) {
      return null;
    }
    return wrap(item);
  };
  DnodeStore.prototype.add = function(id, fn) {
    var _ref2;
    if (!fn) {
      _ref2 = [id, fn], fn = _ref2[0], id = _ref2[1];
    }
    if (id == null) {
      id = this.items.length;
    }
    this.items[id] = fn;
    return id;
  };
  DnodeStore.prototype.cull = function(arg) {
    if ('function' === typeof arg) {
      arg = this.items.indexOf(arg);
    }
    delete this.items[arg];
    return arg;
  };
  DnodeStore.prototype.indexOf = function(fn) {
    return this.items.indexOf(fn);
  };
  wrap = function(fn) {
    return function() {
      fn.apply(this, arguments);
      return autoCull(fn);
    };
  };
  autoCull = function(fn) {
    var id;
    if ('number' === typeof fn.times) {
      fn.times--;
      if (fn.times === 0) {
        id = this.cull(fn);
        return this.emit('cull', id);
      }
    }
  };
  return DnodeStore;
})();
parseArgs = exports.parseArgs = function(argv) {
  var params;
  params = {};
  [].slice.call(argv).forEach(function(arg) {
    switch (typeof arg) {
      case 'string':
        if (arg.match(/^\d+$/)) {
          return params.port = parseInt(arg, 10);
        } else if (arg.match("^/")) {
          return params.path = arg;
        } else {
          return params.host = arg;
        }
        break;
      case 'number':
        return params.port = arg;
      case 'function':
        return params.block = arg;
      case 'object':
        if (arg.__proto__ === Object.prototype) {
          return Object.keys(arg).forEach(function(key) {
            return params[key] = arg[key];
          });
        } else if (stream.Stream && arg instanceof stream.Stream) {
          return params.stream = arg;
        } else {
          return params.server = arg;
        }
        break;
      case 'undefined':
        break;
      default:
        throw new Error('Not sure what to do about ' + typeof arg + ' objects');
    }
  });
  return params;
};});

require.define("events",function(require,module,exports,__dirname,__filename,process){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = list.indexOf(listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};
});

require.define("/node_modules/scrubber/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/scrubber/index.js",function(require,module,exports,__dirname,__filename,process){var Scrubber, Traverse, daisy, global, slowDaisy,
  __slice = [].slice;

Traverse = require('traverse');

global = typeof window !== "undefined" && window !== null ? window : this;

/**
* @helper daisy
* @description - serial async helper
*/


daisy = function(args) {
  return process.nextTick(args.next = function() {
    var fn;
    if (fn = args.shift()) {
      return !!fn(args);
    }
  });
};

slowDaisy = function(args) {
  return console.log("it's a slow daisy", args);
};

module.exports = Scrubber = (function() {
  var seemsTooComplex,
    _this = this;

  Scrubber.use = function() {
    var middleware;
    middleware = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if (this.stack == null) {
      return this.stack = middleware;
    } else {
      return this.stack = this.stack.concat(middleware);
    }
  };

  /**
  * @constructor Scrubber
  * @description - initializes the Scrubber instance.
  */


  function Scrubber() {
    var middleware;
    middleware = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    if ('function' === typeof middleware[0]) {
      this.stack = middleware;
    } else {
      this.stack = middleware[0];
    }
  }

  /**
  * @method Scrubber#scrub
  * @description - traverses an arbitrary JS object and applies the middleware
  *  stack, serially, to each node encountered during the walk.
  */


  Scrubber.prototype.scrub = function(obj, callback) {
    var nodes, queue, scrubber, steps;
    scrubber = this;
    queue = [];
    steps = this.stack.map(function(fn) {
      switch (fn.length) {
        case 0:
        case 1:
          return function(cursor, next) {
            fn.call(this, cursor);
            return next();
          };
        case 2:
          return fn;
        default:
          throw new TypeError('Scrubber requires a callback with 1- or 2-arity. ' + ("User provided a " + fn.length + "-arity callback"));
      }
    });
    nodes = [];
    this.out = new Traverse(obj).map(function() {
      var cursor;
      cursor = this;
      steps.forEach(function(step) {
        return queue.push(function() {
          return step.call(scrubber, cursor, function() {
            return queue.next();
          });
        });
      });
    });
    queue.push(function() {
      return callback.call(scrubber);
    });
    return daisy(queue);
  };

  seemsTooComplex = (function() {
    var f, i, maxStackSize;
    maxStackSize = (function() {
      try {
        i = 0;
        return (f = function() {
          i++;
          return f();
        })();
      } catch (e) {
        return i;
      }
    })();
    return function(length, weight) {
      var guess;
      guess = length * weight;
      return guess > maxStackSize;
    };
  })();

  /**
  * @method Scrubber#forEach
  * @method Scrubber#indexOfå
  * @method Scrubber#join
  * @method Scrubber#pop
  * @method Scrubber#reverse
  * @method Scrubber#shift
  * @method Scrubber#sort
  * @method Scrubber#splice
  * @method Scrubber#unshift
  * @method Scrubber#push
  * @description - proxies for the native Array methods; they apply themselves
  *   to the middleware stack
  */


  ['forEach', 'indexOf', 'join', 'pop', 'reverse', 'shift', 'sort', 'splice', 'unshift', 'push'].forEach(function(method) {
    return Scrubber.prototype[method] = function() {
      var rest;
      rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return this.stack[method].apply(this.stack, rest);
    };
  });

  /**
  * @method Scrubber#use
  * @description alias for push.
  */


  Scrubber.prototype.use = Scrubber.prototype.push;

  return Scrubber;

}).call(this);
});

require.define("stream",function(require,module,exports,__dirname,__filename,process){var events = require('events');
var util = require('util');

function Stream() {
  events.EventEmitter.call(this);
}
util.inherits(Stream, events.EventEmitter);
module.exports = Stream;
// Backwards-compat with node 0.4.x
Stream.Stream = Stream;

Stream.prototype.pipe = function(dest, options) {
  var source = this;

  function ondata(chunk) {
    if (dest.writable) {
      if (false === dest.write(chunk) && source.pause) {
        source.pause();
      }
    }
  }

  source.on('data', ondata);

  function ondrain() {
    if (source.readable && source.resume) {
      source.resume();
    }
  }

  dest.on('drain', ondrain);

  // If the 'end' option is not supplied, dest.end() will be called when
  // source gets the 'end' or 'close' events.  Only dest.end() once, and
  // only when all sources have ended.
  if (!dest._isStdio && (!options || options.end !== false)) {
    dest._pipeCount = dest._pipeCount || 0;
    dest._pipeCount++;

    source.on('end', onend);
    source.on('close', onclose);
  }

  var didOnEnd = false;
  function onend() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.end();
  }


  function onclose() {
    if (didOnEnd) return;
    didOnEnd = true;

    dest._pipeCount--;

    // remove the listeners
    cleanup();

    if (dest._pipeCount > 0) {
      // waiting for other incoming streams to end.
      return;
    }

    dest.destroy();
  }

  // don't leave dangling pipes when there are errors.
  function onerror(er) {
    cleanup();
    if (this.listeners('error').length === 0) {
      throw er; // Unhandled stream error in pipe.
    }
  }

  source.on('error', onerror);
  dest.on('error', onerror);

  // remove all the event listeners that were added.
  function cleanup() {
    source.removeListener('data', ondata);
    dest.removeListener('drain', ondrain);

    source.removeListener('end', onend);
    source.removeListener('close', onclose);

    source.removeListener('error', onerror);
    dest.removeListener('error', onerror);

    source.removeListener('end', cleanup);
    source.removeListener('close', cleanup);

    dest.removeListener('end', cleanup);
    dest.removeListener('close', cleanup);
  }

  source.on('end', cleanup);
  source.on('close', cleanup);

  dest.on('end', cleanup);
  dest.on('close', cleanup);

  dest.emit('pipe', source);

  // Allow for unix-like usage: A.pipe(B).pipe(C)
  return dest;
};
});

require.define("util",function(require,module,exports,__dirname,__filename,process){var events = require('events');

exports.print = function () {};
exports.puts = function () {};
exports.debug = function() {};

exports.inspect = function(obj, showHidden, depth, colors) {
  var seen = [];

  var stylize = function(str, styleType) {
    // http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
    var styles =
        { 'bold' : [1, 22],
          'italic' : [3, 23],
          'underline' : [4, 24],
          'inverse' : [7, 27],
          'white' : [37, 39],
          'grey' : [90, 39],
          'black' : [30, 39],
          'blue' : [34, 39],
          'cyan' : [36, 39],
          'green' : [32, 39],
          'magenta' : [35, 39],
          'red' : [31, 39],
          'yellow' : [33, 39] };

    var style =
        { 'special': 'cyan',
          'number': 'blue',
          'boolean': 'yellow',
          'undefined': 'grey',
          'null': 'bold',
          'string': 'green',
          'date': 'magenta',
          // "name": intentionally not styling
          'regexp': 'red' }[styleType];

    if (style) {
      return '\033[' + styles[style][0] + 'm' + str +
             '\033[' + styles[style][1] + 'm';
    } else {
      return str;
    }
  };
  if (! colors) {
    stylize = function(str, styleType) { return str; };
  }

  function format(value, recurseTimes) {
    // Provide a hook for user-specified inspect functions.
    // Check that value is an object with an inspect function on it
    if (value && typeof value.inspect === 'function' &&
        // Filter out the util module, it's inspect function is special
        value !== exports &&
        // Also filter out any prototype objects using the circular check.
        !(value.constructor && value.constructor.prototype === value)) {
      return value.inspect(recurseTimes);
    }

    // Primitive types cannot have properties
    switch (typeof value) {
      case 'undefined':
        return stylize('undefined', 'undefined');

      case 'string':
        var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                                 .replace(/'/g, "\\'")
                                                 .replace(/\\"/g, '"') + '\'';
        return stylize(simple, 'string');

      case 'number':
        return stylize('' + value, 'number');

      case 'boolean':
        return stylize('' + value, 'boolean');
    }
    // For some reason typeof null is "object", so special case here.
    if (value === null) {
      return stylize('null', 'null');
    }

    // Look up the keys of the object.
    var visible_keys = Object_keys(value);
    var keys = showHidden ? Object_getOwnPropertyNames(value) : visible_keys;

    // Functions without properties can be shortcutted.
    if (typeof value === 'function' && keys.length === 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        var name = value.name ? ': ' + value.name : '';
        return stylize('[Function' + name + ']', 'special');
      }
    }

    // Dates without properties can be shortcutted
    if (isDate(value) && keys.length === 0) {
      return stylize(value.toUTCString(), 'date');
    }

    var base, type, braces;
    // Determine the object type
    if (isArray(value)) {
      type = 'Array';
      braces = ['[', ']'];
    } else {
      type = 'Object';
      braces = ['{', '}'];
    }

    // Make functions say that they are functions
    if (typeof value === 'function') {
      var n = value.name ? ': ' + value.name : '';
      base = (isRegExp(value)) ? ' ' + value : ' [Function' + n + ']';
    } else {
      base = '';
    }

    // Make dates with properties first say the date
    if (isDate(value)) {
      base = ' ' + value.toUTCString();
    }

    if (keys.length === 0) {
      return braces[0] + base + braces[1];
    }

    if (recurseTimes < 0) {
      if (isRegExp(value)) {
        return stylize('' + value, 'regexp');
      } else {
        return stylize('[Object]', 'special');
      }
    }

    seen.push(value);

    var output = keys.map(function(key) {
      var name, str;
      if (value.__lookupGetter__) {
        if (value.__lookupGetter__(key)) {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Getter/Setter]', 'special');
          } else {
            str = stylize('[Getter]', 'special');
          }
        } else {
          if (value.__lookupSetter__(key)) {
            str = stylize('[Setter]', 'special');
          }
        }
      }
      if (visible_keys.indexOf(key) < 0) {
        name = '[' + key + ']';
      }
      if (!str) {
        if (seen.indexOf(value[key]) < 0) {
          if (recurseTimes === null) {
            str = format(value[key]);
          } else {
            str = format(value[key], recurseTimes - 1);
          }
          if (str.indexOf('\n') > -1) {
            if (isArray(value)) {
              str = str.split('\n').map(function(line) {
                return '  ' + line;
              }).join('\n').substr(2);
            } else {
              str = '\n' + str.split('\n').map(function(line) {
                return '   ' + line;
              }).join('\n');
            }
          }
        } else {
          str = stylize('[Circular]', 'special');
        }
      }
      if (typeof name === 'undefined') {
        if (type === 'Array' && key.match(/^\d+$/)) {
          return str;
        }
        name = JSON.stringify('' + key);
        if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
          name = name.substr(1, name.length - 2);
          name = stylize(name, 'name');
        } else {
          name = name.replace(/'/g, "\\'")
                     .replace(/\\"/g, '"')
                     .replace(/(^"|"$)/g, "'");
          name = stylize(name, 'string');
        }
      }

      return name + ': ' + str;
    });

    seen.pop();

    var numLinesEst = 0;
    var length = output.reduce(function(prev, cur) {
      numLinesEst++;
      if (cur.indexOf('\n') >= 0) numLinesEst++;
      return prev + cur.length + 1;
    }, 0);

    if (length > 50) {
      output = braces[0] +
               (base === '' ? '' : base + '\n ') +
               ' ' +
               output.join(',\n  ') +
               ' ' +
               braces[1];

    } else {
      output = braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
    }

    return output;
  }
  return format(obj, (typeof depth === 'undefined' ? 2 : depth));
};


function isArray(ar) {
  return ar instanceof Array ||
         Array.isArray(ar) ||
         (ar && ar !== Object.prototype && isArray(ar.__proto__));
}


function isRegExp(re) {
  return re instanceof RegExp ||
    (typeof re === 'object' && Object.prototype.toString.call(re) === '[object RegExp]');
}


function isDate(d) {
  if (d instanceof Date) return true;
  if (typeof d !== 'object') return false;
  var properties = Date.prototype && Object_getOwnPropertyNames(Date.prototype);
  var proto = d.__proto__ && Object_getOwnPropertyNames(d.__proto__);
  return JSON.stringify(proto) === JSON.stringify(properties);
}

function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}

var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}

exports.log = function (msg) {};

exports.pump = null;

var Object_keys = Object.keys || function (obj) {
    var res = [];
    for (var key in obj) res.push(key);
    return res;
};

var Object_getOwnPropertyNames = Object.getOwnPropertyNames || function (obj) {
    var res = [];
    for (var key in obj) {
        if (Object.hasOwnProperty.call(obj, key)) res.push(key);
    }
    return res;
};

var Object_create = Object.create || function (prototype, properties) {
    // from es5-shim
    var object;
    if (prototype === null) {
        object = { '__proto__' : null };
    }
    else {
        if (typeof prototype !== 'object') {
            throw new TypeError(
                'typeof prototype[' + (typeof prototype) + '] != \'object\''
            );
        }
        var Type = function () {};
        Type.prototype = prototype;
        object = new Type();
        object.__proto__ = prototype;
    }
    if (typeof properties !== 'undefined' && Object.defineProperties) {
        Object.defineProperties(object, properties);
    }
    return object;
};

exports.inherits = function(ctor, superCtor) {
  ctor.super_ = superCtor;
  ctor.prototype = Object_create(superCtor.prototype, {
    constructor: {
      value: ctor,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
};
});

require.define("/node_modules/jsonify/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/jsonify/index.js",function(require,module,exports,__dirname,__filename,process){exports.parse = require('./lib/parse');
exports.stringify = require('./lib/stringify');
});

require.define("/node_modules/jsonify/lib/parse.js",function(require,module,exports,__dirname,__filename,process){var at, // The index of the current character
    ch, // The current character
    escapee = {
        '"':  '"',
        '\\': '\\',
        '/':  '/',
        b:    '\b',
        f:    '\f',
        n:    '\n',
        r:    '\r',
        t:    '\t'
    },
    text,

    error = function (m) {
        // Call error when something is wrong.
        throw {
            name:    'SyntaxError',
            message: m,
            at:      at,
            text:    text
        };
    },

    next = function (c) {
        // If a c parameter is provided, verify that it matches the current character.
        if (c && c !== ch) {
            error("Expected '" + c + "' instead of '" + ch + "'");
        }

        // Get the next character. When there are no more characters,
        // return the empty string.

        ch = text.charAt(at);
        at += 1;
        return ch;
    },

    number = function () {
        // Parse a number value.
        var number,
            string = '';

        if (ch === '-') {
            string = '-';
            next('-');
        }
        while (ch >= '0' && ch <= '9') {
            string += ch;
            next();
        }
        if (ch === '.') {
            string += '.';
            while (next() && ch >= '0' && ch <= '9') {
                string += ch;
            }
        }
        if (ch === 'e' || ch === 'E') {
            string += ch;
            next();
            if (ch === '-' || ch === '+') {
                string += ch;
                next();
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
        }
        number = +string;
        if (!isFinite(number)) {
            error("Bad number");
        } else {
            return number;
        }
    },

    string = function () {
        // Parse a string value.
        var hex,
            i,
            string = '',
            uffff;

        // When parsing for string values, we must look for " and \ characters.
        if (ch === '"') {
            while (next()) {
                if (ch === '"') {
                    next();
                    return string;
                } else if (ch === '\\') {
                    next();
                    if (ch === 'u') {
                        uffff = 0;
                        for (i = 0; i < 4; i += 1) {
                            hex = parseInt(next(), 16);
                            if (!isFinite(hex)) {
                                break;
                            }
                            uffff = uffff * 16 + hex;
                        }
                        string += String.fromCharCode(uffff);
                    } else if (typeof escapee[ch] === 'string') {
                        string += escapee[ch];
                    } else {
                        break;
                    }
                } else {
                    string += ch;
                }
            }
        }
        error("Bad string");
    },

    white = function () {

// Skip whitespace.

        while (ch && ch <= ' ') {
            next();
        }
    },

    word = function () {

// true, false, or null.

        switch (ch) {
        case 't':
            next('t');
            next('r');
            next('u');
            next('e');
            return true;
        case 'f':
            next('f');
            next('a');
            next('l');
            next('s');
            next('e');
            return false;
        case 'n':
            next('n');
            next('u');
            next('l');
            next('l');
            return null;
        }
        error("Unexpected '" + ch + "'");
    },

    value,  // Place holder for the value function.

    array = function () {

// Parse an array value.

        var array = [];

        if (ch === '[') {
            next('[');
            white();
            if (ch === ']') {
                next(']');
                return array;   // empty array
            }
            while (ch) {
                array.push(value());
                white();
                if (ch === ']') {
                    next(']');
                    return array;
                }
                next(',');
                white();
            }
        }
        error("Bad array");
    },

    object = function () {

// Parse an object value.

        var key,
            object = {};

        if (ch === '{') {
            next('{');
            white();
            if (ch === '}') {
                next('}');
                return object;   // empty object
            }
            while (ch) {
                key = string();
                white();
                next(':');
                if (Object.hasOwnProperty.call(object, key)) {
                    error('Duplicate key "' + key + '"');
                }
                object[key] = value();
                white();
                if (ch === '}') {
                    next('}');
                    return object;
                }
                next(',');
                white();
            }
        }
        error("Bad object");
    };

value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

    white();
    switch (ch) {
    case '{':
        return object();
    case '[':
        return array();
    case '"':
        return string();
    case '-':
        return number();
    default:
        return ch >= '0' && ch <= '9' ? number() : word();
    }
};

// Return the json_parse function. It will have access to all of the above
// functions and variables.

module.exports = function (source, reviver) {
    var result;

    text = source;
    at = 0;
    ch = ' ';
    result = value();
    white();
    if (ch) {
        error("Syntax error");
    }

    // If there is a reviver function, we recursively walk the new structure,
    // passing each name/value pair to the reviver function for possible
    // transformation, starting with a temporary root object that holds the result
    // in an empty key. If there is not a reviver function, we simply return the
    // result.

    return typeof reviver === 'function' ? (function walk(holder, key) {
        var k, v, value = holder[key];
        if (value && typeof value === 'object') {
            for (k in value) {
                if (Object.prototype.hasOwnProperty.call(value, k)) {
                    v = walk(value, k);
                    if (v !== undefined) {
                        value[k] = v;
                    } else {
                        delete value[k];
                    }
                }
            }
        }
        return reviver.call(holder, key, value);
    }({'': result}, '')) : result;
};
});

require.define("/node_modules/jsonify/lib/stringify.js",function(require,module,exports,__dirname,__filename,process){var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
    gap,
    indent,
    meta = {    // table of character substitutions
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    },
    rep;

function quote(string) {
    // If the string contains no control characters, no quote characters, and no
    // backslash characters, then we can safely slap some quotes around it.
    // Otherwise we must also replace the offending characters with safe escape
    // sequences.

    escapable.lastIndex = 0;
    return escapable.test(string) ? '"' + string.replace(escapable, function (a) {
        var c = meta[a];
        return typeof c === 'string' ? c :
            '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
    }) + '"' : '"' + string + '"';
}

function str(key, holder) {
    // Produce a string from holder[key].
    var i,          // The loop counter.
        k,          // The member key.
        v,          // The member value.
        length,
        mind = gap,
        partial,
        value = holder[key];

    // If the value has a toJSON method, call it to obtain a replacement value.
    if (value && typeof value === 'object' &&
            typeof value.toJSON === 'function') {
        value = value.toJSON(key);
    }

    // If we were called with a replacer function, then call the replacer to
    // obtain a replacement value.
    if (typeof rep === 'function') {
        value = rep.call(holder, key, value);
    }

    // What happens next depends on the value's type.
    switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':
            // JSON numbers must be finite. Encode non-finite numbers as null.
            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':
            // If the value is a boolean or null, convert it to a string. Note:
            // typeof null does not produce 'null'. The case is included here in
            // the remote chance that this gets fixed someday.
            return String(value);

        case 'object':
            if (!value) return 'null';
            gap += indent;
            partial = [];

            // Array.isArray
            if (Object.prototype.toString.apply(value) === '[object Array]') {
                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

                // Join all of the elements together, separated with commas, and
                // wrap them in brackets.
                v = partial.length === 0 ? '[]' : gap ?
                    '[\n' + gap + partial.join(',\n' + gap) + '\n' + mind + ']' :
                    '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

            // If the replacer is an array, use it to select the members to be
            // stringified.
            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }
            else {
                // Otherwise, iterate through all of the keys in the object.
                for (k in value) {
                    if (Object.prototype.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

        // Join all of the member texts together, separated with commas,
        // and wrap them in braces.

        v = partial.length === 0 ? '{}' : gap ?
            '{\n' + gap + partial.join(',\n' + gap) + '\n' + mind + '}' :
            '{' + partial.join(',') + '}';
        gap = mind;
        return v;
    }
}

module.exports = function (value, replacer, space) {
    var i;
    gap = '';
    indent = '';

    // If the space parameter is a number, make an indent string containing that
    // many spaces.
    if (typeof space === 'number') {
        for (i = 0; i < space; i += 1) {
            indent += ' ';
        }
    }
    // If the space parameter is a string, it will be used as the indent string.
    else if (typeof space === 'string') {
        indent = space;
    }

    // If there is a replacer, it must be a function or an array.
    // Otherwise, throw an error.
    rep = replacer;
    if (replacer && typeof replacer !== 'function'
    && (typeof replacer !== 'object' || typeof replacer.length !== 'number')) {
        throw new Error('JSON.stringify');
    }

    // Make a fake root object containing our value under the key of ''.
    // Return the result of stringifying the value.
    return str('', {'': value});
};
});

require.define("/node_modules_koding/bongo-client/src/scrubber.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  var BongoScrubber, Scrubber,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
    __slice = [].slice;

  Scrubber = require('koding-dnode-protocol').Scrubber;

  module.exports = BongoScrubber = (function(_super) {
    var compensateForLatency, createFailHandler, error, noop;

    __extends(BongoScrubber, _super);

    noop = function() {};

    error = function(message) {
      throw new Error(message);
    };

    createFailHandler = function(fn) {
      return function() {
        var err, rest;
        rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
        err = rest[0];
        if (err != null) {
          return fn.apply(null, rest);
        }
      };
    };

    compensateForLatency = function(cursor) {
      var hasFailMethod, hasFinalizeMethod, node;
      node = cursor.node;
      if (node && 'object' === typeof node && 'compensate' in node) {
        node.compensate();
        hasFailMethod = 'fail' in node;
        hasFinalizeMethod = 'finalize' in node;
        if (hasFinalizeMethod && hasFailMethod) {
          error('Provide a handler only for finalize, or fail, not both');
        }
        if (hasFailMethod) {
          return cursor.update(createFailHandler(node.fail));
        } else if (hasFinalizeMethod) {
          return cursor.update(node.finalize);
        } else {
          return cursor.update(noop);
        }
      }
    };

    function BongoScrubber() {
      BongoScrubber.__super__.constructor.apply(this, arguments);
      this.unshift(compensateForLatency);
    }

    return BongoScrubber;

  })(Scrubber);

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/model.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var EventEmitter, Model,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('microemitter').EventEmitter;

  module.exports = Model = (function(_super) {
    var EventMultiplexer, JsPath, MongoOp, createId, extend;

    __extends(Model, _super);

    function Model() {
      return Model.__super__.constructor.apply(this, arguments);
    }

    MongoOp = require('mongoop');

    JsPath = require('jspath');

    EventMultiplexer = require('./eventmultiplexer');

    createId = Model.createId = require('hat');

    extend = require('./util').extend;

    Model.isOpaque = function() {
      return false;
    };

    Model.streamModels = function(selector, options, callback) {
      var ids;
      if (!('each' in this)) {
        throw new Error("streamModels depends on Model#each, but cursor was not found!\n(Hint: it may not be whitelisted)");
      }
      ids = [];
      return this.each(selector, options, function(err, model) {
        if (err) {
          return callback(err);
        } else if (model != null) {
          ids.push(typeof model.getId === "function" ? model.getId() : void 0);
          return callback(err, [model]);
        } else {
          return callback(null, null, ids);
        }
      });
    };

    Model.prototype.mixin = Model.mixin = function(source) {
      var key, val, _results;
      _results = [];
      for (key in source) {
        val = source[key];
        if (key !== 'constructor') {
          _results.push(this[key] = val);
        }
      }
      return _results;
    };

    Model.prototype.watch = function(field, watcher) {
      var _base;
      (_base = this.watchers)[field] || (_base[field] = []);
      return this.watchers[field].push(watcher);
    };

    Model.prototype.unwatch = function(field, watcher) {
      var index;
      if (!watcher) {
        return delete this.watchers[field];
      } else {
        index = this.watchers.indexOf(watcher);
        if (~index) {
          return this.watchers.splice(index, 1);
        }
      }
    };

    Model.prototype.init = function(data) {
      var model,
        _this = this;
      model = this;
      model.watchers = {};
      model.bongo_ || (model.bongo_ = {});
      if (data != null) {
        model.set(data);
      }
      if (!('instanceId' in model.bongo_)) {
        model.bongo_.instanceId = createId();
      }
      this.emit('init');
      return this.on('updateInstance', function(data) {
        return _this.update_(data);
      });
    };

    Model.prototype.set = function(data) {
      var model;
      if (data == null) {
        data = {};
      }
      model = this;
      delete data.data;
      extend(model, data);
      return model;
    };

    Model.prototype.getFlagValue = function(flagName) {
      var _ref;
      return (_ref = this.flags_) != null ? _ref[flagName] : void 0;
    };

    Model.prototype.watchFlagValue = function(flagName, callback) {
      return this.watch("flags_." + flagName, callback);
    };

    Model.prototype.unwatchFlagValue = function(flagName) {
      return this.unwatch("flags_." + flagName);
    };

    Model.prototype.getAt = function(path) {
      return JsPath.getAt(this, path);
    };

    Model.prototype.setAt = function(path, value) {
      return JsPath.setAt(this, path, value);
    };

    Model.prototype.getId = function() {
      return this._id;
    };

    Model.prototype.getSubscribable = function() {
      var subscribable;
      subscribable = this.bongo_.subscribable;
      if (subscribable != null) {
        return subscribable;
      }
      return true;
    };

    Model.prototype.equals = function(model) {
      if (this.getId && (model != null ? model.getId : void 0)) {
        return this.getId() === model.getId();
      } else {
        return this === model;
      }
    };

    Model.prototype.valueOf = function() {
      var _ref;
      return (_ref = typeof this.getValue === "function" ? this.getValue() : void 0) != null ? _ref : this;
    };

    Model.prototype.save = function(callback) {
      var model;
      model = this;
      return model.save_(function(err, docs) {
        if (err) {
          return callback(err);
        } else {
          extend(model, docs[0]);
          bongo.addReferences(model);
          return callback(null, docs);
        }
      });
    };

    Model.prototype.update_ = function(data) {
      var fields,
        _this = this;
      fields = new MongoOp(data).applyTo(this);
      Object.keys(fields).forEach(function(field) {
        var _ref;
        return (_ref = _this.watchers[field]) != null ? _ref.forEach(function(watcher) {
          return watcher.call(_this, fields[field]);
        }) : void 0;
      });
      return this.emit('update');
    };

    Model.prototype.addListener = Model.prototype.on;

    Model.prototype.removeListener = Model.prototype.off;

    return Model;

  })(EventEmitter);

}).call(this);
});

require.define("/node_modules/mongoop/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/mongoop/index.js",function(require,module,exports,__dirname,__filename,process){(function() {
  var MongoOp,
    __slice = [].slice;

  MongoOp = (function() {
    var JsPath, deleteAt, getAt, isEqual, keys, popAt, pushAt, setAt, _;

    if ((typeof require !== "undefined" && require !== null) && (typeof module !== "undefined" && module !== null)) {
      if (typeof JsPath === "undefined" || JsPath === null) {
        JsPath = require('jspath');
      }
      if (typeof _ === "undefined" || _ === null) {
        _ = require('underscore');
      }
    } else {
      _ = window._, JsPath = window.JsPath;
    }

    isEqual = _.isEqual;

    setAt = JsPath.setAt, getAt = JsPath.getAt, deleteAt = JsPath.deleteAt, pushAt = JsPath.pushAt, popAt = JsPath.popAt;

    keys = Object.keys;

    function MongoOp(operation) {
      if (!(this instanceof MongoOp)) {
        return new MongoOp(operation);
      }
      this.operation = operation;
    }

    MongoOp.prototype.applyTo = function(target) {
      var _this = this;
      this.result = {};
      keys(this.operation).forEach(function(operator) {
        if ('function' !== typeof _this[operator]) {
          throw new Error("Unrecognized operator: " + operator);
        } else {
          return _this[operator](target, _this.operation[operator]);
        }
      });
      return this;
    };

    MongoOp.prototype.forEachField = function(fields, fn) {
      var _this = this;
      return keys(fields).map(function(path) {
        var val;
        val = fields[path];
        return _this.result[path] = fn(path, val);
      });
    };

    MongoOp.prototype.$addToSet = (function() {
      var $addToSet;
      $addToSet = function(collection, val) {
        var item, matchFound, _i, _len;
        matchFound = false;
        for (_i = 0, _len = collection.length; _i < _len; _i++) {
          item = collection[_i];
          if (!(isEqual(item, val))) {
            continue;
          }
          matchFound = true;
          break;
        }
        if (!matchFound) {
          return collection.push(val);
        }
      };
      return function(target, fields) {
        var _this = this;
        return this.forEachField(fields, function(path, val) {
          var child, collection, _i, _len, _ref, _results;
          collection = getAt(target, path);
          if (collection == null) {
            collection = [];
            setAt(target, path, collection);
          }
          if (val.$each != null) {
            _ref = val.$each;
            _results = [];
            for (_i = 0, _len = _ref.length; _i < _len; _i++) {
              child = _ref[_i];
              _results.push($addToSet(collection, child));
            }
            return _results;
          } else {
            return $addToSet(collection, val);
          }
        });
      };
    })();

    MongoOp.prototype.$push = function(target, fields) {
      return this.forEachField(fields, function(path, val) {
        return pushAt(target, path, val);
      });
    };

    MongoOp.prototype.$pushAll = function(target, fields) {
      return this.forEachField(fields, function(path, vals) {
        return pushAt.apply(null, [target, path].concat(__slice.call(vals)));
      });
    };

    MongoOp.prototype.$pull = function() {
      throw new Error("This version of MongoOp does not implement $pull...\nLook for that in a future version.  You can use $pullAll instead.");
    };

    MongoOp.prototype.$pullAll = function(target, fields) {
      return this.forEachField(fields, function(path, val) {
        var collection, i, index, _results;
        collection = getAt(target, path);
        index = 0;
        _results = [];
        while (collection && index < collection.length) {
          i = index++;
          if (isEqual(collection[i], val)) {
            _results.push(collection.splice(i, 1));
          } else {
            _results.push(void 0);
          }
        }
        return _results;
      });
    };

    MongoOp.prototype.$pop = function(target, fields) {
      return this.forEachField(fields, function(path) {
        return popAt(target, path);
      });
    };

    MongoOp.prototype.$set = function(target, fields) {
      return this.forEachField(fields, function(path, val) {
        setAt(target, path, val);
        return val;
      });
    };

    MongoOp.prototype.$unset = function(target, fields) {
      return this.forEachField(fields, function(path) {
        return deleteAt(target, path);
      });
    };

    MongoOp.prototype.$rename = function(target, fields) {
      return this.forEachField(fields, function(oldPath, newPath) {
        var val;
        val = getAt(target, oldPath);
        deleteAt(target, oldPath);
        return setAt(target, newPath, val);
      });
    };

    MongoOp.prototype.$inc = (function() {
      var $inc;
      $inc = function(val, amt) {
        return val += amt;
      };
      return function(target, fields) {
        return this.forEachField(fields, function(path, val) {
          return setAt(target, path, $inc(getAt(target, path), val));
        });
      };
    })();

    return MongoOp;

  })();

  if ((typeof module !== "undefined" && module !== null ? module.exports : void 0) != null) {
    module.exports = MongoOp;
  } else if (typeof window !== "undefined" && window !== null) {
    window['MongoOp'] = MongoOp;
  }

}).call(this);
});

require.define("/node_modules/underscore/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"underscore.js"}});

require.define("/node_modules/underscore/underscore.js",function(require,module,exports,__dirname,__filename,process){//     Underscore.js 1.2.3
//     (c) 2009-2011 Jeremy Ashkenas, DocumentCloud Inc.
//     Underscore is freely distributable under the MIT license.
//     Portions of Underscore are inspired or borrowed from Prototype,
//     Oliver Steele's Functional, and John Resig's Micro-Templating.
//     For all details and documentation:
//     http://documentcloud.github.com/underscore

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `global` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var slice            = ArrayProto.slice,
      concat           = ArrayProto.concat,
      unshift          = ArrayProto.unshift,
      toString         = ObjProto.toString,
      hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) { return new wrapper(obj); };

  // Export the Underscore object for **Node.js** and **"CommonJS"**, with
  // backwards-compatibility for the old `require()` API. If we're not in
  // CommonJS, add `_` to the global object.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else if (typeof define === 'function' && define.amd) {
    // Register as a named module with AMD.
    define('underscore', function() {
      return _;
    });
  } else {
    // Exported as a string, for Closure Compiler "advanced" mode.
    root['_'] = _;
  }

  // Current version.
  _.VERSION = '1.2.3';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, l = obj.length; i < l; i++) {
        if (i in obj && iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      for (var key in obj) {
        if (hasOwnProperty.call(obj, key)) {
          if (iterator.call(context, obj[key], key, obj) === breaker) return;
        }
      }
    }
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results[results.length] = iterator.call(context, value, index, list);
    });
    return results;
  };

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError('Reduce of empty array with no initial value');
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var reversed = _.toArray(obj).reverse();
    if (context && !initial) iterator = _.bind(iterator, context);
    return initial ? _.reduce(reversed, iterator, memo, context) : _.reduce(reversed, iterator);
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, iterator, context) {
    var result;
    any(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(iterator, context);
    each(obj, function(value, index, list) {
      if (iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    each(obj, function(value, index, list) {
      if (!iterator.call(context, value, index, list)) results[results.length] = value;
    });
    return results;
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, iterator, context) {
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(iterator, context);
    each(obj, function(value, index, list) {
      if (!(result = result && iterator.call(context, value, index, list))) return breaker;
    });
    return result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, iterator, context) {
    iterator || (iterator = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(iterator, context);
    each(obj, function(value, index, list) {
      if (result || (result = iterator.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if a given value is included in the array or object using `===`.
  // Aliased as `contains`.
  _.include = _.contains = function(obj, target) {
    var found = false;
    if (obj == null) return found;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    found = any(obj, function(value) {
      return value === target;
    });
    return found;
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    return _.map(obj, function(value) {
      return (method.call ? method || value : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, function(value){ return value[key]; });
  };

  // Return the maximum element or (element-based computation).
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.max.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return -Infinity;
    var result = {computed : -Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed >= result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj)) return Math.min.apply(Math, obj);
    if (!iterator && _.isEmpty(obj)) return Infinity;
    var result = {computed : Infinity};
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      computed < result.computed && (result = {value : value, computed : computed});
    });
    return result.value;
  };

  // Shuffle an array.
  _.shuffle = function(obj) {
    var shuffled = [], rand;
    each(obj, function(value, index, list) {
      if (index == 0) {
        shuffled[0] = value;
      } else {
        rand = Math.floor(Math.random() * (index + 1));
        shuffled[index] = shuffled[rand];
        shuffled[rand] = value;
      }
    });
    return shuffled;
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value : value,
        criteria : iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria, b = right.criteria;
      return a < b ? -1 : a > b ? 1 : 0;
    }), 'value');
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = function(obj, val) {
    var result = {};
    var iterator = _.isFunction(val) ? val : function(obj) { return obj[val]; };
    each(obj, function(value, index) {
      var key = iterator(value, index);
      (result[key] || (result[key] = [])).push(value);
    });
    return result;
  };

  // Use a comparator function to figure out at what index an object should
  // be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator) {
    iterator || (iterator = _.identity);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >> 1;
      iterator(array[mid]) < iterator(obj) ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely convert anything iterable into a real, live array.
  _.toArray = function(iterable) {
    if (!iterable)                return [];
    if (iterable.toArray)         return iterable.toArray();
    if (_.isArray(iterable))      return slice.call(iterable);
    if (_.isArguments(iterable))  return slice.call(iterable);
    return _.values(iterable);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    return _.toArray(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head`. The **guard** check allows it to work
  // with `_.map`.
  _.first = _.head = function(array, n, guard) {
    return (n != null) && !guard ? slice.call(array, 0, n) : array[0];
  };

  // Returns everything but the last entry of the array. Especcialy useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if ((n != null) && !guard) {
      return slice.call(array, Math.max(array.length - n, 0));
    } else {
      return array[array.length - 1];
    }
  };

  // Returns everything but the first entry of the array. Aliased as `tail`.
  // Especially useful on the arguments object. Passing an **index** will return
  // the rest of the values in the array from that index onward. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = function(array, index, guard) {
    return slice.call(array, (index == null) || guard ? 1 : index);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, function(value){ return !!value; });
  };

  // Return a completely flattened version of an array.
  _.flatten = function(array, shallow) {
    return _.reduce(array, function(memo, value) {
      if (_.isArray(value)) return memo.concat(shallow ? value : _.flatten(value));
      memo[memo.length] = value;
      return memo;
    }, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator) {
    var initial = iterator ? _.map(array, iterator) : array;
    var result = [];
    _.reduce(initial, function(memo, el, i) {
      if (0 == i || (isSorted === true ? _.last(memo) != el : !_.include(memo, el))) {
        memo[memo.length] = el;
        result[result.length] = array[i];
      }
      return memo;
    }, []);
    return result;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays. (Aliased as "intersect" for back-compat.)
  _.intersection = _.intersect = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.indexOf(other, item) >= 0;
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = _.flatten(slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.include(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var args = slice.call(arguments);
    var length = _.max(_.pluck(args, 'length'));
    var results = new Array(length);
    for (var i = 0; i < length; i++) results[i] = _.pluck(args, "" + i);
    return results;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i, l;
    if (isSorted) {
      i = _.sortedIndex(array, item);
      return array[i] === item ? i : -1;
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item);
    for (i = 0, l = array.length; i < l; i++) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item) {
    if (array == null) return -1;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) return array.lastIndexOf(item);
    var i = array.length;
    while (i--) if (i in array && array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var len = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(len);

    while(idx < len) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Binding with arguments is also known as `curry`.
  // Delegates to **ECMAScript 5**'s native `Function.bind` if available.
  // We check for `func.bind` first, to fail fast when `func` is undefined.
  _.bind = function bind(func, context) {
    var bound, args;
    if (func.bind === nativeBind && nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Bind all of an object's methods to that object. Useful for ensuring that
  // all callbacks defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length == 0) funcs = _.functions(obj);
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return hasOwnProperty.call(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(func, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time.
  _.throttle = function(func, wait) {
    var context, args, timeout, throttling, more;
    var whenDone = _.debounce(function(){ more = throttling = false; }, wait);
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) func.apply(context, args);
        whenDone();
      };
      if (!timeout) timeout = setTimeout(later, wait);
      if (throttling) {
        more = true;
      } else {
        func.apply(context, args);
      }
      whenDone();
      throttling = true;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds.
  _.debounce = function(func, wait) {
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        func.apply(context, args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      return memo = func.apply(this, arguments);
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return function() {
      var args = concat.apply([func], arguments);
      return wrapper.apply(this, args);
    };
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    if (times <= 0) return func();
    return function() {
      if (--times < 1) { return func.apply(this, arguments); }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = nativeKeys || function(obj) {
    if (obj !== Object(obj)) throw new TypeError('Invalid object');
    var keys = [];
    for (var key in obj) if (hasOwnProperty.call(obj, key)) keys[keys.length] = key;
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    return _.map(obj, _.identity);
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (source[prop] !== void 0) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      for (var prop in source) {
        if (obj[prop] == null) obj[prop] = source[prop];
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function.
  function eq(a, b, stack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the Harmony `egal` proposal: http://wiki.ecmascript.org/doku.php?id=harmony:egal.
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a._chain) a = a._wrapped;
    if (b._chain) b = b._wrapped;
    // Invoke a custom `isEqual` method if one is provided.
    if (a.isEqual && _.isFunction(a.isEqual)) return a.isEqual(b);
    if (b.isEqual && _.isFunction(b.isEqual)) return b.isEqual(a);
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = stack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (stack[length] == a) return true;
    }
    // Add the first object to the stack of traversed objects.
    stack.push(a);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          // Ensure commutative equality for sparse arrays.
          if (!(result = size in a == size in b && eq(a[size], b[size], stack))) break;
        }
      }
    } else {
      // Objects with different constructors are not equivalent.
      if ('constructor' in a != 'constructor' in b || a.constructor != b.constructor) return false;
      // Deep compare objects.
      for (var key in a) {
        if (hasOwnProperty.call(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = hasOwnProperty.call(b, key) && eq(a[key], b[key], stack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (hasOwnProperty.call(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    stack.pop();
    return result;
  }

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (hasOwnProperty.call(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType == 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Is a given variable an arguments object?
  _.isArguments = function(obj) {
    return toString.call(obj) == '[object Arguments]';
  };
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && hasOwnProperty.call(obj, 'callee'));
    };
  }

  // Is a given value a function?
  _.isFunction = function(obj) {
    return toString.call(obj) == '[object Function]';
  };

  // Is a given value a string?
  _.isString = function(obj) {
    return toString.call(obj) == '[object String]';
  };

  // Is a given value a number?
  _.isNumber = function(obj) {
    return toString.call(obj) == '[object Number]';
  };

  // Is the given value `NaN`?
  _.isNaN = function(obj) {
    // `NaN` is the only value for which `===` is not reflexive.
    return obj !== obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value a date?
  _.isDate = function(obj) {
    return toString.call(obj) == '[object Date]';
  };

  // Is the given value a regular expression?
  _.isRegExp = function(obj) {
    return toString.call(obj) == '[object RegExp]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  // Run a function **n** times.
  _.times = function (n, iterator, context) {
    for (var i = 0; i < n; i++) iterator.call(context, i);
  };

  // Escape a string for HTML interpolation.
  _.escape = function(string) {
    return (''+string).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/\//g,'&#x2F;');
  };

  // Add your own custom functions to the Underscore object, ensuring that
  // they're correctly added to the OOP wrapper as well.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name){
      addToWrapper(name, _[name] = obj[name]);
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = idCounter++;
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(str, data) {
    var c  = _.templateSettings;
    var tmpl = 'var __p=[],print=function(){__p.push.apply(__p,arguments);};' +
      'with(obj||{}){__p.push(\'' +
      str.replace(/\\/g, '\\\\')
         .replace(/'/g, "\\'")
         .replace(c.escape, function(match, code) {
           return "',_.escape(" + code.replace(/\\'/g, "'") + "),'";
         })
         .replace(c.interpolate, function(match, code) {
           return "'," + code.replace(/\\'/g, "'") + ",'";
         })
         .replace(c.evaluate || null, function(match, code) {
           return "');" + code.replace(/\\'/g, "'")
                              .replace(/[\r\n\t]/g, ' ') + ";__p.push('";
         })
         .replace(/\r/g, '\\r')
         .replace(/\n/g, '\\n')
         .replace(/\t/g, '\\t')
         + "');}return __p.join('');";
    var func = new Function('obj', '_', tmpl);
    if (data) return func(data, _);
    return function(data) {
      return func.call(this, data, _);
    };
  };

  // The OOP Wrapper
  // ---------------

  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.
  var wrapper = function(obj) { this._wrapped = obj; };

  // Expose `wrapper.prototype` as `_.prototype`
  _.prototype = wrapper.prototype;

  // Helper function to continue chaining intermediate results.
  var result = function(obj, chain) {
    return chain ? _(obj).chain() : obj;
  };

  // A method to easily add functions to the OOP wrapper.
  var addToWrapper = function(name, func) {
    wrapper.prototype[name] = function() {
      var args = slice.call(arguments);
      unshift.call(args, this._wrapped);
      return result(func.apply(_, args), this._chain);
    };
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      method.apply(this._wrapped, arguments);
      return result(this._wrapped, this._chain);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    wrapper.prototype[name] = function() {
      return result(method.apply(this._wrapped, arguments), this._chain);
    };
  });

  // Start chaining a wrapped Underscore object.
  wrapper.prototype.chain = function() {
    this._chain = true;
    return this;
  };

  // Extracts the result from a wrapped and chained object.
  wrapper.prototype.value = function() {
    return this._wrapped;
  };

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/eventmultiplexer.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var EventMultiplexer, slice;

  slice = [].slice;

  module.exports = EventMultiplexer = (function() {

    function EventMultiplexer(context) {
      this.context = context;
      this.events = {};
    }

    EventMultiplexer.prototype.on = function(event, listener) {
      var isNew, multiplex, multiplexer;
      multiplexer = this;
      multiplex = multiplexer.events[event];
      if (multiplex == null) {
        isNew = true;
        multiplex = multiplexer.events[event] = function() {
          var _i, _len, _ref;
          _ref = multiplex.listeners;
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            listener = _ref[_i];
            listener.apply(multiplexer.context, slice.call(arguments));
          }
        };
        multiplex.listeners = [];
      }
      multiplex.listeners.push(listener);
      if (isNew) {
        return multiplex;
      }
    };

    EventMultiplexer.prototype.off = function(event, listenerToRemove) {
      var index, listener, multiplex, multiplexer, _i, _len, _ref;
      multiplexer = this;
      multiplex = multiplexer.events[event];
      if (!multiplex) {
        return -1;
      } else {
        _ref = multiplex.listeners;
        for (index = _i = 0, _len = _ref.length; _i < _len; index = ++_i) {
          listener = _ref[index];
          if (listener === listenerToRemove) {
            multiplex.listeners.splice(index, 1);
          }
        }
        return multiplex.listeners.length;
      }
    };

    return EventMultiplexer;

  })();

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/util.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var __slice = [].slice;

  module.exports = {
    extend: function() {
      var key, obj, rest, source, val, _i, _len;
      obj = arguments[0], rest = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      for (_i = 0, _len = rest.length; _i < _len; _i++) {
        source = rest[_i];
        for (key in source) {
          val = source[key];
          obj[key] = val;
        }
      }
      return obj;
    },
    asynchronizeOwnMethods: function(ofObject) {
      var result;
      result = {};
      Object.keys(ofObject).forEach(function(key) {
        var fn;
        if ('function' === typeof (fn = ofObject[key])) {
          return result[key] = function() {
            var callback, rest, _i;
            rest = 2 <= arguments.length ? __slice.call(arguments, 0, _i = arguments.length - 1) : (_i = 0, []), callback = arguments[_i++];
            return callback(fn.apply(null, rest));
          };
        }
      });
      return result;
    }
  };

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/listenertree.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var ListenerTree,
    __slice = [].slice;

  module.exports = ListenerTree = (function() {
    var assureAt, getAt, pushAt, _ref;

    _ref = require('jspath'), assureAt = _ref.assureAt, pushAt = _ref.pushAt, getAt = _ref.getAt;

    function ListenerTree() {
      this.tree = Object.create(null);
    }

    ListenerTree.prototype.on = function(routingKey, listener) {
      assureAt(this.tree, routingKey, []);
      pushAt(this.tree, routingKey, listener);
      return this;
    };

    ListenerTree.prototype.off = function(routingKey, listener) {
      console.log('ListenerTree#off is still unimplemented.');
      return this;
    };

    ListenerTree.prototype.emit = function() {
      var listener, listeners, rest, routingKey, _i, _len;
      routingKey = arguments[0], rest = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
      listeners = getAt(this.tree, routingKey);
      if (listeners != null ? listeners.length : void 0) {
        for (_i = 0, _len = listeners.length; _i < _len; _i++) {
          listener = listeners[_i];
          listener.apply(null, rest);
        }
      }
      return this;
    };

    return ListenerTree;

  })();

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/eventbus.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var EventBus;

  module.exports = EventBus = (function() {
    var ListenerTree, getGenericInstanceRoutingKey, getGenericStaticRoutingKey, getInstanceRoutingKey, getStaticRoutingKey;

    ListenerTree = require('./listenertree');

    function EventBus(mq) {
      this.mq = mq;
      this.tree = new ListenerTree;
      this.channels = {};
      this.counts = {};
    }

    EventBus.prototype.bound = require('koding-bound');

    EventBus.prototype.dispatch = function(routingKey, payload) {
      return this.tree.emit(routingKey, payload);
    };

    EventBus.prototype.addListener = function(getGenericRoutingKey, getRoutingKey, name, event, listener) {
      var channel, genericRoutingKey;
      if (this.channels[name] == null) {
        this.counts[name] = 0;
        genericRoutingKey = getGenericRoutingKey(name);
        channel = this.channels[name] = this.mq.subscribe(genericRoutingKey, {
          isReadOnly: true
        });
      } else {
        channel = this.channels[name];
      }
      if (!channel.isListeningTo(event)) {
        channel.on(event, this.dispatch.bind(this, getRoutingKey(name, event)));
      }
      this.counts[name]++;
      return this.tree.on(getRoutingKey(name, event), listener);
    };

    EventBus.prototype.removeListener = function(getRoutingKey, name, event, listener) {
      var channel;
      if (0 === --this.counts[name]) {
        channel = this.channels[name];
        channel.close();
        delete this.channels[name];
      }
      return this.tree.off(getRoutingKey(name, event), listener);
    };

    getStaticRoutingKey = function(constructorName, event) {
      return "constructor." + constructorName + ".event." + event;
    };

    getGenericStaticRoutingKey = function(constructorName) {
      return "constructor." + constructorName + ".event";
    };

    EventBus.prototype.staticOn = function(konstructor, event, listener) {
      return this.addListener(getGenericStaticRoutingKey, getStaticRoutingKey, konstructor.name, event, listener);
    };

    EventBus.prototype.staticOff = function(konstructor, event, listener) {
      return this.removeListener(getStaticRoutingKey, konstructor.name, event, listener);
    };

    getInstanceRoutingKey = function(oid, event) {
      return "oid." + oid + ".event." + event;
    };

    getGenericInstanceRoutingKey = function(oid) {
      return "oid." + oid + ".event";
    };

    EventBus.prototype.on = function(inst, event, listener) {
      if (inst.getSubscribable()) {
        return this.addListener(getGenericInstanceRoutingKey, getInstanceRoutingKey, inst.getId(), event, listener);
      }
    };

    EventBus.prototype.off = function(inst, event, listener) {
      return this.removeListener(getInstanceRoutingKey, inst.getId(), event, listener);
    };

    return EventBus;

  })();

}).call(this);
});

require.define("/node_modules/koding-bound/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"index.js"}});

require.define("/node_modules/koding-bound/index.js",function(require,module,exports,__dirname,__filename,process){module.exports = require('./lib/koding-bound');});

require.define("/node_modules/koding-bound/lib/koding-bound/index.js",function(require,module,exports,__dirname,__filename,process){var __slice = [].slice;

module.exports = function() {
  var boundMethod, method, rest, _ref;

  method = arguments[0], rest = 2 <= arguments.length ? __slice.call(arguments, 1) : [];
  if (this[method] == null) {
    throw new Error("Unknown method! " + method);
  }
  boundMethod = "__bound__" + method;
  boundMethod in this || Object.defineProperty(this, boundMethod, {
    value: (_ref = this[method]).bind.apply(_ref, [this].concat(__slice.call(rest)))
  });
  return this[boundMethod];
};
});

require.define("/node_modules_koding/bongo-client/src/opaquetype.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  var OpaqueType,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  module.exports = OpaqueType = (function() {

    function OpaqueType(type) {
      var konstructor;
      konstructor = Function("return function " + type + "() {}")();
      __extends(konstructor, OpaqueType);
      return konstructor;
    }

    OpaqueType.isOpaque = function() {
      return true;
    };

    return OpaqueType;

  })();

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/eventemitter/broker.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  module.exports = (function() {
    var defineProperty, getPusherEvent;
    getPusherEvent = function(event) {
      if (Array.isArray(event)) {
        return event = event.join(':');
      } else {
        return event;
      }
    };
    defineProperty = Object.defineProperty;
    return {
      destroy: function() {
        if (this.channel == null) {
          return;
        }
        return this.mq.unsubscribe(this.channel);
      },
      removeListener: function(event, listener) {
        this.emit('listenerRemoved', event, listener);
        return this.constructor.prototype.removeListener.call(event, listener);
      }
    };
  })();

}).call(this);
});

require.define("/node_modules/sinkrow/package.json",function(require,module,exports,__dirname,__filename,process){module.exports = {"main":"lib/sinkrow/index.js"}});

require.define("/node_modules/sinkrow/lib/sinkrow/index.js",function(require,module,exports,__dirname,__filename,process){this.sequence = require('./sequence');

this.race = require('./race');

this.future = require('./future');

this.daisy = function(args) {
  process.nextTick(args.next = function() {
    var fn;

    if (fn = args.shift()) {
      return !!fn(args) || true;
    } else {
      return false;
    }
  });
  return args.next;
};

this.dash = function(args, cb) {
  var arg, count, length, _i, _len, _ref;

  if ('function' === typeof args) {
    _ref = [args, cb], cb = _ref[0], args = _ref[1];
  }
  length = args.length;
  if (length === 0) {
    process.nextTick(cb);
  } else {
    count = 0;
    args.fin = function() {
      if (++count === length) {
        return !!cb() || true;
      } else {
        return false;
      }
    };
    for (_i = 0, _len = args.length; _i < _len; _i++) {
      arg = args[_i];
      process.nextTick(arg);
    }
  }
  return args.fin;
};
});

require.define("/node_modules/sinkrow/lib/sinkrow/sequence.js",function(require,module,exports,__dirname,__filename,process){var Sequence, slice;

Sequence = (function() {
  function Sequence(fn, cb) {
    this.fn = fn;
    this.cb = cb;
    this.times = 0;
    this.args = [];
  }

  Sequence.prototype.next = function(args) {
    var nextArgs, nextFn;

    if (!(nextArgs = this.args.shift())) {
      nextFn = this.cb;
    } else {
      nextFn = this.next.bind(this, nextArgs);
    }
    if (this.times--) {
      return this.fn.apply(this, args.concat(nextFn));
    }
  };

  Sequence.prototype.add = function(args) {
    if (!this.times++) {
      return process.nextTick(this.next.bind(this, args));
    } else {
      return this.args.push(args);
    }
  };

  return Sequence;

})();

slice = [].slice;

module.exports = function(fn, cb) {
  var sequence;

  sequence = new Sequence(fn, cb);
  return function() {
    return sequence.add(slice.call(arguments));
  };
};
});

require.define("/node_modules/sinkrow/lib/sinkrow/race.js",function(require,module,exports,__dirname,__filename,process){var Race,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; },
  __slice = [].slice;

Race = (function() {
  function Race(fn, cb) {
    this.fn = fn;
    this.cb = cb;
    this.fin = __bind(this.fin, this);
    this.times = 0;
    this.finTimes = 0;
  }

  Race.prototype.fin = function() {
    if (this.times === ++this.finTimes) {
      return typeof this.cb === "function" ? this.cb.apply(this, arguments) : void 0;
    }
  };

  Race.prototype.add = function(args) {
    var i;

    i = this.times++;
    return this.fn.apply(this, [i].concat(args.concat(this.fin)));
  };

  return Race;

})();

module.exports = function(fn, cb) {
  var race;

  race = new Race(fn, cb);
  return function() {
    var args;

    args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
    return race.add(args);
  };
};
});

require.define("/node_modules/sinkrow/lib/sinkrow/future.js",function(require,module,exports,__dirname,__filename,process){var initializeFuture,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

module.exports = function(context) {
  var Future;

  if ('function' === typeof context) {
    if (context.name) {
      return Future = (function(_super) {
        __extends(Future, _super);

        Future.queue || (Future.queue = []);

        function Future() {
          this.queue = [];
          Future.__super__.constructor.apply(this, arguments);
        }

        initializeFuture.call(Future);

        return Future;

      })(context);
    } else {
      context.isFuture = true;
      return context;
    }
  }
};

initializeFuture = (function() {
  var Pipeline, andThen, filter, isFuture, method, methods, next, originalMethods, replaceMethods, slice, _ref;

  _ref = require('underscore'), filter = _ref.filter, methods = _ref.methods;
  slice = [].slice;
  Pipeline = require('./pipeline');
  originalMethods = {};
  method = function(context, methodName) {
    originalMethods[methodName] = context[methodName];
    return function() {
      this.queue.push({
        context: context,
        methodName: methodName,
        args: slice.call(arguments)
      });
      return this;
    };
  };
  next = function(pipeline, err) {
    var args, context, e, methodName, queued;

    if (err != null) {
      return pipeline.callback.call(this, err);
    } else {
      queued = pipeline.queue.shift();
      if (queued != null) {
        methodName = queued.methodName, context = queued.context, args = queued.args;
        args.unshift(pipeline);
        args.push(next.bind(this, pipeline));
        try {
          return originalMethods[methodName].apply(originalMethods, args);
        } catch (_error) {
          e = _error;
          return pipeline.callback.call(this, e, pipeline);
        }
      } else {
        return pipeline.callback.call(this, null, pipeline);
      }
    }
  };
  andThen = function(callback) {
    var pipeline;

    pipeline = new Pipeline([], this.queue, callback);
    if (pipeline.queue.length) {
      next.call(this, pipeline);
    }
    this.queue = [];
    return this;
  };
  isFuture = function(methodName) {
    return this[methodName].isFuture;
  };
  replaceMethods = function() {
    var methodName, _i, _len, _ref1;

    _ref1 = filter(methods(this), isFuture.bind(this));
    for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
      methodName = _ref1[_i];
      this[methodName] = method(this, methodName);
    }
    return this.then = andThen;
  };
  return function() {
    replaceMethods.call(this);
    return replaceMethods.call(this.prototype);
  };
})();
});

require.define("/node_modules/sinkrow/lib/sinkrow/pipeline.js",function(require,module,exports,__dirname,__filename,process){var Pipeline, underscore,
  __slice = [].slice;

underscore = require('underscore');

module.exports = Pipeline = (function() {
  var empty, method, _i, _j, _len, _len1, _ref, _ref1;

  empty = [];

  _ref = 'forEach,indexOf,join,pop,reverse,shift,sort,splice,unshift,push'.split(',');
  for (_i = 0, _len = _ref.length; _i < _len; _i++) {
    method = _ref[_i];
    Pipeline.prototype[method] = empty[method];
  }

  _ref1 = ('first,initial,last,rest,compact,flatten,without,union,' + 'intersection,difference,uniq,zip,lastIndexOf,range').split(',');
  for (_j = 0, _len1 = _ref1.length; _j < _len1; _j++) {
    method = _ref1[_j];
    Pipeline.prototype[method] = (function(method) {
      return function() {
        return underscore[method].apply(underscore, [this].concat(__slice.call(arguments)));
      };
    })(method);
  }

  function Pipeline(pipeline, queue, callback) {
    this.queue = queue;
    this.length = 0;
    if (pipeline.length) {
      this.push.apply(this, [].slice.call(pipeline));
    }
    Object.defineProperty(this, 'callback', {
      value: callback
    });
  }

  Pipeline.prototype.root = function() {
    var _ref2, _ref3;

    return (_ref2 = this.first()) != null ? (_ref3 = _ref2.nodes) != null ? _ref3[0] : void 0 : void 0;
  };

  return Pipeline;

})();
});

require.define("/node_modules_koding/bongo-client/src/cacheable.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var ModelLoader, dash, getModelLoader, handleBatch, handleByName, handleSingle;

  ModelLoader = require('./modelloader');

  dash = require('sinkrow').dash;

  module.exports = function() {
    switch (arguments.length) {
      case 2:
        return handleBatch.apply(this, arguments);
      case 3:
        return handleSingle.apply(this, arguments);
      default:
        throw new Error('Bongo#cacheable expects either 2 or 3 arguments.');
    }
  };

  getModelLoader = (function() {
    var loading_;
    loading_ = {};
    return function(constructor, id) {
      var loader, _base, _name;
      loading_[_name = constructor.name] || (loading_[_name] = {});
      return loader = (_base = loading_[constructor.name])[id] || (_base[id] = new ModelLoader(constructor, id));
    };
  })();

  handleByName = function(strName, callback) {
    if ('function' === typeof this.fetchName) {
      return this.fetchName(strName, callback);
    } else {
      return callback(new Error('Client must provide an implementation of fetchName!'));
    }
  };

  handleSingle = function(constructorName, _id, callback) {
    var constructor, model;
    constructor = 'string' === typeof constructorName ? this.api[constructorName] : 'function' === typeof constructorName ? constructorName : void 0;
    if (!constructor) {
      callback(new Error("Unknown type " + constructorName));
    } else {
      constructor.cache || (constructor.cache = {});
      if (model = constructor.cache[_id]) {
        callback(null, model);
      } else {
        getModelLoader(constructor, _id).load(function(err, model) {
          constructor.cache[_id] = model;
          return callback(err, model);
        });
      }
    }
  };

  handleBatch = function(batch, callback) {
    var models, queue,
      _this = this;
    if ('string' === typeof batch) {
      return handleByName.call(this, batch, callback);
    }
    models = [];
    queue = batch.map(function(single, i) {
      return function() {
        var constructorName, id, name, type;
        name = single.name, type = single.type, constructorName = single.constructorName, id = single.id;
        return handleSingle.call(_this, type || name || constructorName, id, function(err, model) {
          if (err) {
            return callback(err);
          } else {
            models[i] = model;
            return queue.fin();
          }
        });
      };
    });
    dash(queue, function() {
      return callback(null, models);
    });
  };

}).call(this);
});

require.define("/node_modules_koding/bongo-client/src/modelloader.coffee",function(require,module,exports,__dirname,__filename,process){(function() {
  'use strict';

  var EventEmitter, ModelLoader,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  EventEmitter = require('microemitter').EventEmitter;

  module.exports = ModelLoader = (function(_super) {
    var load_;

    __extends(ModelLoader, _super);

    function ModelLoader(konstructor, _id) {
      this._id = _id;
      this.konstructor = konstructor;
    }

    load_ = function() {
      var _this = this;
      return this.konstructor.one({
        _id: this._id
      }, function(err, model) {
        return _this.emit('load', err, model);
      });
    };

    ModelLoader.prototype.load = function(listener) {
      this.once('load', listener);
      if (!this.isLoading) {
        this.isLoading = true;
        return load_.call(this);
      }
    };

    return ModelLoader;

  })(EventEmitter);

}).call(this);
});

require.define("/node_modules_koding/bongo-client/bongo.js",function(require,module,exports,__dirname,__filename,process){'use strict';
/*
Bongo.js
Unfancy models for MongoDB

(c) 2011 Koding, Inc.

@module: bongo-client
@author: Christopher Thorn <chris@koding.com>
*/

/*
@snippet.
@description: feature-detect the browser.
@todo: is there an improvement?
@foo
*/

var Bongo, EventEmitter, isBrowser,
  __hasProp = {}.hasOwnProperty,
  __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; },
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; },
  __slice = [].slice;

isBrowser = 'undefined' != typeof window;

/*
@class: bongo (client)
@description: client-side bongo.
*/


EventEmitter = require('microemitter').EventEmitter;

Bongo = (function(_super) {
  var CONNECTED, CONNECTING, DISCONNECTED, EventBus, JsPath, Model, NOTCONNECTED, OpaqueType, Scrubber, Store, Traverse, addGlobalListener, createBongoName, createId, dash, extend, getEventChannelName, getRevivingListener, race, sequence, slice, _ref, _ref1, _ref2;

  __extends(Bongo, _super);

  _ref = [0, 1, 2, 3], NOTCONNECTED = _ref[0], CONNECTING = _ref[1], CONNECTED = _ref[2], DISCONNECTED = _ref[3];

  Traverse = require('traverse');

  createId = Bongo.createId = require('hat');

  JsPath = Bongo.JsPath = require('jspath');

  Store = require('koding-dnode-protocol').Store;

  Scrubber = require('./src/scrubber');

  Bongo.dnodeProtocol = {
    Store: Store,
    Scrubber: Scrubber
  };

  Bongo.EventEmitter = EventEmitter;

  Model = Bongo.Model = require('./src/model');

  Bongo.ListenerTree = require('./src/listenertree');

  EventBus = Bongo.EventBus = require('./src/eventbus');

  OpaqueType = require('./src/opaquetype');

  Model.prototype.mixin(require('./src/eventemitter/broker'));

  Model.prototype.off = Model.prototype.removeListener;

  Model.prototype.addGlobalListener = Model.prototype.on;

  slice = [].slice;

  extend = require('./src/util').extend;

  _ref1 = require('sinkrow'), race = _ref1.race, sequence = _ref1.sequence, dash = _ref1.dash;

  _ref2 = require('sinkrow'), Bongo.daisy = _ref2.daisy, Bongo.dash = _ref2.dash, Bongo.sequence = _ref2.sequence, Bongo.race = _ref2.race, Bongo.future = _ref2.future;

  Bongo.bound = require('koding-bound');

  Bongo.prototype.bound = require('koding-bound');

  createBongoName = function(resourceName) {
    return "" + (createId(128)) + ".unknown.bongo-" + resourceName;
  };

  function Bongo(options) {
    var _ref3,
      _this = this;

    EventEmitter(this);
    this.mq = options.mq, this.getSessionToken = options.getSessionToken, this.getUserArea = options.getUserArea, this.fetchName = options.fetchName, this.resourceName = options.resourceName, this.precompiledApi = options.precompiledApi;
    if ((_ref3 = this.getUserArea) == null) {
      this.getUserArea = function() {};
    }
    this.localStore = new Store;
    this.remoteStore = new Store;
    this.readyState = NOTCONNECTED;
    this.stack = [];
    this.eventBus = new EventBus(this.mq);
    this.mq.on('message', this.bound('handleRequestString'));
    this.mq.on('disconnected', this.emit.bind(this, 'disconnected'));
    this.opaqueTypes = {};
    this.on('newListener', function(event, listener) {
      if (event === 'ready' && _this.readyState === CONNECTED) {
        return process.nextTick(function() {
          _this.emit('ready');
          return _this.off('ready');
        });
      }
    });
  }

  Bongo.prototype.cacheable = require('./src/cacheable');

  Bongo.prototype.createRemoteApiShims = function(api) {
    var instance, name, options, shimmedApi, statik, _ref3;

    shimmedApi = {};
    for (name in api) {
      if (!__hasProp.call(api, name)) continue;
      _ref3 = api[name], statik = _ref3.statik, instance = _ref3.instance, options = _ref3.options;
      shimmedApi[name] = this.createConstructor(name, statik, instance, options);
    }
    return shimmedApi;
  };

  Bongo.prototype.wrapStaticMethods = (function() {
    var optimizeThese;

    optimizeThese = ['on', 'off'];
    return function(constructor, constructorName, statik) {
      var bongo;

      bongo = this;
      return statik.forEach(function(method) {
        if (__indexOf.call(optimizeThese, method) >= 0) {
          method += '_';
        }
        return constructor[method] = function() {
          var rest, rpc;

          rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
          rpc = {
            type: 'static',
            constructorName: constructorName,
            method: method
          };
          return bongo.send(rpc, rest);
        };
      });
    };
  })();

  Bongo.prototype.wrapInstanceMethods = (function() {
    var optimizeThese;

    optimizeThese = ['on', 'addListener', 'off', 'removeListener', 'save'];
    return function(constructor, constructorName, instance) {
      var bongo;

      bongo = this;
      return instance.forEach(function(method) {
        if (__indexOf.call(optimizeThese, method) >= 0) {
          method += '_';
        }
        return constructor.prototype[method] = function() {
          var data, id, rpc;

          id = this.getId();
          if (id == null) {
            data = this.data;
          }
          rpc = {
            type: 'instance',
            constructorName: constructorName,
            method: method,
            id: id,
            data: data
          };
          return bongo.send(rpc, [].slice.call(arguments));
        };
      });
    };
  })();

  Bongo.prototype.registerInstance = function(inst) {
    var _this = this;

    inst.on('listenerRemoved', function(event, listener) {
      return _this.eventBus.off(inst, event, listener.bind(inst));
    });
    return inst.on('newListener', function(event, listener) {
      return _this.eventBus.on(inst, event, listener.bind(inst));
    });
  };

  getEventChannelName = function(name) {
    return "event-" + name;
  };

  getRevivingListener = function(bongo, ctx, listener) {
    return function() {
      var rest;

      rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      return listener.apply(ctx, bongo.revive(rest));
    };
  };

  addGlobalListener = function(konstructor, event, listener) {
    var _this = this;

    return this.eventBus.staticOn(konstructor, event, function() {
      var rest, revived;

      rest = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
      revived = _this.revive(rest);
      return listener.apply(konstructor, revived);
    });
  };

  Bongo.prototype.reviveType = function(type, shouldWrap) {
    var revived, _base, _ref3, _ref4, _ref5;

    if (Array.isArray(type)) {
      return this.reviveType(type[0], true);
    }
    if ('string' !== typeof type) {
      return type;
    }
    revived = (_ref3 = (_ref4 = this.api[type]) != null ? _ref4 : window[type]) != null ? _ref3 : (_ref5 = (_base = this.opaqueTypes)[type]) != null ? _ref5 : _base[type] = new OpaqueType(type);
    if (shouldWrap) {
      return [revived];
    } else {
      return revived;
    }
  };

  Bongo.prototype.reviveSchema = (function() {
    var isArray, keys, reviveSchema, reviveSchemaRecursively;

    keys = Object.keys;
    isArray = Array.isArray;
    reviveSchemaRecursively = function(bongo, schema) {
      return (keys(schema)).map(function(slot) {
        var type;

        type = schema[slot];
        if ((type && 'object' == typeof type) && !isArray(type)) {
          type = reviveSchemaRecursively(bongo, type);
        }
        return [slot, type];
      }).reduce(function(acc, _arg) {
        var slot, type;

        slot = _arg[0], type = _arg[1];
        acc[slot] = bongo.reviveType(type);
        return acc;
      }, {});
    };
    return reviveSchema = function(schema) {
      return reviveSchemaRecursively(this, schema);
    };
  })();

  Bongo.prototype.reviveOption = function(option, value) {
    switch (option) {
      case 'schema':
        return this.reviveSchema(value);
      default:
        return value;
    }
  };

  Bongo.prototype.createConstructor = function(name, staticMethods, instanceMethods, options) {
    var konstructor,
      _this = this;

    konstructor = Function('bongo', "return function " + name + " () {\n  bongo.registerInstance(this);\n  this.init.apply(this, [].slice.call(arguments));\n  this.bongo_.constructorName = '" + name + "';\n}")(this);
    EventEmitter(konstructor);
    this.wrapStaticMethods(konstructor, name, staticMethods);
    __extends(konstructor, Model);
    konstructor.prototype.updateInstanceChannel = this.updateInstanceChannel;
    konstructor.on('newListener', addGlobalListener.bind(this, konstructor));
    process.nextTick(function() {
      var option, _results;

      _results = [];
      for (option in options) {
        if (!__hasProp.call(options, option)) continue;
        _results.push(konstructor[option] = _this.reviveOption(option, options[option]));
      }
      return _results;
    });
    this.wrapInstanceMethods(konstructor, name, instanceMethods);
    return konstructor;
  };

  Bongo.prototype.getInstancesById = function() {};

  Bongo.prototype.getInstanceMethods = function() {
    return ['changeLoggedInState', 'updateSessionToken'];
  };

  Bongo.prototype.revive = function(obj) {
    var bongo, hasEncoder;

    bongo = this;
    hasEncoder = (typeof Encoder !== "undefined" && Encoder !== null ? Encoder.XSSEncode : void 0) != null;
    return new Traverse(obj).map(function(node) {
      var constructorName, instance, instanceId, konstructor, _ref3;

      if ((node != null ? node.bongo_ : void 0) != null) {
        _ref3 = node.bongo_, constructorName = _ref3.constructorName, instanceId = _ref3.instanceId;
        instance = bongo.getInstancesById(instanceId);
        if (instance != null) {
          return this.update(instance, true);
        }
        konstructor = bongo.api[node.bongo_.constructorName];
        if (konstructor == null) {
          return this.update(node);
        } else {
          return this.update(new konstructor(node));
        }
      } else if (hasEncoder && 'string' === typeof node) {
        return this.update(Encoder.XSSEncode(node));
      } else {
        return this.update(node);
      }
    });
  };

  Bongo.prototype.reviveFromSnapshots = (function() {
    var snapshotReviver;

    snapshotReviver = function(k, v) {
      if (k === '_events') {
        return;
      }
      return v;
    };
    return function(instances, callback) {
      var results,
        _this = this;

      results = instances.map(function(instance) {
        var e, revivee;

        revivee = null;
        try {
          if (instance.snapshot != null) {
            revivee = JSON.parse(instance.snapshot, snapshotReviver);
          }
        } catch (_error) {
          e = _error;
          console.warn("couldn't revive snapshot! " + instance._id);
          revivee = null;
        }
        if (!revivee) {
          return null;
        }
        return _this.revive(revivee);
      });
      results = results.filter(Boolean);
      return callback(null, results);
    };
  })();

  Bongo.prototype.handleRequestString = function(messageStr) {
    var e;

    return this.handleRequest((function() {
      try {
        return JSON.parse(messageStr);
      } catch (_error) {
        e = _error;
        return messageStr;
      }
    })());
  };

  Bongo.prototype.handleRequest = function(message) {
    var callback, context, method, revived, scrubber, unscrubbed,
      _this = this;

    if ((message != null ? message.method : void 0) === 'defineApi' && (this.api == null)) {
      return this.defineApi(message["arguments"][0]);
    } else if ((message != null ? message.method : void 0) === 'handshakeDone') {
      return this.handshakeDone();
    } else {
      method = message.method, context = message.context;
      scrubber = new Scrubber(this.localStore);
      unscrubbed = scrubber.unscrub(message, function(callbackId) {
        if (!_this.remoteStore.has(callbackId)) {
          _this.remoteStore.add(callbackId, function() {
            var args;

            args = 1 <= arguments.length ? __slice.call(arguments, 0) : [];
            return _this.send(callbackId, args);
          });
        }
        return _this.remoteStore.get(callbackId);
      });
      revived = this.revive(unscrubbed);
      if (__indexOf.call(this.getInstanceMethods(), method) >= 0) {
        return this[method].apply(this, revived);
      } else if (!isNaN(+method)) {
        callback = this.localStore.get(method);
        return callback != null ? callback.apply(null, revived) : void 0;
      } else {
        return console.warn('Unhandleable message; dropping it on the floor.');
      }
    }
  };

  Bongo.prototype.reconnectHelper = function() {
    if (this.api != null) {
      this.readyState = CONNECTED;
      return this.emit('ready');
    }
  };

  Bongo.prototype.connectHelper = function(callback) {
    var _this = this;

    if (callback != null) {
      this.mq.once('connected', callback.bind(this));
    }
    this.channelName = createBongoName(this.resourceName);
    this.channel = this.mq.subscribe(this.channelName);
    this.channel.exchange = this.resourceName;
    this.channel.setAuthenticationInfo({
      serviceType: 'bongo',
      name: this.resourceName,
      clientId: this.getSessionToken()
    });
    this.channel.off('message', this.bound('handleRequest'));
    this.channel.on('message', this.bound('handleRequest'));
    this.reconnectHelper();
    this.channel.once('broker.subscribed', function() {
      return _this.stack.forEach(function(fn) {
        return fn.call(_this);
      });
    });
    return this.channel.on('broker.subscribed', function() {
      return _this.emit('connected');
    });
  };

  Bongo.prototype.connect = function(callback) {
    var _this = this;

    switch (this.readyState) {
      case CONNECTED:
      case CONNECTING:
        return "already connected";
      case DISCONNECTED:
        this.readyState = CONNECTING;
        this.mq.connect(function() {
          return _this.connectHelper(callback);
        });
        break;
      default:
        this.readyState = CONNECTING;
        this.connectHelper(callback);
    }
    if (this.mq.autoReconnect) {
      return this.mq.once('disconnected', function() {
        return _this.mq.on('connected', function() {
          return _this.reconnectHelper();
        });
      });
    }
  };

  Bongo.prototype.disconnect = function(shouldReconnect, callback) {
    if ('function' === typeof shouldReconnect) {
      callback = shouldReconnect;
      shouldReconnect = false;
    }
    if (this.readyState === NOTCONNECTED || this.readyState === DISCONNECTED) {
      return "already disconnected";
    }
    if (callback != null) {
      this.mq.once('disconnected', callback.bind(this));
    }
    this.mq.disconnect(shouldReconnect);
    return this.readyState = DISCONNECTED;
  };

  Bongo.prototype.messageFailed = function(message) {
    return console.log('MESSAGE FAILED', message);
  };

  Bongo.prototype.getTimeout = function(message, clientTimeout) {
    if (clientTimeout == null) {
      clientTimeout = 5000;
    }
    return setTimeout(this.messageFailed.bind(this, message), clientTimeout);
  };

  Bongo.prototype.ping = function(callback) {
    return this.send('ping', callback);
  };

  Bongo.prototype.send = function(method, args) {
    var scrubber,
      _this = this;

    if (!Array.isArray(args)) {
      args = [args];
    }
    if (!this.channel) {
      throw new Error('No channel!');
    }
    scrubber = new Scrubber(this.localStore);
    return scrubber.scrub(args, function() {
      var message, messageString;

      message = scrubber.toDnodeProtocol();
      message.method = method;
      message.sessionToken = _this.getSessionToken();
      message.userArea = _this.getUserArea();
      messageString = JSON.stringify(message);
      return _this.channel.publish(messageString);
    });
  };

  Bongo.prototype.authenticateUser = function() {
    var clientId;

    clientId = this.getSessionToken();
    return this.send('authenticateUser', [clientId, this.bound('changeLoggedInState')]);
  };

  Bongo.prototype.handshakeDone = function() {
    this.api || (this.api = this.createRemoteApiShims(REMOTE_API));
    this.readyState = CONNECTED;
    this.emit('ready');
    return this.authenticateUser();
  };

  Bongo.prototype.defineApi = function(api) {
    this.api = this.createRemoteApiShims(api);
    return this.handshakeDone();
  };

  Bongo.prototype.changeLoggedInState = function(state) {
    return this.emit('loggedInStateChanged', state);
  };

  Bongo.prototype.updateSessionToken = function(token) {
    return this.emit('sessionTokenChanged', token);
  };

  Bongo.prototype.fetchChannel = function(channelName, callback) {
    var channel;

    channel = this.mq.subscribe(channelName);
    return channel.once('broker.subscribed', function() {
      return callback(channel);
    });
  };

  Bongo.prototype.use = function(fn) {
    return this.stack.push(fn);
  };

  Bongo.prototype.monitorPresence = function(callbacks) {
    return this.send('monitorPresence', callbacks);
  };

  Bongo.prototype.subscribe = function(name, options, callback) {
    var channel, _ref3;

    if (options == null) {
      options = {};
    }
    if ((_ref3 = options.serviceType) == null) {
      options.serviceType = 'application';
    }
    channel = this.mq.subscribe(name, options);
    channel.setAuthenticationInfo({
      serviceType: options.serviceType,
      group: options.group,
      name: name,
      clientId: this.getSessionToken()
    });
    if (callback != null) {
      channel.once('broker.subscribed', function() {
        return callback(channel);
      });
    }
    return channel;
  };

  return Bongo;

})(EventEmitter);

if (!isBrowser && module) {
  module.exports = Bongo;
} else if (typeof window !== "undefined" && window !== null) {
  window['Bongo'] = Bongo;
}
});
require("/node_modules_koding/bongo-client/bongo.js");
})();

}();