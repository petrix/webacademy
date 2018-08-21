(function(win, doc, shimi, undef) {

    // regisert youtube type
    shimi.Utils.typeChecks.push(function(url) {

        url = new String(url).toLowerCase();

        if (url.indexOf('youtube') > -1 || url.indexOf('youtu.be') > -1) {
            return 'video/x-youtube';
        } else {
            return null;
        }
    });


    // requires the flash renderers are present
    if (shimi.FlashMediaElementWrapper && true) {

        shimi.Renderers.add(

            // name
            'flash_youtube',

            // renderer wrapper
            shimi.FlashMediaElementWrapper,

            // if Flash is installed, returns an array of ogg type values
            (function() {
                var hasFlash = shimi.PluginDetector.hasPluginVersion('flash', [10, 0, 0]),
                    supportedMediaTypes = ['video/youtube', 'video/x-youtube'];

                if (hasFlash) {
                    return supportedMediaTypes;
                } else {
                    return [];
                }
            })(),

            // options
            {
                prefix: 'flash_youtube',
                filename: 'src/flash-youtube.swf'
            }
        );
    }

    // iframe version

    /*
     - test on IE (object vs. embed)
     - determine when to use iframe (Firefox, Safari, Mobile) vs. Flash (Chrome, IE)
     - fullscreen?
    */

    // YouTube Flash and Iframe API
    YouTubeApi = {
            isIframeStarted: false,
            isIframeLoaded: false,

            iframeQueue: [],
            enqueueIframe: function(yt) {

                if (this.isLoaded) {
                    this.createIframe(yt);
                } else {
                    this.loadIframeApi();
                    this.iframeQueue.push(yt);
                }
            },

            loadIframeApi: function() {
                if (!this.isIframeStarted) {
                    var tag = document.createElement('script');
                    tag.src = "http://www.youtube.com/player_api";
                    var firstScriptTag = document.getElementsByTagName('script')[0];
                    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
                    this.isIframeStarted = true;
                }
            },

            iFrameReady: function() {

                this.isLoaded = true;
                this.isIframeLoaded = true;

                while (this.iframeQueue.length > 0) {
                    var settings = this.iframeQueue.pop();
                    this.createIframe(settings);
                }
            },

            createIframe: function(settings) {

                var
                    id = settings.id,
                    player = new YT.Player(settings.containerId, {
                        height: settings.height,
                        width: settings.width,
                        videoId: settings.videoId,
                        playerVars: { controls: 0 },
                        events: {
                            'onReady': function() {

                                window['__ready__' + settings.id](player, { paused: true, ended: false });

                                // create timer
                                setInterval(function() {
                                    YouTubeApi.sendEvent(player, id, 'timeupdate', { paused: false, ended: false });
                                }, 250);
                            },
                            'onStateChange': function(e) {

                                switch (e.data) {
                                    case -1: // not started
                                        YouTubeApi.sendEvent(player, id, 'loadedmetadata', { pause: true, ended: true });
                                        break;
                                    case 0: // end
                                        YouTubeApi.sendEvent(player, id, 'ended', { pause: false, ended: true });
                                        break;
                                    case 1: // play
                                        YouTubeApi.sendEvent(player, id, 'play', { pause: false, ended: false });
                                        YouTubeApi.sendEvent(player, id, 'playing', { pause: false, ended: false });
                                        break;
                                    case 2: // pause
                                        YouTubeApi.sendEvent(player, id, 'pause', { pause: true, ended: false });
                                        break;
                                    case 3: // buffering
                                        YouTubeApi.sendEvent(player, id, 'progress', null);
                                        break;
                                    case 5: // cued
                                        YouTubeApi.sendEvent(player, id, 'loadedmetadata', { pause: true, ended: false });
                                        YouTubeApi.sendEvent(player, id, 'loadeddata', { pause: true, ended: false });
                                        YouTubeApi.sendEvent(player, id, 'canplay', { pause: true, ended: false });
                                        break;

                                }

                            }
                        }
                    });
            },

            sendEvent: function(player, id, eventName, youTubeState) {
                window['__event__' + id](eventName, player, youTubeState);
            },

            handleStateChange: function(player, id) {


            },

            // src
            getYouTubeId: function(url) {
                // http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
                // http://www.youtube.com/v/VIDEO_ID?version=3
                // http://youtu.be/Djd6tPrxc08

                var youTubeId = "";

                if (url.indexOf('?') > 0) {
                    // assuming: http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
                    youTubeId = YouTubeApi.getYouTubeIdFromParam(url);

                    // if it's http://www.youtube.com/v/VIDEO_ID?version=3
                    if (youTubeId === '') {
                        youTubeId = YouTubeApi.getYouTubeIdFromUrl(url);
                    }
                } else {
                    youTubeId = YouTubeApi.getYouTubeIdFromUrl(url);
                }

                return youTubeId;
            },

            // http://www.youtube.com/watch?feature=player_embedded&v=yyWWXSwtPP0
            getYouTubeIdFromParam: function(url) {

                var youTubeId = '',
                    parts = url.split('?'),
                    parameters = parts[1].split('&');

                for (var i = 0, il = parameters.length; i < il; i++) {
                    var paramParts = parameters[i].split('=');
                    if (paramParts[0] == 'v') {
                        youTubeId = paramParts[1];
                        break;
                    }
                }

                return youTubeId;
            },


            // http://www.youtube.com/v/VIDEO_ID?version=3
            // http://youtu.be/Djd6tPrxc08
            getYouTubeIdFromUrl: function(url) {

                var youTubeId = "",
                    parts = url.split('?');

                url = parts[0];
                youTubeId = url.substring(url.lastIndexOf('/') + 1);

                return youTubeId;
            }
        }
        // IFRAME
    window['onYouTubePlayerAPIReady'] = function() {
        YouTubeApi.iFrameReady();
    }



    shimi.YouTubeIframeWrapper = function(wrapper, options) {

        var t = this;

        // store main variable
        t.options = options;
        t.id = t.options.prefix + '_' + wrapper.id;
        t.wrapper = wrapper;

        // create our fake element that allows events and such to work
        t.node = {};
        t.domDoc = doc.documentElement.lastChild || doc.documentElement;

        // insert data
        t.apiStack = [];
        t.youTubeApiReady = false;
        t.youTubeApi = null;
        t.youTubeState = null;

        // wrappers for get/set
        var props = shimi.html5media.properties;
        for (var i = 0, il = props.length; i < il; i++) {

            // wrap in function to retain scope
            (function(propName) {

                // add to flash state that we will store

                var capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                t.node['get' + capName] = function() {
                    if (t.youTubeApi !== null) {
                        var value = null;

                        // figure out how to get youtube dta here
                        switch (propName) {
                            case 'currentTime':
                                return t.youTubeApi.getCurrentTime();

                            case 'duration':
                                return t.youTubeApi.getDuration();

                            case 'volume':
                                return t.youTubeApi.getVolume();

                            case 'paused':
                                return true; // ?

                            case 'ended':
                                return false; // ?	

                            case 'muted':
                                return t.youTubeApi.isMuted(); // ?	

                            case 'buffered':
                                var percentLoaded = t.youTubeApi.getVideoLoadedFraction(),
                                    duration = t.youTubeApi.getDuration();
                                return {
                                    start: function(index) {
                                        return 0;
                                    },
                                    end: function(index) {
                                        return percentLoaded * duration;
                                    },
                                    length: 1
                                };
                        }



                        return value;
                    } else {
                        return null;
                    }
                }

                t.node['set' + capName] = function(value) {
                    //console.log('[' + options.prefix + ' set]: ' + propName + ' = ' + value, t.flashApi);

                    // send value to Flash
                    if (t.youTubeApi !== null) {

                        // do somethign
                        switch (propName) {

                            case 'src':
                                //t.youTubeApi.loadVideoById( YouTubeApi.getYouTubeId(value) );
                                break;

                            case 'currentTime':
                                t.youTubeApi.seekTo(value);
                                break;

                            case 'muted':
                                if (value) {
                                    t.youTubeApi.mute(); // ?	
                                } else {
                                    t.youTubeApi.unMute(); // ?								
                                }
                                setTimeout(function() {
                                    t.wrapper.node.dispatchEvent('volumechange');
                                }, 50);
                                break;

                            case 'volume':
                                t.youTubeApi.setVolume(value);
                                setTimeout(function() {
                                    t.wrapper.node.dispatchEvent('volumechange');
                                }, 50);
                                break;

                            default:
                                console.log('youtube ' + id, propName, 'UNSUPPORTED property');
                        }

                    } else {
                        // store for after "READY" event fires
                        t.apiStack.push({ type: 'set', propName: propName, value: value });
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

                    if (t.youTubeApi !== null) {

                        // DO method
                        switch (methodName) {
                            case 'play':
                                return t.youTubeApi.playVideo();
                            case 'pause':
                                return t.youTubeApi.pauseVideo();
                            case 'load':
                                return null;

                        }

                    } else {
                        t.apiStack.push({ type: 'call', methodName: methodName });
                    }
                };

            })(methods[i]);
        }

        // add a ready method that Flash can call to
        win['__ready__' + t.id] = function(youTubeApi, youTubeState) {

            t.youTubeApiReady = true;
            t.youTubeApi = youTubeApi;
            t.youTubeState = youTubeState;

            console.log('youtube ready', t.youTubeApi);

            // do call stack
            for (var i = 0, il = t.apiStack.length; i < il; i++) {

                var stackItem = t.apiStack[i];

                console.log('stack', stackItem.type);

                if (stackItem.type === 'set') {
                    var propName = stackItem.propName,
                        capName = propName.substring(0, 1).toUpperCase() + propName.substring(1);

                    t.node['set' + capName](stackItem.value);
                } else if (stackItem.type === 'call') {
                    t.node[stackItem.methodName]();
                }
            }


            // a few mor events
            var iframe = t.youTubeApi.getIframe(),
                events = ['mouseover', 'mouseout'];

            for (var i in events) {
                var eventName = events[i];
                shimi.addEvent(iframe, eventName, function() {
                    t.wrapper.node.dispatchEvent(eventName, { eventName: eventName });
                });
            }
        }

        win['__event__' + t.id] = function(eventName, youTubeState) {
            console.log('yt event', eventName);
            if (youTubeState != null) {
                t.youTubeState = youTubeState;
            }
            t.wrapper.node.dispatchEvent(eventName, { eventName: eventName });
        }

        // container for YouTube API
        t.youtubeContainer = document.createElement('div');
        t.youtubeContainer.id = t.id;
        t.wrapper.previousNode.parentNode.insertBefore(t.youtubeContainer, t.wrapper.previousNode);
        t.wrapper.previousNode.style.display = 'none';


        var
            height = t.wrapper.previousNode.height,
            width = t.wrapper.previousNode.width,
            //videoId = YouTubeApi.getVideoId( );
            videoId = 'xmWuqd5y77M',
            youtubeSettings = {
                id: t.id,
                youtubeContainer: t.youtubeContainer,
                containerId: t.youtubeContainer.id,
                videoId: videoId,
                height: height,
                width: width
            };

        YouTubeApi.enqueueIframe(youtubeSettings);

        t.node.setSize = function(width, height) {
            t.youTubeApi.setSize(width, height);
        }
        t.node.hide = function() {

        }
        t.node.show = function() {

        }
        t.node.destroy = function() {
            t.youTubeApi.destroy();
        }

        return t.node;
    };





    shimi.Renderers.add(

        // name
        'youtube_iframe',

        // renderer wrapper
        shimi.YouTubeIframeWrapper,

        // if Flash is installed, returns an array of video types
        ['video/youtube', 'video/x-youtube'],

        // options
        {
            prefix: 'youtube_iframe'
        }
    );



})(window, document, window.shimichanga || {});