(function(win, doc, shimi, undef) {

    // wraps the native HTML5 <audio> or <video> tag and bubbles its properties, events, and methods up to the wrapper
    shimi.HtmlMediaElementWrapper = function(wrapper, options) {

        var t = this;

        // store main variables
        t.id = 'html5_' + wrapper.id;
        t.wrapper = wrapper;

        // wrapper object that surrounds the native HTML5 element
        t.node = {};

        // create real video element and attach to DOM (can be moved later)
        if (wrapper.previousNode === null) {
            t.nativeMedia = document.createElement('audio');
            t.domDoc.appendChild(t.nativeMedia);
        } else {
            t.nativeMedia = wrapper.previousNode;
        }

        t.supportHtml5Media = t.nativeMedia.canPlayType && true;

        // wrappers to return native property values
        var props = shimi.html5media.properties;
        for (var i = 0, il = props.length; i < il; i++) {


            // wrap in function to retain scope
            (function(propName) {
                var capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                if (propName == 'buffered') {

                    t.node['get' + capName] = function() {

                        var fakeValue = 0;

                        // native buffered property on newer HTML5					
                        if (t.nativeMedia[propName] != null) {
                            return t.nativeMedia[propName];

                            // Some browsers (e.g., FF3.6 and Safari 5) cannot calculate target.bufferered.end()
                            // to be anything other than 0. If the byte count is available we use this instead.
                            // Browsers that support the else if do not seem to have the bufferedBytes value and
                            // should skip to there. Tested in Safari 5, Webkit head, FF3.6, Chrome 6, IE 7/8.
                        } else if (t.nativeMedia.bytesTotal != undefined && t.nativeMedia.bytesTotal > 0 && t.nativeMedia.bufferedBytes != undefined) {
                            fakeValue = t.nativeMedia.bufferedBytes / t.nativeMedia.bytesTotal * t.nativeMedia.duration;
                        }
                        // Firefox 3 with an Ogg file seems to go this way
                        else if (t.nativeMedia.lengthComputable && t.nativeMedia.total != 0) {
                            fakeValue = t.nativeMedia.loaded / t.nativeMedia.total * t.nativeMedia.duration;
                        }

                        return {
                            start: function(index) {
                                return 0;
                            },
                            end: function(index) {
                                return fakeValue;
                            },
                            length: 1
                        };
                    };

                } else {
                    t.node['get' + capName] = function() {
                        //console.log('[NATIVE get]: ', propName);

                        return t.nativeMedia[propName];
                    };

                }

                t.node['set' + capName] = function(value) {
                    //console.log('[NATIVE set]: ', propName, ' = ', value);

                    t.nativeMedia[propName] = value;
                };

            })(props[i]);
        }

        // add wrappers for native methods
        var methods = shimi.html5media.methods;
        for (var i = 0, il = methods.length; i < il; i++) {
            (function(methodName) {

                // run the method on the native HTMLMediaElement
                t.node[methodName] = function() {
                    console.log('[NATIVE ' + methodName + '()]');

                    if (t.supportHtml5Media)
                        return t.nativeMedia[methodName].apply(t.nativeMedia, arguments);
                    else
                        return null;
                };

            })(methods[i]);
        }

        // add event listers for all events that we can bubble back up
        if (t.nativeMedia.addEventListener) {
            var events = shimi.html5media.events;

            events = events.concat(['click', 'mouseover', 'mouseout']);

            for (var i = 0, il = events.length; i < il; i++) {
                (function(eventName) {

                    t.nativeMedia.addEventListener(eventName, function(e) {
                        t.wrapper.node.dispatchEvent(eventName, e);
                    });

                })(events[i]);
            }
        }

        t.node.setSize = function(width, height) {
            t.nativeMedia.style.width = width + 'px';
            t.nativeMedia.style.height = height + 'px';
        }

        t.node.hide = function() {
            t.nativeMedia.style.display = 'none';

        }
        t.node.show = function() {
            t.nativeMedia.style.display = '';
        }

        return t.node;
    };

    // add to list of possible renderers
    shimi.Renderers.add(
        'html5',
        shimi.HtmlMediaElementWrapper,

        // returns a list of supported 'type' for the current browser
        (function() {
            var mediaElement = document.createElement('audio'),
                supportedMediaTypes = [],
                mediaTypes = shimi.html5media.mediaTypes;

            if (mediaElement.canPlayType) {
                // go through sample types
                for (var index in mediaTypes) {
                    var type = mediaTypes[index];

                    if (mediaElement.canPlayType(type).replace(/no/, '') != '') {
                        supportedMediaTypes.push(type);
                    }
                }
            }

            return supportedMediaTypes;
        })()
    );

    window.HtmlMediaElementWrapper = shimi.HtmlMediaElementWrapper;

})(window, document, window.shimichanga || {});