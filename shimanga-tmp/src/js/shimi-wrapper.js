(function(shimi, win, doc, undef) {

    // HTML5 Media API that we need to fake
    shimi.html5media = {
        properties: [
            // GET/SET
            'volume', 'src', 'currentTime', 'muted'

            // GET only
            , 'duration', 'paused', 'ended'

            // OTHERS
            , 'error', 'currentSrc', 'networkState', 'preload', 'buffered', 'bufferedBytes', 'bufferedTime', 'readyState', 'seeking',
            'initialTime', 'startOffsetTime', 'defaultPlaybackRate', 'playbackRate', 'played', 'seekable', 'autoplay', 'loop', 'controls'
        ],

        methods: [
            'load', 'play', 'pause', 'canPlayType'
        ],

        events: [
            'loadstart', 'progress', 'suspend', 'abort', 'error', 'emptied', 'stalled', 'play', 'pause', 'loadedmetadata',
            'loadeddata', 'waiting', 'playing', 'canplay', 'canplaythrough', 'seeking', 'seeked', 'timeupdate', 'ended', 'ratechange', 'durationchange', 'volumechange'
        ],

        mediaTypes: [
            'audio/mp3', 'audio/ogg', 'audio/oga', 'audio/wav', 'audio/mpeg', 'video/mp4', 'video/webm', 'video/ogg'
        ]
    }


    // a list of possible renderers (HTML5, Flash, pure JS, etc.)
    shimi.Renderers = {

        renderers: {},

        order: [],

        // register a new renderer
        add: function(name, type, supports, options) {
            this.renderers[name] = {
                name: name,
                type: type,
                supports: supports,
                options: options || {}
            }
            this.order.push(name);
        },

        // go through the renders and return the first one that supports the given type	
        // accepts string:type
        // or array [{src:'',type:''}]
        getRendererByType: function(mediaType) {
            var t = this;

            for (var i = 0, il = t.order.length; i < il; i++) {
                var rendererName = t.order[i],
                    renderer = t.renderers[rendererName];

                for (var j = 0, jl = renderer.supports.length; j < jl; j++) {

                    if (renderer.supports[j].indexOf(mediaType) > -1) {
                        return rendererName;
                    }
                }
            }

            return null;
        },


        // array [{src:'',type:''}]
        selectRenderer: function(mediaFiles) {
            var t = this;

            for (var i = 0, il = t.order.length; i < il; i++) {
                var rendererName = t.order[i],
                    renderer = t.renderers[rendererName];

                for (var j = 0, jl = renderer.supports.length; j < jl; j++) {

                    for (var k = 0, kl = mediaFiles.length; k < kl; k++) {
                        if (renderer.supports[j].indexOf(mediaFiles[k].type) > -1) {
                            return {
                                rendererName: rendererName,
                                src: mediaFiles[k].src
                            }
                        }
                    }
                }
            }

            return null;
        },

        getRendererByUrl: function(url) {
            return this.getRendererByType(shimi.Utils.getTypeFromFilel(url));
        }
    };

    // Outside Wrapper returns a fake DOM element with properties that look like
    // a real HTMLMediaElement
    shimi.MediaElement = function(id, options) {

        var t = this;

        t.id = id || 'shimi_' + Math.random().toString().slice(2);
        t.options = options;

        // create dummy DOM node to attach get/set properties
        t.node = doc.createElement('fake');
        t.domDoc = doc.documentElement.lastChild || doc.documentElement;

        // check for existing node
        t.node.previousNode = t.previousNode = document.getElementById(t.id);

        console.log('child', t.node.previousNode.childNodes.length);

        if (t.previousNode !== null) {
            // change id
            t.previousNode.setAttribute('id', t.id + '_shimied');

            // add next to this one
            t.previousNode.parentNode.insertBefore(t.node, t.previousNode);
        } else {
            // just add to the end of the document object
            t.domDoc.appendChild(t.node);
        }

        t.node.setAttribute('id', t.id);

        t.renderers = {};
        t.renderer = null;
        t.node.rendererName = null;

        // add properties get/set
        var props = shimi.html5media.properties;
        for (var i = 0, il = props.length; i < il; i++) {

            // wrap in function to retain scope
            (function(propName) {

                // src is a special one below
                if (propName != 'src') {

                    var capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                    shimi.Utils.addProperty(t.node, propName,
                        function() {
                            //console.log('[wrapper get]: ' + propName);

                            if (t.renderer != null) {
                                return t.renderer['get' + capName]();
                            } else {
                                return null;
                            }
                        },
                        function(value) {
                            //console.log('[wrapper set]: ' + propName + ' = ' + value);

                            if (t.renderer != null) {
                                t.renderer['set' + capName](value);
                            }
                        });
                }

            })(props[i]);
        }

        // special .src property
        shimi.Utils.addProperty(t.node, 'src',
            function() {
                console.log('[wrapper get]: SRC');

                if (t.renderer != null) {
                    return t.renderer.getSrc();
                } else {
                    return null;
                }
            },
            function(value) {
                console.log('[wrapper set]: SRC: ', value);


                var renderInfo,
                    mediaFiles = [];

                // clean up URLs
                if (typeof value == 'string') {
                    mediaFiles.push({
                        src: value,
                        type: shimi.Utils.getTypeFromFile(value)
                    });
                } else {
                    for (i = 0, il = value.length; i < il; i++) {

                        var src = value[i].src,
                            type = value[i].type;

                        mediaFiles.push({
                            src: src,
                            type: (type === null || typeof type == 'undefined') ? mejs.Utils.getTypeFromFile(src) : type
                        });

                    }

                }

                console.log('SRC test', mediaFiles);

                // find a renderer and URL match
                renderInfo = shimi.Renderers.selectRenderer(mediaFiles);


                console.log('SRC selection', renderInfo);


                // did we find a renderer?
                if (renderInfo === null) {
                    t.node.dispatchEvent('error', { message: 'No renderer found' });
                    return;
                }

                // turn on the renderer (this checks for the existing renderer already)
                t.node.changeRenderer(renderInfo.rendererName);

                if (t.renderer !== null) {
                    // send the command down to the renderer
                    t.renderer.setSrc(renderInfo.src);
                } else {
                    // sad
                    t.node.dispatchEvent('error', { message: 'Error creating renderer' });
                }
            });


        // add methods
        var methods = shimi.html5media.methods;
        for (var i = 0, il = methods.length; i < il; i++) {

            // wrap in function to retain scope
            (function(methodName) {

                // run the method on the current renderer
                t.node[methodName] = function() {
                    console.log('[wrapper ' + methodName + '()]');
                    if (t.renderer != null) {
                        return t.renderer[methodName].apply(t.renderer, arguments);
                    } else {
                        return null;
                    }
                };

            })(methods[i]);
        }

        t.node.renderer = t.renderer;


        // fake the media events?
        t.events = [];

        // start: fake events
        t.node.addEventListener = function(eventName, callback, bubble) {
            // create or find the array of callbacks for this eventName
            t.events[eventName] = t.events[eventName] || [];

            // push the callback into the stack
            t.events[eventName].push(callback);
        };
        t.node.removeEventListener = function(eventName, callback) {
            // no eventName means remove all listeners
            if (!eventName) {
                t.events = {};
                return true;
            }

            // see if we have any callbacks for this eventName
            var callbacks = t.events[eventName];
            if (!callbacks) {
                return true;
            }

            // check for a specific callback
            if (!callback) {
                t.events[eventName] = [];
                return true;
            }

            // remove the specific callback
            for (var i = 0, il = callbacks.length; i < il; i++) {
                if (callbacks[i] === callback) {
                    this.events[eventName].splice(i, 1);
                    return true;
                }
            }
            return false;
        }
        t.node.dispatchEvent = function(eventName) {
            var i,
                args,
                callbacks = t.events[eventName];

            if (callbacks) {
                args = Array.prototype.slice.call(arguments, 1);
                for (i = 0, il = callbacks.length; i < il; i++) {
                    callbacks[i].apply(null, args);
                }
            }
        }

        // renders whether it found the renderer
        t.node.changeRenderer = function(rendererName) {

            console.log('[wrapper changeRenderer(' + rendererName + ')]', t.renderer ? t.renderer.name : '', t.renderers, t.renderer);

            // check for a match on the current renderer
            if (t.renderer !== null && t.renderer.name == rendererName) {
                console.log('Already using: ' + rendererName);
                return true;
            }

            // if existing renderer is not the right one, then hide it
            if (t.renderer !== null) {
                t.renderer.pause();
                t.renderer.hide();
            }

            // see if we have the renderer already created		
            var newRenderer = t.renderers[rendererName],
                newRendererType = null;

            if (newRenderer != null) {
                newRenderer.show();
                t.renderer = newRenderer;
                return true;
            }

            // find the desired renderer in the array of possible ones
            for (var index in shimi.Renderers.order) {
                if (shimi.Renderers.order[index] === rendererName) {

                    // create the renderer
                    newRendererType = shimi.Renderers.renderers[shimi.Renderers.order[index]];
                    newRenderer = new newRendererType.type(t, newRendererType.options);
                    newRenderer.name = rendererName;

                    console.log('Switching to: ', newRendererType);

                    // store for later
                    t.renderers[newRendererType.name] = newRenderer;
                    t.renderer = newRenderer;
                    t.node.rendererName = rendererName;
                    newRenderer.show();


                    return true;
                }
            }

            console.log('-- ERROR finding: ' + rendererName);

            return false;
        }

        t.node.setSize = function(width, height) {
            if (t.renderer != null) {
                t.renderer.setSize(width, height);
            }
        }


        // find <source> elements
        if (t.previousNode != null) {
            var mediaFiles = [],
                i, n, src, type;

            // test <source> types to see if they are usable
            for (i = 0; i < t.previousNode.childNodes.length; i++) {
                n = t.previousNode.childNodes[i];
                if (n.nodeType == 1 && n.tagName.toLowerCase() == 'source') {
                    src = n.getAttribute('src');
                    type = shimi.Utils.formatType(src, n.getAttribute('type'));

                    mediaFiles.push({ type: type, src: src });
                }
            }

            console.log('initializing src', mediaFiles[0].src);

            // set src 
            t.node.src = mediaFiles;
        }

        // TEMP
        t.node.load();


        return t.node;
    };

    // export
    window.MediaElement = shimi.MediaElement;

})(window.shimichanga || {}, window, document);