!function(e,t,n,o,i){if(!e.jQuery){var r=[],u=[],c=!1,f=function(e,t){"ready"===e?u.push(t):r.push(e)},a={ready:f,bind:f};e.$=e.jQuery=function(e){if(e===t||void 0===e)return a;f(e)},e.$.noConflict=e.jQuery.noConflict=function(){c=!0},e.$.isStub=e.jQuery.isStub=!0,o.prototype.watch||o.defineProperty(o.prototype,"watch",{enumerable:!1,configurable:!0,writable:!1,value:function(e,t){var n=this[e],i=n;delete this[e]&&o.defineProperty(this,e,{get:function(){return i},set:function(o){return n=i,i=t.call(this,e,n,o)},enumerable:!0,configurable:!0})}}),o.prototype.unwatch||o.defineProperty(o.prototype,"unwatch",{enumerable:!1,configurable:!0,writable:!1,value:function(e){var t=this[e];delete this[e],this[e]=t}}),e.watch("jQuery",function(n,o,i){if("function"!=typeof i||void 0===i.fn||void 0!==i.isStub)return i;c&&(i.noConflict(),console.info("Abtf.jQuery.noConflict()"));var f=0;return i.each(r,function(e,t){i(t),f++}),i.each(u,function(e,n){i(t).bind("ready",n),f++}),f>0&&console.info("Abtf.jQuery.ready()",f+" callbacks"),e.unwatch("jQuery"),e.jQuery=i,i})}}(window,document,window.Abtf,Object);