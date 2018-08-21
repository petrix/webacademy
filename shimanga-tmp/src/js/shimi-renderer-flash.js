(function(win, doc, shimi, undef) {


    // Core detector, plugins are added below
    shimi.PluginDetector = {

        // main public function to test a plug version number PluginDetector.hasPluginVersion('flash',[9,0,125]);
        hasPluginVersion: function(plugin, v) {
            var pv = this.plugins[plugin];
            v[1] = v[1] || 0;
            v[2] = v[2] || 0;
            return (pv[0] > v[0] || (pv[0] == v[0] && pv[1] > v[1]) || (pv[0] == v[0] && pv[1] == v[1] && pv[2] >= v[2])) ? true : false;
        },

        // cached values
        nav: window.navigator,
        ua: window.navigator.userAgent.toLowerCase(),

        // stored version numbers
        plugins: [],

        // runs detectPlugin() and stores the version number
        addPlugin: function(p, pluginName, mimeType, activeX, axDetect) {
            this.plugins[p] = this.detectPlugin(pluginName, mimeType, activeX, axDetect);
        },

        // get the version number from the mimetype (all but IE) or ActiveX (IE)
        detectPlugin: function(pluginName, mimeType, activeX, axDetect) {

            var version = [0, 0, 0],
                description,
                i,
                ax;

            // Firefox, Webkit, Opera
            if (typeof(this.nav.plugins) != 'undefined' && typeof this.nav.plugins[pluginName] == 'object') {
                description = this.nav.plugins[pluginName].description;
                if (description && !(typeof this.nav.mimeTypes != 'undefined' && this.nav.mimeTypes[mimeType] && !this.nav.mimeTypes[mimeType].enabledPlugin)) {
                    version = description.replace(pluginName, '').replace(/^\s+/, '').replace(/\sr/gi, '.').split('.');
                    for (i = 0; i < version.length; i++) {
                        version[i] = parseInt(version[i].match(/\d+/), 10);
                    }
                }
                // Internet Explorer / ActiveX
            } else if (typeof(window.ActiveXObject) != 'undefined') {
                try {
                    ax = new ActiveXObject(activeX);
                    if (ax) {
                        version = axDetect(ax);
                    }
                } catch (e) {}
            }
            return version;
        }
    };

    // Add Flash detection
    shimi.PluginDetector.addPlugin('flash', 'Shockwave Flash', 'application/x-shockwave-flash', 'ShockwaveFlash.ShockwaveFlash', function(ax) {
        // adapted from SWFObject
        var version = [],
            d = ax.GetVariable("$version");
        if (d) {
            d = d.split(" ")[1].split(",");
            version = [parseInt(d[0], 10), parseInt(d[1], 10), parseInt(d[2], 10)];
        }
        return version;
    });


    shimi.FlashMediaElementWrapper = function(wrapper, options) {

        var t = this;

        // store main variable
        t.options = options;
        t.id = t.options.prefix + '_' + wrapper.id;
        t.wrapper = wrapper;

        // create our fake element that allows events and such to work
        t.node = {};
        t.domDoc = doc.documentElement.lastChild || doc.documentElement;

        // insert data
        t.flashState = {};
        t.flashApi = null;
        t.flashApiStack = [];

        // wrappers for get/set
        var props = shimi.html5media.properties;
        for (var i = 0, il = props.length; i < il; i++) {

            // wrap in function to retain scope
            (function(propName) {

                // add to flash state that we will store
                t.flashState[propName] = null;

                var capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                t.node['get' + capName] = function() {
                    if (t.flashApi !== null) {


                        if (typeof t.flashApi['get_' + propName] != 'undefined') {
                            var value = t.flashApi['get_' + propName](); //t.flashState['_' + propName];

                            //console.log('[' + options.prefix + ' get]: ' + propName + ' = ' + value);

                            // special case for buffered to conform to HTML5's newest
                            if (propName === 'buffered') {
                                console.log('buffered', value);

                                return {
                                    start: function(index) {
                                        return 0;
                                    },
                                    end: function(index) {
                                        return value;
                                    },
                                    length: 1
                                };
                            }


                            return value;
                        } else {

                            console.log('[' + options.prefix + ' MISSING]: ' + propName);


                            return null;
                        }
                    } else {
                        return null;
                    }
                }

                t.node['set' + capName] = function(value) {
                    //console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value, t.flashApi);

                    // send value to Flash
                    if (t.flashApi !== null && typeof t.flashApi['set_' + propName] != 'undefined') {
                        t.flashApi['set_' + propName](value);
                    } else {
                        // store for after "READY" event fires
                        t.flashApiStack.push({ type: 'set', propName: propName, value: value });
                    }
                }

            })(props[i]);
        }

        // add wrappers for native methods
        var methods = shimichanga.html5media.methods;
        for (var i = 0, il = methods.length; i < il; i++) {
            (function(methodName) {

                // run the method on the native HTMLMediaElement
                t.node[methodName] = function() {
                    console.log('[' + options.prefix + ' ' + methodName + '()]');

                    if (t.flashApi != null) {
                        // senc call up to Flash ExternalInterface API
                        t.flashApi['fire_' + methodName]();
                    } else {
                        // store for after "READY" event fires
                        console.log('-- stacking');
                        t.flashApiStack.push({ type: 'call', methodName: methodName });
                    }
                };

            })(methods[i]);
        }

        // add a ready method that Flash can call to
        win['__ready__' + t.id] = function() {

            t.flashReady = true;
            t.flashApi = document.getElementById('__' + t.id);

            console.log('' + options.prefix + ' ready', t, t.flashApi);

            // do call stack
            for (var i = 0, il = t.flashApiStack.length; i < il; i++) {

                var stackItem = t.flashApiStack[i];

                console.log('stack', stackItem.type);

                if (stackItem.type === 'set') {
                    var propName = stackItem.propName,
                        capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                    t.node['set' + capName](stackItem.value);
                } else if (stackItem.type === 'call') {
                    t.node[stackItem.methodName]();
                }
            }
        }

        win['__event__' + t.id] = function(eventName, values) {

            if (eventName.indexOf('mouse') > -1) {
                console.log(options.prefix + ' event', eventName, values);
            }

            /*
            // store values
            for (var prop in values) {
            	t.flashState[prop] = values[prop];
            }
            */

            // send event from Flash up to the wrapper
            t.wrapper.node.dispatchEvent(eventName, { eventName: eventName });
        }

        // insert Flash object
        t.flashWrapper = document.createElement('div');
        var
            flashVars = ['uid=' + t.id],
            isVideo = t.wrapper.previousNode !== null && t.wrapper.previousNode.tagName.toLowerCase() === 'video',
            flashHeight = (isVideo) ? t.wrapper.previousNode.height : 1,
            flashWidth = (isVideo) ? t.wrapper.previousNode.width : 1;

        if (isVideo) {
            // video goes next to the existing node
            t.wrapper.previousNode.parentNode.insertBefore(t.flashWrapper, t.wrapper.previousNode);
            t.wrapper.previousNode.style.display = 'none';
        } else {
            // audio just goes on the document
            t.domDoc.appendChild(t.flashWrapper);
        }


        if (shimi.Features.isIE) {
            var specialIEContainer = document.createElement('div');
            t.flashWrapper.appendChild(specialIEContainer);

            specialIEContainer.outerHTML =
                '<object classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000" codebase="//download.macromedia.com/pub/shockwave/cabs/flash/swflash.cab" ' +
                'id="__' + t.id + '" width="' + flashWidth + '" height="' + flashHeight + '"' +
                (isVideo ? '' : ' style="clip: rect(0 0 0 0); position: absolute;"') +
                '>' +
                '<param name="movie" value="' + t.options.filename + '?x=' + (new Date()) + '" />' +
                '<param name="flashvars" value="' + flashVars.join('&amp;') + '" />' +
                '<param name="quality" value="high" />' +
                '<param name="bgcolor" value="#000000" />' +
                '<param name="wmode" value="transparent" />' +
                '<param name="allowScriptAccess" value="always" />' +
                '<param name="allowFullScreen" value="true" />' +
                '</object>';

        } else {

            t.flashWrapper.innerHTML =
                '<embed id="__' + t.id + '" name="__' + t.id + '" ' +
                'play="true" ' +
                'loop="false" ' +
                'quality="high" ' +
                'bgcolor="#000000" ' +
                'wmode="transparent" ' +
                'allowScriptAccess="always" ' +
                'allowFullScreen="true" ' +
                'type="application/x-shockwave-flash" pluginspage="//www.macromedia.com/go/getflashplayer" ' +
                'src="' + t.options.filename + '" ' +
                'flashvars="' + flashVars.join('&') + '" ' +
                'width="' + flashWidth + '" ' +
                'height="' + flashHeight + '"' +
                (isVideo ? '' : ' style="clip: rect(0 0 0 0); position: absolute;"') +
                '></embed>';
        }

        /*
        t.flashWrapper.innerHTML = 
        	'<object ' + 
        			'id="__' + t.id + '" type="application/x-shockwave-flash" ' + 
        			'data="' + t.options.filename + '" ' + 
        			'width="' + flashWidth + '" height="' + flashHeight + '" ' + 
        			//'bgcolor="#000000" ' + 
        			(isVideo ? '' : ' style="clip: rect(0 0 0 0); position: absolute;"') + 
        			'>' + 
        				'<param name="movie" value="' + t.options.filename + '">' + 
        				'<param name="allowscriptaccess" value="always">' + 
        				'<param name="wmode" value="transparent">' + 
        				'<param name="flashvars" value="uid=' + t.id + '">' + 
        				//'<param name="bgcolor" value="#000000" />' +
        	'</object>';
	
        //t.wrapper.previousNode.replaceChild(t.flashNode, t.flashWrapper);
        */
        t.flashNode = t.flashWrapper.lastChild;


        t.node.hide = function() {
            if (isVideo) {
                t.flashNode.style.position = 'absolute';
                t.flashNode.style.width = '1px';
                t.flashNode.style.height = '1px';
                try {
                    t.flashNode.style.clip = 'rect(0 0 0 0);';
                } catch (e) {}
            }
        }
        t.node.show = function() {
            if (isVideo) {
                t.flashNode.style.position = '';
                t.flashNode.style.width = '';
                t.flashNode.style.height = '';
                try {
                    t.flashNode.style.clip = '';
                } catch (e) {}
            }
        }
        t.node.setSize = function(width, height) {
            t.flashNode.style.width = width + 'px';
            t.flashNode.style.height = height + 'px'

            t.flashApi['fire_setSize'](width, height);
        }

        return t.node;
    };





    shimi.Renderers.add(

        // name
        'flash_video',

        // renderer wrapper
        shimi.FlashMediaElementWrapper,

        // if Flash is installed, returns an array of video types
        (function() {
            var hasFlash = shimi.PluginDetector.hasPluginVersion('flash', [10, 0, 0]),
                supportedMediaTypes = ['video/mp4', 'video/flv'];

            if (hasFlash) {
                return supportedMediaTypes;
            } else {
                return [];
            }
        })(),

        // options
        {
            prefix: 'flash_video',
            filename: 'src/flash-video.swf'
        }
    );

    shimi.Renderers.add(
        // name
        'flash_audio',

        // renderer wrapper	
        shimi.FlashMediaElementWrapper,

        // returns array of types that Flash supports if Flash is installed
        (function() {
            var hasFlash = shimi.PluginDetector.hasPluginVersion('flash', [10, 0, 0]),
                supportedMediaTypes = ['audio/flv', 'audio/x-flv', 'audio/mp3'];

            if (hasFlash) {
                return supportedMediaTypes;
            } else {
                return [];
            }
        })(),

        // options
        {
            prefix: 'flash_audio',
            filename: 'src/flash-audio.swf'
        }
    );

    shimi.Renderers.add(

        // name
        'flash_audio_ogg',

        // renderer wrapper
        shimi.FlashMediaElementWrapper,

        // if Flash is installed, returns an array of ogg type values
        (function() {
            var hasFlash = shimi.PluginDetector.hasPluginVersion('flash', [10, 0, 0]),
                supportedMediaTypes = ['audio/ogg', 'audio/oga'];

            if (hasFlash) {
                return supportedMediaTypes;
            } else {
                return [];
            }
        })(),

        // options
        {
            prefix: 'flash_audio_ogg',
            filename: 'src/flash-audio-ogg.swf'
        }
    );



    window.FlashMediaElementWrapper = shimi.FlashMediaElementWrapper;

})(window, document, window.shimichanga || {});