window.shimichanga = window.shimichanga || {};

(function(shimi, win, doc, undefined) {

    shimi.Utils = {
        addProperty: function(obj, name, onGet, onSet) {

            // wrapper functions
            var
                oldValue = obj[name],
                getFn = function() {
                    return onGet.apply(obj, [oldValue]);
                },
                setFn = function(newValue) {
                    return oldValue = onSet.apply(obj, [newValue]);
                };

            // Modern browsers, IE9+, and IE8 (DOM object only, no custom object), 
            if (Object.defineProperty) {

                Object.defineProperty(obj, name, {
                    get: getFn,
                    set: setFn
                });

                // Older Firefox
            } else if (obj.__defineGetter__) {

                obj.__defineGetter__(name, getFn);
                obj.__defineSetter__(name, setFn);

                // IE6-7
                // must be a real DOM object (to have attachEvent) and must be attached to document (for onpropertychange to fire)
            } else {

                var onPropertyChange = function(e) {

                    //console.log('onPropertyChange', event.propertyName);	

                    if (event.propertyName == name) {

                        // temporarily remove the event so it doesn't fire again and create a loop
                        obj.detachEvent('onpropertychange', onPropertyChange);

                        // get the changed value, run it through the set function
                        var newValue = setFn(obj[name]);

                        // restore the get function
                        obj[name] = getFn;
                        obj[name].toString = getFn;

                        // restore the event
                        obj.attachEvent('onpropertychange', onPropertyChange);
                    }
                };

                try {
                    obj[name] = getFn;
                    obj[name].toString = getFn;
                } catch (ex) {
                    console.log('ERROR adding', name);
                }

                // add the property event change only once
                //if (typeof obj.hasPropertyChangeEvent == 'undefined') {
                obj.attachEvent('onpropertychange', onPropertyChange);
                //obj.hasPropertyChangeEvent = true;
                //}

            }
        },


        // only return the mime part of the type in case the attribute contains the codec
        // see http://www.whatwg.org/specs/web-apps/current-work/multipage/video.html#the-source-element
        // `video/mp4; codecs="avc1.42E01E, mp4a.40.2"` becomes `video/mp4`	
        getMimeFromType: function(type) {
            if (type && ~type.indexOf(';')) {
                return type.substr(0, type.indexOf(';'));
            } else {
                return type;
            }
        },

        formatType: function(url, type) {

            // if no type is supplied, fake it with the extension
            if (url && !type) {
                return this.getTypeFromFile(url);
            } else {
                return this.getMimeFromType(type);
            }
        },

        typeChecks: [],

        getTypeFromFile: function(url) {

            var type = null;

            // do type checks first
            for (var i = 0, il = this.typeChecks.length; i < il; i++) {
                type = this.typeChecks[i](url);

                if (type != null) {
                    return type;
                }
            }


            // the do standard extension check
            var ext = this.getExtension(url),
                normalizedExt = this.normalizeExtension(ext);


            type = (/(mp4|m4v|ogg|ogv|webm|webmv|flv|wmv|mpeg|mov)/gi.test(ext) ? 'video' : 'audio') + '/' + normalizedExt;

            return type;
        },


        getExtension: function(url) {
            var withoutQuerystring = url.split('?')[0],
                ext = ~withoutQuerystring.indexOf('.') ? withoutQuerystring.substring(withoutQuerystring.lastIndexOf('.') + 1) : '';

            return ext;
        },

        normalizeExtension: function(ext) {

            switch (ext) {
                case 'mp4':
                case 'm4v':
                    return 'mp4';
                case 'webm':
                case 'webma':
                case 'webmv':
                    return 'webm';
                case 'ogg':
                case 'oga':
                case 'ogv':
                    return 'ogg';
                default:
                    return ext;
            }
        },

        encodeUrl: function(url) {
            return encodeURIComponent(url); //.replace(/\?/gi,'%3F').replace(/=/gi,'%3D').replace(/&/gi,'%26');
        },
        escapeHTML: function(s) {
            return s.toString().split('&').join('&amp;').split('<').join('&lt;').split('"').join('&quot;');
        },
        absolutizeUrl: function(url) {
            var el = documenfeatures.createElement('div');
            el.innerHTML = '<a href="' + this.escapeHTML(url) + '">x</a>';
            return el.firstChild.href;
        },

        secondsToTimeCode: function(time, forceHours, showFrameCount, fps) {
            //add framecount
            if (typeof showFrameCount == 'undefined') {
                showFrameCount = false;
            } else if (typeof fps == 'undefined') {
                fps = 25;
            }

            var hours = Math.floor(time / 3600) % 24,
                minutes = Math.floor(time / 60) % 60,
                seconds = Math.floor(time % 60),
                frames = Math.floor(((time % 1) * fps).toFixed(3)),
                result =
                ((forceHours || hours > 0) ? (hours < 10 ? '0' + hours : hours) + ':' : '') +
                (minutes < 10 ? '0' + minutes : minutes) + ':' +
                (seconds < 10 ? '0' + seconds : seconds) +
                ((showFrameCount) ? ':' + (frames < 10 ? '0' + frames : frames) : '');

            return result;
        },

        timeCodeToSeconds: function(time, forceHours, showFrameCount, fps) {
            if (typeof showFrameCount == 'undefined') {
                showFrameCount = false;
            } else if (typeof fps == 'undefined') {
                fps = 25;
            }

            // 00:00:00		HH:MM:SS
            // 00:00 		MM:SS
            // 00			SS

            var parts = time.split(':'),
                hours = 0,
                minutes = 0,
                seconds = 0,
                frames = 0,
                seconds = 0;

            switch (parts.length) {
                default:
                    case 1:
                    seconds = parseInt(parts[0], 10);
                break;
                case 2:
                        minutes = parseInt(parts[0], 10);
                    seconds = parseInt(parts[1], 10);

                    break;
                case 3:
                        case 4:
                        hours = parseInt(parts[0], 10);
                    minutes = parseInt(parts[1], 10);
                    seconds = parseInt(parts[2], 10);
                    frames = showFrameCount ? parseInt(parts[3]) / fps : 0;
                    break;

            }

            seconds = (hours * 3600) + (minutes * 60) + seconds + frames;

            return seconds;
        }

    }


    shimi.Features = (function() {

        var features = {},
            nav = win.navigator,
            ua = nav.userAgent.toLowerCase(),
            html5Elements = ['source', 'track', 'audio', 'video'],
            video = null;


        // for IE
        for (var i = 0, il = html5Elements.length; i < il; i++) {
            video = doc.createElement(html5Elements[i]);
        }

        features.isiPad = (ua.match(/ipad/i) !== null);
        features.isiPhone = (ua.match(/iphone/i) !== null);
        features.isiOS = features.isiPhone || features.isiPad;
        features.isAndroid = (ua.match(/android/i) !== null);
        features.isIE = (nav.appName.toLowerCase().indexOf("microsoft") != -1);

        /*
        Untile it's 
	
        features.isBustedAndroid = (ua.match(/android 2\.[12]/) !== null);
        features.isChrome = (ua.match(/chrome/gi) !== null);
        features.isFirefox = (ua.match(/firefox/gi) !== null);
        features.isWebkit = (ua.match(/webkit/gi) !== null);
        features.isGecko = (ua.match(/gecko/gi) !== null) && !features.isWebkit;
        features.isOpera = (ua.match(/opera/gi) !== null);
        */

        // borrowed from Modernizr
        features.hasTouch = ('ontouchstart' in window);
        features.svg = !!doc.createElementNS &&
            !!doc.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect;

        features.supportsMediaTag = (typeof video.canPlayType != 'undefined' || features.isBustedAndroid);

        return features;
    })();

})(window.shimichanga || {}, window, document);