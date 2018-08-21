(function(shimi, win, doc, undefined) {


    /// LIBRARIES
    var

    // Jon Resig's events
        addEvent = function(obj, type, fn) {
            if (obj.addEventListener) {
                obj.addEventListener(type, fn, false);
            } else if (obj.attachEvent) {
                obj['e' + type + fn] = fn;
                obj[type + fn] = function() { obj['e' + type + fn](window.event); }
                obj.attachEvent('on' + type, obj[type + fn]);
            }

        },

        removeEvent = function(obj, type, fn) {

            if (obj.removeEventListener) {
                obj.removeEventListener(type, fn, false);
            } else if (obj.detachEvent) {
                obj.detachEvent('on' + type, obj[type + fn]);
                obj[type + fn] = null;
            }
        },

        getElementsByClassName = function(class_name, node, tag) {

            if (node == null) {
                node = document;
            }
            if (node.getElementsByClassName) {
                return node.getElementsByClassName(class_name);
            }
            if (tag == null) {
                tag = '*';
            }

            var classElements = new Array();
            var j = 0,
                teststr;
            var els = node.getElementsByTagName(tag);
            var elsLen = els.length;

            for (i = 0; i < elsLen; i++) {
                if (els[i].className.indexOf(class_name) != -1) {
                    teststr = "," + els[i].className.split(" ").join(",") + ",";
                    if (teststr.indexOf("," + class_name + ",") != -1) {
                        classElements[j] = els[i];
                        j++;
                    }
                }
            }
            return classElements;
        },

        getMousePosition = function(e) {
            var x = 0,
                y = 0;

            if (!e) var e = window.event;

            if (e.pageX || e.pageY) {
                x = e.pageX;
                y = e.pageY;
            } else if (e.clientX || e.clientY) {
                x = e.clientX + doc.body.scrollLeft + doc.documentElement.scrollLeft;

                y = e.clientY + doc.body.scrollTop + doc.documentElement.scrollTop;
            }

            return { x: x, y: x };
        }

    getNodePosition = function(obj) {
            var curleft = 0,
                curtop = 0;

            if (obj.offsetParent) {
                do {
                    curleft += obj.offsetLeft;
                    curtop += obj.offsetTop;
                } while (obj = obj.offsetParent);

                return { x: curleft, y: curtop };
            }
        },

        getStyle = function(idOrObj, styleProp) {
            var obj = typeof idOrObj == 'string' ? document.getElementById(id) : idOrObj,
                val;
            if (obj.currentStyle) {
                val = obj.currentStyle[styleProp];
            } else if (window.getComputedStyle) {
                val = document.defaultView.getComputedStyle(obj, null).getPropertyValue(styleProp);
            }
            return val;
        },


        // Fade effect from scriptiny.com
        fadeEffect = {
            init: function(id, flag, target) {
                this.elem = doc.getElementById(id);
                clearInterval(this.elem.si);
                this.target = target ? target : flag ? 100 : 0;
                this.flag = flag || -1;
                this.alpha = this.elem.style.opacity ? parseFloat(this.elem.style.opacity) * 100 : 0;
                this.elem.si = setInterval(function() { fadeEffect.tween() }, 5);
            },
            tween: function() {
                if (this.alpha == this.target) {
                    clearInterval(this.elem.si);
                } else {
                    var value = Math.round(this.alpha + ((this.target - this.alpha) * .05)) + (1 * this.flag);
                    this.elem.style.opacity = value / 100;
                    this.elem.style.filter = 'alpha(opacity=' + value + ')';
                    this.alpha = value;
                }
            }
        };


    shimi.addEvent = addEvent;
    shimi.removeEvent = removeEvent;
    shimi.getElementsByClassName = getElementsByClassName;

    shimi.id = 1000;


    function ShimiPlayer(idOrObj) {

        var original = typeof(idOrObj) == 'string' ? doc.getElementById(idOrObj) : original,

            id = original.id ? original.id : 'shimi_' + shimi.id++,

            autoplay = typeof original.autoplay != 'undefined' && original.autoplay != '',

            isVideo = (original.tagName.toLowerCase() == 'video'),

            container = doc.createElement('div'),
            controls = doc.createElement('div'),

            originalWidth = isVideo ?
            original.offsetWidth > 0 ? original.offsetWidth : parseInt(original.width) :
            350;
        originalHeight = original.offsetHeight > 0 ? original.offsetHeight : parseInt(original.height),

            // create player
            mediaElement = null,

            t = this;

        t.original = original;
        t.isVideo = isVideo;

        // Container
        container.id = id + '_container';
        container.className = 'shimi-container shimi-' + original.tagName.toLowerCase();
        container.style.width = originalWidth + 'px';
        container.style.height = originalHeight + 'px'

        // Create SHIM
        original.parentElement.insertBefore(container, original);
        original.removeAttribute('controls');
        controls.style.opacity = 1.0;
        container.appendChild(original);

        mediaElement = new shimichanga.MediaElement(id);
        t.mediaElement = mediaElement;

        mediaElement.addEventListener('click', function() {
            if (mediaElement.paused) {
                mediaElement.play();
            } else {
                mediaElement.pause();
            }
        });


        t.container = container;
        t.controls = controls;

        t.createUI();

        t.createPlayPause(mediaElement, controls);
        t.createCurrentTime(mediaElement, controls);
        t.createProgress(mediaElement, controls);
        t.createDuration(mediaElement, controls);
        t.createMute(mediaElement, controls);
        t.createFullscreen(mediaElement, controls);

        t.resizeControls();


        // HTML5 media API
        //shimi.src = url;
        //shimi.load();

        if (autoplay) {
            mediaElement.play();
        }

        return mediaElement;
    }

    ShimiPlayer.prototype = {

        createUI: function() {

            var t = this,
                id = this.id,
                controls = t.controls,
                container = t.container,
                mediaElement = t.mediaElement,
                isVideo = t.isVideo,
                original = t.original,
                originalWidth = isVideo ?
                original.offsetWidth > 0 ? original.offsetWidth : parseInt(original.width) :
                350;

            // CONTROLS
            controls.className = 'shimi-controls';
            controls.id = id + '_controls';
            container.appendChild(controls);

            if (isVideo) {
                controls.style.width = (originalWidth - 20) + 'px';
            }

            addEvent(controls, 'mouseover', function() {
                clearControlsTimeout();
            });

            mediaElement.addEventListener('mouseover', function() {
                clearControlsTimeout();
                showControls();
            });

            mediaElement.addEventListener('mouseout', function() {
                if (isVideo && !mediaElement.paused) {
                    startControlsTimeout();
                }
            });

            var controlsTimeout = null;

            function startControlsTimeout() {
                clearControlsTimeout();

                controlsTimeout = setTimeout(function() {
                    hideControls();
                }, 200);
            }

            function clearControlsTimeout() {
                if (controlsTimeout != null) {
                    clearTimeout(controlsTimeout);
                    controlsTimeout = null;
                }
            }

            function showControls() {
                //controls.style.display = '';
                fadeEffect.init(id + '_controls', 1);
            }

            function hideControls() {
                //controls.style.display = 'none';
                fadeEffect.init(id + '_controls', 0);
            }

            addEvent(win, 'resize', function() { t.resizeControls() });

        },

        resizeControls: function() {

            var
                t = this,
                controls = t.controls,
                progress = null,
                combinedControlsWidth = 0,
                controlsBoundaryWidth = controls.offsetWidth;

            for (var i = 0, il = controls.childNodes.length; i < il; i++) {
                var control = controls.childNodes[i];

                if (control.className.indexOf('ui-time-total') > -1) {
                    progress = control;

                    var horizontalSize =
                        parseInt(getStyle(control, 'margin-left'), 10) +
                        parseInt(getStyle(control, 'margin-right'), 10);

                    combinedControlsWidth += horizontalSize;

                } else {
                    var horizontalSize =
                        parseInt(getStyle(control, 'width'), 10) +
                        parseInt(getStyle(control, 'margin-left'), 10) +
                        parseInt(getStyle(control, 'margin-right'), 10);

                    combinedControlsWidth += horizontalSize;

                }
            }

            if (progress != null) {
                progress.style.width = (controlsBoundaryWidth - combinedControlsWidth) + 'px';
            }
        },


        createPlayPause: function(mediaElement, controls) {
            var uiPlayBtn = doc.createElement('input');

            uiPlayBtn.className = 'ui-button ui-button-play';
            //uiPlayBtn.disabled = true;
            uiPlayBtn.type = 'button';
            controls.appendChild(uiPlayBtn);

            addEvent(uiPlayBtn, 'click', function() {
                if (mediaElement.paused) {
                    mediaElement.play();
                } else {
                    mediaElement.pause();
                }
            });

            // events
            mediaElement.addEventListener('play', function() {
                uiPlayBtn.className = uiPlayBtn.className.replace(/ui-button-play/gi, '') + ' ui-button-pause';
            }, false);
            mediaElement.addEventListener('playing', function() {
                uiPlayBtn.className = uiPlayBtn.className.replace(/ui-button-play/gi, '') + ' ui-button-pause';
            }, false);

            mediaElement.addEventListener('pause', function() {
                uiPlayBtn.className = uiPlayBtn.className.replace(/ui-button-pause/gi, '') + ' ui-button-play';
            }, false);

            mediaElement.addEventListener('ended', function() {
                uiPlayBtn.className = uiPlayBtn.className.replace(/ui-button-pause/gi, '') + ' ui-button-play';
            }, false);
        },

        createMute: function(mediaElement, controls) {
            var uiMuteBtn = doc.createElement('input');

            uiMuteBtn.className = 'ui-button ui-button-unmuted';
            //uiMuteBtn.disabled = true;
            uiMuteBtn.type = 'button';
            controls.appendChild(uiMuteBtn);

            addEvent(uiMuteBtn, 'click', function() {

                console.log('mute clicked');
                console.log('--', mediaElement.muted);

                if (mediaElement.muted) {
                    mediaElement.muted = false;
                } else {
                    mediaElement.muted = true;
                }

            });

            mediaElement.addEventListener('volumechange', function() {
                if (mediaElement.muted) {
                    uiMuteBtn.className = uiMuteBtn.className.replace(/ui-button-unmuted/gi, '') + ' ui-button-muted';
                } else {
                    uiMuteBtn.className = uiMuteBtn.className.replace(/ui-button-muted/gi, '') + ' ui-button-unmuted';
                }
            }, false);


        },

        createCurrentTime: function(mediaElement, controls) {
            var uiCurrentTime = doc.createElement('span');

            uiCurrentTime.className = 'ui-time';
            uiCurrentTime.innerHTML = 'Loading...';
            controls.appendChild(uiCurrentTime);

            mediaElement.addEventListener('timeupdate', function() {

                var currentTime = mediaElement.currentTime;
                if (!isNaN(currentTime)) {
                    uiCurrentTime.innerHTML = shimi.Utils.secondsToTimeCode(currentTime);
                }

            }, false);

        },

        createProgress: function(mediaElement, controls) {
            var uiTimeBarTotal = doc.createElement('div'),
                uiTimeBarLoaded = doc.createElement('div'),
                uiTimeBarCurrent = doc.createElement('div');


            // time bar!
            uiTimeBarTotal.className = 'ui-time-total';
            controls.appendChild(uiTimeBarTotal);

            uiTimeBarLoaded.className = 'ui-time-loaded';
            uiTimeBarTotal.appendChild(uiTimeBarLoaded);

            uiTimeBarCurrent.className = 'ui-time-current';
            uiTimeBarTotal.appendChild(uiTimeBarCurrent);

            mediaElement.addEventListener('timeupdate', function(e) {
                var outsideWidth = uiTimeBarTotal.offsetWidth,
                    percent = mediaElement.currentTime / mediaElement.duration;

                uiTimeBarCurrent.style.width = (outsideWidth * percent) + 'px';
            });

            mediaElement.addEventListener('progress', function(e) {

                var buffered = mediaElement.buffered,
                    duration = mediaElement.duration,
                    outsideWidth = uiTimeBarTotal.offsetWidth,
                    percent = 0

                if (buffered && buffered.length > 0 && buffered.end && duration) {
                    // TODO: account for a real array with multiple values (only Firefox 4 has this so far)
                    percent = buffered.end(0) / duration;

                    uiTimeBarLoaded.style.width = (outsideWidth * percent) + 'px';
                }
            });

            addEvent(uiTimeBarTotal, 'click', function(e) {

                var mousePos = getMousePosition(e),
                    barPos = getNodePosition(uiTimeBarTotal),
                    clickWidth = mousePos.x - barPos.x,
                    width = uiTimeBarTotal.offsetWidth,
                    percentage = clickWidth / width,
                    newTime = percentage * mediaElement.duration;

                mediaElement.currentTime = newTime;
            });

        },


        createDuration: function(mediaElement, controls) {
            var uiDuration = doc.createElement('span');

            uiDuration.className = 'ui-time';
            controls.appendChild(uiDuration);

            mediaElement.addEventListener('timeupdate', function() {

                var duration = mediaElement.duration;
                if (isNaN(duration) || duration == Infinity) {
                    duration = 0;
                }
                uiDuration.innerHTML = shimichanga.Utils.secondsToTimeCode(duration);

            }, false);

        },

        createFullscreen: function(mediaElement, controls) {

            if (!this.isVideo)
                return;

            var t = this,
                uiFullscreenBtn = doc.createElement('input'),
                isFullscreen = false,
                container = t.container,
                oldWidth = container.offsetWidth,
                oldHeight = container.offsetHeight;

            uiFullscreenBtn.className = 'ui-button ui-button-fullscreen';
            uiFullscreenBtn.type = 'button';
            controls.appendChild(uiFullscreenBtn);

            addEvent(uiFullscreenBtn, 'click', function() {

                console.log('fullscreen btn', isFullscreen);

                if (isFullscreen) {

                    if (doc.exitFullscreen) {
                        doc.exitFullscreen();
                    } else if (doc.cancelFullScreen) {
                        doc.cancelFullScreen();
                    } else if (doc.webkitCancelFullScreen) {
                        doc.webkitCancelFullScreen();
                    } else if (doc.mozCancelFullScreen) {
                        doc.mozCancelFullScreen();
                    }

                } else {

                    // store for later!
                    oldWidth = container.offsetWidth;
                    oldHeight = container.offsetHeight;

                    if (container.requestFullscreen) {
                        container.requestFullscreen();
                    } else if (container.requestFullScreen) {
                        container.requestFullScreen();
                    } else if (container.webkitRequestFullScreen) {
                        container.webkitRequestFullScreen();
                    } else if (container.mozRequestFullScreen) {
                        container.mozRequestFullScreen();
                    }
                }
            });

            // EVENTS
            if (doc.webkitCancelFullScreen) {
                doc.addEventListener('webkitfullscreenchange', function(e) {
                    console.log('fullscreen event', doc.webkitIsFullScreen, e);
                    isFullscreen = doc.webkitIsFullScreen;
                    adjustForFullscreen();

                });
            } else if (doc.mozCancelFullScreen) {
                doc.addEventListener('mozfullscreenchange', function(e) {
                    console.log('fullscreen event', doc.mozFullScreen, e);
                    isFullscreen = doc.mozFullScreen;
                    adjustForFullscreen();
                });
            }


            function adjustForFullscreen() {



                if (isFullscreen) {

                    uiFullscreenBtn.className = uiFullscreenBtn.className.replace(/ui-button-fullscreen/gi, '') + ' ui-button-exitfullscreen';

                    container.style.width = '100%';
                    container.style.height = '100%';

                    console.log('fullscreen', container.style.width, container.style.height, container.offsetWidth, container.offsetHeight);

                    //shimi.style.width = container.offsetWidth + 'px';
                    //shimi.style.height = container.offsetHeight + 'px';
                    mediaElement.setSize(container.offsetWidth, container.offsetHeight);


                    controls.style.width = (container.offsetWidth - 20) + 'px';
                } else {

                    uiFullscreenBtn.className = uiFullscreenBtn.className.replace(/ui-button-exitfullscreen/gi, '') + ' ui-button-fullscreen';

                    container.style.width = oldWidth + 'px';
                    container.style.height = oldHeight + 'px';
                    controls.style.width = (oldWidth - 20) + 'px';

                    mediaElement.setSize(oldWidth, oldHeight);
                }


                t.resizeControls();

            }

        }

    }

    shimi.ShimiPlayer = ShimiPlayer;
    win.ShimiPlayer = ShimiPlayer;

})(shimichanga, window, document);