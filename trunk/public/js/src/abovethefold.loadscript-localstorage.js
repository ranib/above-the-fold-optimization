/**
 * HTML5 Web Worker and Fetch API based script loader with localStorage cache
 *
 * Inspired by basket.js
 * @link https://addyosmani.com/basket.js/
 *
 * @package    abovethefold
 * @subpackage abovethefold/public
 * @author     PageSpeed.pro <info@pagespeed.pro>
 */

(function(window, Abtf) {
    'use strict';

    /**
     * Verify if localStorage is available
     */
    if (!(function() {

        // test availability of localStorage
        try {
            if ('localStorage' in window && window['localStorage'] !== null) {
                // ok
            } else {
                return false;
            }
        } catch(e) {
            return false;
        }

        // test access
        var check = 'abtf';
        try {
            localStorage.setItem(check, check);
            localStorage.removeItem(check);
        } catch(e) {
            return false;
        }

        // test availability Web Workers
        if (typeof(window.Worker) === "undefined" || !window.Worker) {
            return false;
        }

        return true;
    })()) {

        // localStorage not available
        // fallback to regular loading
        return;
    }

    /**
     * Object urls to revoke on unload
     */
    var OBJECT_URLS = [];

    /**
     * localStorage controller
     */
    var LS = {

        // Prefix for cache entries
        prefix: 'abtf-',

        // Default expire time in seconds
        default_expire: 86400, // 1 day

        isValidItem: null,

        timeout: 5000,

        // return current time in seconds
        now: function() {
            return (+new Date() / 1000);
        },

        /**
         * Save script to localStorage cache
         */
        saveScript: function( url, scriptData, expire ) {

            var scriptObj = {};

            var now = this.now();
            scriptObj.date = now;
            scriptObj.expire = now + ( expire || LS.default_expire );

            if (scriptData instanceof Array) {

                // chunked
                scriptObj.chunked = true;
                scriptObj.chunks = scriptData.length;

                var chunkObjects = [];
                var l = scriptData.length;
                for (var i = 0; i < l; i++) {
                    chunkObjects.push(scriptData[i]);
                }
            } else {
                var chunkObjects = false;
                scriptObj.data = scriptData;
            }

            this.add( url, scriptObj );

            if (chunkObjects) {
                var l = chunkObjects.length;
                for (var i = 0; i < l; i++) {
                    this.add( 'chunk:'+i+':'+url, chunkObjects[i] );
                }
            }
        },

        /**
         * Get script from localStorage cache
         */
        getScript: function(url) {

            // get from localStorage
            var cacheObject = this.get(url);

            if (!cacheObject) {
                return false; // not in cache
            }

            // verify expire time
            if (typeof cacheObject.expire !== 'undefined' && (cacheObject.expire - this.now()) < 0) {
                return false; // expired
            }

            /**
             * Chunked data
             */
            if (typeof cacheObject.chunked !== 'undefined' && cacheObject.chunked === true) {
                var data = [], chunkData;
                for (var i = 0; i < cacheObject.chunks; i++) {
                    chunkData = this.get('chunk:'+i+':'+url);

                    // chunk is missing
                    if (chunkData === false) {
                        return false;
                    }
                    data.push(chunkData);
                }
                cacheObject.data = data.join('');
            }

            // create blob url
            var bloburl = createBlobUrl(cacheObject.data,'application/javascript');
            OBJECT_URLS.push(bloburl);

            return bloburl;

        },

        /**
         * Add data to localStorage cache
         */
        add: function( key, storeObj, retryCount ) {

            // skip retry after 10 removed entries
            if (typeof retryCount !== 'undefined' && parseInt(retryCount) > 1) {

                if (ABTFDEBUG) {
                    console.error('Abtf.js() ➤ localStorage quota reached','retry limit reached, abort saving...', key);
                }
                return;
            }

            if (typeof storeObj === 'object') {
                storeObj = JSON.stringify( storeObj );
            }
            try {
                localStorage.setItem( LS.prefix + key, storeObj );
                return true;
            } catch( e ) {

                /**
                 * localStorage quota reached, prune old cache entries
                 */
                if ( e.name.toUpperCase().indexOf('QUOTA') >= 0 ) {
                    var item, entry, entryKey;
                    var tempScripts = [];

                    for ( item in localStorage ) {
                        if ( item.indexOf( LS.prefix ) === 0 && item.indexOf('chunk:') === -1 ) {
                            entryKey = item.split( LS.prefix )[ 1 ];
                            entry = LS.get( entryKey );
                            if (entry) {
                                tempScripts.push( [entryKey, entry] );
                            }
                        }
                    }

                    if ( tempScripts.length ) {
                        tempScripts.sort(function( a, b ) {
                            return a.date - b.date;
                        });

                        if (ABTFDEBUG) {
                            console.error('Abtf.js() ➤ localStorage quota reached','removed',tempScripts[0][0],e);
                        }

                        LS.remove( tempScripts[0][0] );

                        if (typeof retryCount === 'undefined') {
                            retryCount = 0;
                        }
                        return LS.add( key, storeObj, ++retryCount );

                    } else {


                        if (ABTFDEBUG) {
                            console.error('Abtf.js() ➤ localStorage quota reached','no files to remove');
                        }

                        // no files to remove. Larger than available quota
                        return;
                    }

                } else {

                    if (ABTFDEBUG) {
                        console.error('Abtf.js() ➤ localStorage error',e.name,e);
                    }

                    // some other error
                    return;
                }
            }
        },

        /**
         * Remove from localStorage
         */
        remove: function( key ) {

            var entry = LS.get( key );
            if (!entry) {
                return;
            }

            if (entry.chunked) {

                // remove chunks
                var l = parseInt(entry.chunks);
                for (var i = 0; i < l; i++) {
                    localStorage.removeItem( LS.prefix + 'chunk:'+i+':'+key);
                }
            }

            localStorage.removeItem( LS.prefix + key );
        },

        /**
         * Get from localStorage
         */
        get: function( key ) {
            var item = localStorage.getItem( LS.prefix + key );
            try {

                // chunk, return string
                if (key.indexOf('chunk:') !== -1) {
                    return item || false;
                }
                return JSON.parse( item || 'false' );
            } catch( e ) {
                return false;
            }
        },

        /**
         * Clear expired entries in localStorage
         */
        clear: function( expired ) {
            var item, key;
            var now = this.now();

            var entry, clear;
            for ( item in localStorage ) {
                key = item.split( LS.prefix )[ 1 ];
                if (key) {
                    if (key.indexOf('chunk:') !== -1) {
                        // chunk, remove by parent object
                        continue;
                    }

                    // get entry
                    entry = LS.get( key );
                    if (!entry) {
                        // entry does not exist
                        continue;
                    }

                    if (!expired || entry.expire <= now) {

                        // remove entry
                        LS.remove( key );
                    }
                }
            }
        }

    };

    /**
     * Create javascript blob url
     */
    var createBlobUrl = function(fileData,mimeType) {
        var blob;

        /**
         * Create blob
         */
        try {
            blob = new Blob([fileData], {type: mimeType});
        } catch (e) { // Backwards-compatibility
            window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
            blob = new BlobBuilder();
            blob.append(fileData);
            blob = blob.getBlob(mimeType);
        }

        /**
         * Return blob url
         */
        return URL.createObjectURL(blob);
    };

    LS.add('test',{x:1});

    /**
     * Web Worker source code
     */
    var WORKER_CODE = ((function() {

        // Fetch API
        self.FETCH = self.fetch || false;

        // default xhr timeout
        self.DEFAULT_TIMEOUT = 5000;

        // @todo performance tests
        // @link https://jsperf.com/localstorage-10x100kb-vs-2x-500kb-vs-1x-1mb
        self.MAX_CHUNK_SIZE = 100000; // 100kb

        // chunk data for localStorage
        self.CHUNK_DATA = function(data,chunkSize) {
            var chunksCount = Math.ceil(data.length/chunkSize);
            var chunks  = new Array(chunksCount);
            var offset;

            for (var i=0; i<chunksCount; i++) {
                offset = i * chunkSize;
                chunks[i] = data.substring(offset, offset + chunkSize);
            }

            return chunks;
        };

        /**
         * Method for loading resource
         */
        var LOAD_RESOURCE = function(file) {

            // resource loaded flag
            var resourceLoaded = false;

            // onload callback
            var resourceOnload = function(error,returnData) {
                if (resourceLoaded) {
                    return;  // already processed
                }

                resourceLoaded = true;

                if (request_timeout) {
                    clearTimeout(request_timeout);
                    request_timeout = false;
                }

                if (!error && returnData) {

                    /**
                     * localStorage appears to become buggy with large scripts
                     *
                     * Split data in chunks.
                     */
                    var dataSize = returnData.length;

                    // calculate data size
                    if (dataSize > MAX_CHUNK_SIZE) {
                        returnData = CHUNK_DATA(returnData,MAX_CHUNK_SIZE);
                    }
                }

                RESOURCE_LOAD_COMPLETED(file,error,returnData);
            };

            /**
             * Use Fetch API
             */
            if(FETCH) {

                // fetch configuration
                var fetchInit = { 
                    method: 'GET',
                    mode: 'cors',
                    cache: 'default'
                };

                var handleError = function(error) {
                    if (resourceLoaded) {
                        return;  // already processed
                    }

                    if (typeof error === 'object' && error.status) {
                        error = [error.status,error.statusText];
                    }

                    // error
                    resourceOnload(error);
                };

                // fetch request
                FETCH(file.url, fetchInit)
                    .then(function(response) {
                        if (resourceLoaded) {
                            return;  // already processed
                        }

                        // handle response
                        if(response.ok) {

                            // get text data
                            response.text().then(function(data) {
                                resourceOnload(false,data);
                            });

                        } else {

                            // error
                            resourceOnload([response.status,response.statusText]);
                        }

                    }, handleError).catch(handleError);

                // Fetch API does not support abort or cancel or timeout
                // simply ignore the request on timeout
                var timeout = file.timeout || DEFAULT_TIMEOUT;
                if (isNaN(timeout)) {
                    timeout = DEFAULT_TIMEOUT;
                }
                var request_timeout = setTimeout( function requestTimeout() {
                    if (resourceLoaded) {
                        return; // already processed
                    }
                    
                   resourceOnload('timeout');
                }, timeout );
            } else {

                // start XHR request
                var xhr = new XMLHttpRequest();
                xhr.open('GET', file.url, true);

                /**
                 * Set XHR response type
                 */
                xhr.responseType = 'text';

                // watch state change
                xhr.onreadystatechange = function () {
                    if (resourceLoaded) {
                        return;  // already processed
                    }

                    // handle response
                    if (xhr.readyState === 4) {

                        if (xhr.status !== 200) {

                            // error
                            resourceOnload(xhr.statusText);
                        } else {

                            /**
                             * Return text
                             */
                            resourceOnload(false,xhr.responseText);

                        }
                    }
                }
                /**
                 * Resource load completed
                 */
                xhr.onerror = function resourceError() {
                    if (resourceLoaded) {
                        return; // already processed
                    }

                    resourceOnload(xhr.statusText);
                };

                // By default XHRs never timeout, and even Chrome doesn't implement the
                // spec for xhr.timeout. So we do it ourselves.
                var timeout = file.timeout || DEFAULT_TIMEOUT;
                if (isNaN(timeout)) {
                    timeout = DEFAULT_TIMEOUT;
                }
                var request_timeout = setTimeout( function requestTimeout() {
                    if (resourceLoaded) {
                        return; // already processed
                    }
                    try {
                        xhr.abort();
                    } catch(e) {

                    }
                    resourceOnload('timeout');
                }, timeout );

                xhr.send(null);

            }
        };

        /**
         * Post back to UI after completion of specific resource
         */
        self.RESOURCE_LOAD_COMPLETED = function(file,error,returnData) {

            if (error) {

                if (!(error instanceof Array) && typeof error === 'object') {
                    error = error.toString();
                }

                // return error
                self.postMessage([2,file.i,error]);
            } else {

                // send back data to save in localStorage
                self.postMessage([1,file.i,returnData]);                
            }

        };

        /**
         * Handle load request for web worker
         */
        self.onmessage = function (oEvent) {

            var files = oEvent.data;

            // load multiple files
            if (files instanceof Array) {
                var l = files.length;
                for (var i = 0; i < l; i++) {
                    if (typeof files[i] === 'object' && typeof files[i].url !== 'undefined' && typeof files[i].i !== 'undefined') {
                        LOAD_RESOURCE(files[i]);
                    }
                }
            } else if (typeof files === 'object' && typeof files.url !== 'undefined' && typeof files.i !== 'undefined') {
                LOAD_RESOURCE(files);
            } else {
                throw new Error('Web Worker Script Loader: Invalid resource object');
            }
        }

    }).toString()
        .replace(/^function\s*\(\s*\)\s*\{/,'')
        .replace(/\}$/,'')
    );

    /**
     * Web Worker Script Loader
     */
    var WEBWORKER = {

        // web worker code
        workerUri: createBlobUrl(WORKER_CODE,'application/javascript'),

        // web worker
        worker: false,

        scriptIndex: 0,
        scriptQueue: [],

        // start web worker
        start: function() {

            this.worker = new Worker(this.workerUri);

            // listen for messages from worker
            this.worker.addEventListener('message', this.handleMessage);

            // listen for errors
            this.worker.addEventListener('error',this.handleError);
        },

        /**
         * Stop web worker
         */
        stop: function() {
            if (this.worker) {

                // remove listeners
                this.worker.removeEventListener('message', this.handleMessage);

                // listen for errors
                this.worker.removeEventListener('error',this.handleError);

                // terminate worker
                this.worker.terminate();

                this.worker = false;

                if (ABTFDEBUG) {
                    console.warn('Abtf.js() ➤ web worker terminated');
                }
            }
        },

        /**
         * Handle response from Web Worker
         */
        handleMessage: function(event) {
            var response = event.data;

            var scriptIndex = response[1];
            if (typeof WEBWORKER.scriptQueue[scriptIndex] === 'undefined') {

                // script not in queue
                if (ABTFDEBUG) {
                    console.error('Abtf.js() ➤ web worker script loader invalid response',response);
                }
                return;
            }

            // data is returned
            if (parseInt(response[0]) === 1) {
                WEBWORKER.scriptQueue[scriptIndex].onData(response[2]);
                return;
            }

            // error
            if (parseInt(response[0]) === 2) {
                if (ABTFDEBUG) {
                    if (response[2] instanceof Array) {
                        if (parseInt(response[2][0]) > 200 && parseInt(response[2][0]) < 600) {
                            console.error('Abtf.js() ➤ web worker ➤ '+response[2][0]+' '+response[2][1],WEBWORKER.scriptQueue[scriptIndex].url);
                            return;
                        }
                    }
                    console.error('Abtf.js() ➤ web worker script loader error',response[2]);
                }
                return;
            }
        },

        /**
         * Handle error response
         */
        handleError: function(error) {

            // output error to console
            if (ABTFDEBUG) {
                console.error('Abtf.js() ➤ web worker script loader error',error);
            }
        },

        /**
         * Load script
         */
        loadScript: function(url,onData) {

            if (!this.worker) {
                this.start();
            }

            url = window['Abtf'].proxifyScript(url);

            var scriptIndex = parseInt(this.scriptIndex);
            this.scriptIndex++;

            // add to queue
            this.scriptQueue[scriptIndex] = {
                url: url,
                onData: onData
            };

            // send to web worker 
            this.worker.postMessage({
                url: url,
                i: scriptIndex
            });
        }
    };

    // start web worker
    WEBWORKER.start();

    /**
     * Clear memory
     */
    window.addEventListener("beforeunload", function (e) {

        // stop web worker
        WEBWORKER.stop();

        // revoke script object urls
        if (OBJECT_URLS.length > 0) {
            var l = OBJECT_URLS.length;
            for (var i = 0; i < l; i++) {
                try {
                    URL.revokeObjectURL(OBJECT_URLS[i]);
                } catch(err) {
                    if (ABTFDEBUG) {
                        console.error('Abtf.js() ➤ failed to revoke script url',OBJECT_URLS[i],err);
                    }   
                }
            }
        }
    });

    /**
     * Clear expired entries
     */
    LS.clear( true );

    /**
     * Load cached script
     */
    window['Abtf'].loadCachedScript = function (src, callback, context) {

        /**
         * Try localStorage cache
         */
        var url = LS.getScript(src);
        if (url) {
            Abtf.loadScript(url, callback, context);
            return url;
        }

        /**
         * Not in cache, start regular request
         */
        Abtf.loadScript(src, function scriptLoaded() {

            /**
             * Load script into cache in the background
             */
            WEBWORKER.loadScript(src, function onData(scriptData) {

                if (!scriptData) {
                    if (ABTFDEBUG) {
                        console.error('Abtf.js() ➤ web worker script loader no data',Abtf.localUrl(src));
                    }
                    return;
                }

                if (ABTFDEBUG) {
                    if (scriptData instanceof Array) {
                        console.info('Abtf.js() ➤ web worker ➤ localStorage saved chunked','(' + scriptData.length + ' chunks)', Abtf.localUrl(src));
                    } else {
                        console.info('Abtf.js() ➤ web worker ➤ localStorage saved', '('+scriptData.length+')', Abtf.localUrl(src));
                    }
                }

                // save script to local storage
                LS.saveScript(src,scriptData);

            });

        }, context);

        return false;
        
    };

    /**
     * Load cached script url
     */
    window['Abtf'].cachedScriptUrl = function (src) {

        /**
         * Try localStorage cache
         */
        var url = LS.getScript(src);
        if (url) {
            return url;
        }

        /**
         * Load script into cache in the background
         */
        WEBWORKER.loadScript(src, function onData(scriptData) {

            if (!scriptData) {
                if (ABTFDEBUG) {
                    console.error('Abtf.js() ➤ web worker script loader no data',Abtf.localUrl(src));
                }
                return;
            }

            if (ABTFDEBUG) {
                if (scriptData instanceof Array) {
                    console.info('Abtf.js() ➤ web worker ➤ localStorage saved chunked','(' + scriptData.length + ' chunks)', Abtf.localUrl(src));
                } else {
                    console.info('Abtf.js() ➤ web worker ➤ localStorage saved', '('+scriptData.length+')', Abtf.localUrl(src));
                }
            }

            // save script to local storage
            LS.saveScript(src,scriptData);

        });

        // return original url 
        return src;
        
    };

})(window, window['Abtf']);