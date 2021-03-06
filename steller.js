// Copyright (c) 2012 National University of Singapore
// Inquiries: director@anclab.org
// Author: Srikumar K. S. (http://github.com/srikumarks)
//
// #### License
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Lesser General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU Lesser General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/lgpl.html>.

// ## Introduction
//
// The [Web Audio API] provides facilities for generating and processing sounds
// within a browser using Javascript. It has already seen wide adoption and is
// shipping in Chrome and Safari 6. It provides the basic modules necessary for
// building intuitive sound models, but leaves further abstraction to developers.
// [Steller] is an set of basic tools for building such re-usable sound models
// that co-operate with the Web Audio API.
// 
// We want to be able to build abstract "sound models" with intuitive parameters
// for controlling them. The basic characteristics of sound models that we're
// looking at are the following -
// 
// 1. Sound models generate sound though one or more outputs. They may optionally
//    process input sounds as well, in which case they are sound *transformation*
//    models.
// 
// 2. They have parameters that control the generation or transformation in real
//    time. The animation of these parameters can be coordinated precisely.
// 
// 3. Sound models may use other sound models internally. This lets us build more
//    complex models out simpler ones and encapsulate them. A useful design
//    principle is to make the interfaces of sound models to be static and keep
//    all dynamic aspects internal to it.
//
// [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
// [Web Audio API]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html
// [Steller]: https://raw.github.com/srikumarks/jsaSound/master/steller_api/steller.js 
// 
// ## Design ##
// 
// [Steller] realizes the important aspects of sound models mentioned above using
// the `GraphNode` object transformer and `Param` objects. `GraphNode` can impart
// node-like behaviour to an object. `Param` objects can be animated, watched and shared.
// Therefore a "base" sound model is simply `GraphNode`.
// 
//     var SoundModel = GraphNode;
// 
// We also need the ability to schedule these sounds. This facility is needed both
// for internal use by sound models as well as for the sound model user. This
// need arises from the fact that we want sound models to be compositional - i.e.
// a sound model can be the "user" of another sound model. The `Scheduler` is an
// orthogonal component that serves this purpose.
// 
// #### GraphNode
//
// The `GraphNode` encapsulates a signal processing graph and lets you use it as a
// single node in a larger graph. This way, larger graphs can be built using
// encapsulated smaller graphs. 
// 
// #### The Scheduler
// 
// A broad-stroke description of a sound model's function is that it organizes
// sounds and their processing in time. The `Scheduler`'s job is to facilitate
// that. Here is an example of using the scheduler to print "one" followed by
// "two" on the console after 3 seconds. (This shows that the scheduler isn't
// limited to performing audio activity alone.)
// 
//     // Make a new scheduler that uses the given audio 
//     // context's "currentTime" as its time base. You
//     // can also use an existing `audioContext`.
//     var audioContext = new webkitAudioContext(); 
//     var sh = new Scheduler(audioContext);
// 
//     // Start it running.
//     sh.running = true;
// 
//     // "print" makes a scheduler action that will 
//     // print the given message.
//     function print(msg) {
//         return sh.fire(function (clock) {
//             console.log(msg);
//         });
//     }
// 
//     // Using the scheduler's "track" combinator, make an 
//     // action that says "two" should follow "one" after 
//     // 3 seconds.
//     var one_and_two = sh.track( print("one")
//                               , sh.delay(3.0)
//                               , print("two") 
//                               );
// 
//     // "Play" it.
//     sh.play(one_and_two);
// 
// 
// In order to help make sound models composeable in time, the `Scheduler`
// separates the *specification* of temporal behaviour from the realization of the
// specification. This is a different design from the conventional notion of a
// scheduler whose interface is thought to be "make event E happen at time T".
// Instead, the separation of specification from realization encourages the sound
// model designer to think in terms of the temporal relationship between the sonic
// elements that play a part in its output. For example, when we want event B to
// happen DT seconds after event A, with a conventional scheduler we need to say
// "make A happen at T1 and B happen at T1+DT". What we want to do is to state the
// interval relationship between the two events and leave it to the context in
// which these two events are used to decide what T1 must be. This then lets a
// higher level sound model then say "AB must follow 1.5 seconds after C", when
// treating AB as a single unit.
// 
// The methods of the `Scheduler` object therefore create such specifications - or
// "actions" - often using other specifications. There is a single `play` function
// that realizes a given action.
// 
// The scheduler determines timing for the events using `Clock` objects. A clock
// object is passed between events that are declared to be part of a single
// temporal sequence - a.k.a. "track". The time of the clock advances as it is
// passed between consecutive events in a track. You can have multiple tracks that
// can be `spawn`ed or `fork`ed to run in parallel. Each such parallel track gets
// its own clock object, which enables such tracks to have their own timing
// characteristics. 


// # The Steller API
//
// With the above summary, we move on to the specifics of the Steller API.
// To start with, the Steller API is exposed as a global "package" named
// `org.anclab.steller`. So, for example, you access the `GraphNode` transformer 
// as `org.anclab.steller.GraphNode`.

try { org = org || {}; } catch (e) { org = {}; }
org.anclab = org.anclab || {};
org.anclab.steller = org.anclab.steller || {};

(function (window, steller) {

    //
    // ## SoundModel
    //
    // A "sound model" is a graph node with support for parameters.
    //
    // `obj` is the object to turn into a "sound model"
    // 
    // `inputs` is the array of graph nodes (or sound models) that constitute
    // the input for this model.
    //
    // `outputs` is the array of graph nodes (or sound models) that constitute
    // the output for this model.
    //
    // By making the inputs and outputs explicit, we can make
    // sound models whose output can be piped through other models
    // before it hits the audio context's destination.
    //
    // Sound models are scheduled using the Scheduler (org.anclab.steller.Scheduler)
    //
    var SoundModel = GraphNode;

    //
    // ## GraphNode
    //
    // Makes an object into a node that can be used in a signal
    // processing graph with the Web Audio API.
    // 
    // node = an object that you want to quack like a node.
    // inputs = array of nodes that have open inputs in the graph.
    // outputs = array of nodes that have open outputs in the graph.
    //
    // For simplicity. I provide a "strict" version of multichannel
    // support for illustration, but you may want something
    // smarter with auto-fanout, auto-mixdown, etc.
    //
    // Note that the graphNode is compositional in nature - i.e. you can
    // treat smaller node graphs as nodes in a larger nor graph, which is what 
    // you want, I guess.
    // 
    // The above implementation has a disadvantage due to the fact that the 
    // protocol for determining pins *inside* an AudioNode is not exposed. 
    // Therefore you can connect the output of a wrapped node to an input of 
    // a regular AudioNode, but not vice versa. However, you can wrap any
    // plain AudioNode `n` using `GraphNode({}, [n], [n])` after which
    // you'll have to deal with only wrapped nodes ... and all is well :)
    // 
    // Of course, if you're wrapping all audio nodes anyway, you're free to
    // depart from the "connect" protocol and implement it any way you like :D
    //
    function GraphNode(node, inputs, outputs) {
        node.inputs             = inputs || [];
        node.outputs            = outputs || [];

        node.numberOfInputs     = node.inputs.length;
        node.numberOfOutputs    = node.outputs.length;
        console.assert(node.numberOfInputs + node.numberOfOutputs > 0);

        // Get the audio context this graph is a part of.
        node.context = (node.inputs[0] && node.inputs[0].context) || (node.outputs[0] && node.outputs[0].context);
        console.assert(node.context);

        // ### connect
        //
        // Same function signature as with the Web Audio API's [AudioNode].
        //
        // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
        node.connect = function (target, outIx, inIx) {
            var i, N, inPin, outPin;

            /* If the target is not specified, then it defaults to the destination node. */
            target = target || node.context.destination;

            /* Set default output pin indices to 0. */
            outIx = outIx || 0;
            inIx = inIx || 0;
            outPin = node.outputs[outIx];

            /* The "receiving pin" could be a simple AudioNode
             * instead of a wrapped one. */
            inPin = target.inputs ? target.inputs[inIx] : target;

            if (inPin.constructor.name === 'AudioParam' || inPin.constructor.name === 'AudioGain') {
                // a-rate connection.
                outPin.connect(inPin);
            } else if (inPin.numberOfInputs === outPin.numberOfOutputs) {
                for (i = 0, N = inPin.numberOfInputs; i < N; ++i) {
                    outPin.connect(inPin, i, i);
                }
            } else {
                outPin.connect(inPin);
            }

            return node;
        };

        // ### disconnect
        //
        // Same function signature as with the Web Audio API's [AudioNode].
        // ... but we also support providing the pin numbers to disconnect
        // as arguments.
        //
        // [AudioNode]: https://dvcs.w3.org/hg/audio/raw-file/tip/webaudio/specification.html#AudioNode-section
        node.disconnect = function () {
            if (arguments.length > 0) {
                /* Disconnect only the output pin numbers identified in
                 * the arguments list. */
                Array.prototype.forEach.call(arguments, function (n) {
                    node.outputs[n].disconnect();
                });
            } else {
                /* Disconnect all output pins. This is also the 
                 * behaviour of AudioNode.disconnect() */
                node.outputs.forEach(function (n) { n.disconnect(); });
            }

            return node;
        };

        // ### keep and drop
        //
        // Javascript audio nodes need to be kept around in order to prevent them
        // from being garbage collected. This is a bug in the current system and
        // `keep` and `drop` are a temporary solution to this problem. However,
        // you can also use them to keep around other nodes.

        var preservedNodes = [];

        node.keep = function (node) {
            preservedNodes.push(node);
            return node;
        };

        node.drop = function (node) {
            preservedNodes = preservedNodes.filter(function (n) { return n !== node; });
        };

        return node;
    }

    // Takes an array of nodes and connects them up in a chain.
    GraphNode.chain = function (nodes) {
        var i, N;
        for (i = 0, N = nodes.length - 1; i < N; ++i) {
            nodes[i].connect(nodes[i+1]);
        }
        return GraphNode;
    };


    // Utility for prohibiting parameter names such as "constructor",
    // "hasOwnProperty", etc.
    var dummyObject = {params: true, length: 1};
    function validName(name) {
        if (dummyObject[name]) {
            throw new Error("Invalid param name [" + name + "]");
        }

        return name;
    }

    //
    // Param(spec)
    //
    // A "class" that reifies a model parameter as an independent object.
    // You create a parameter like this -
    //      model.paramName = Param({min: 0, max: 1, value: 0.5});
    //      model.paramName = Param({min: 0, max: 1, audioParam: anAudioParam});
    //      model.paramName = Param({min: 0, max: 1, getter: g, setter: s});
    //      model.paramName = Param({options: ["one", "two", "three"], value: "one"});
    //
    // You can use Param.names(model) to get the exposed parameter names.
    //
    // You can get and set the value of a parameter like this -
    //      model.paramName.value = 5;
    //
    // You can install a callback to be called when a parameter value changes -
    //      model.paramName.watch(function (value, param) { ... });
    //      model.paramName.unwatch(callback);
    //      model.paramName.unwatch(); // Removes all callbacks.
    //
    function Param(spec) {
        var self = Object.create(Param.prototype);
        self.spec = spec = processOptionsParam(Object.create(spec));
        self.getter = undefined;
        self.setter = undefined;
        self.valueOf = undefined;       // Support for valueOf() protocol.
        self.audioParam = undefined;
        self.watchers = [];             // Maintain a per-parameter list of watchers.
        self._value = undefined;

        // Initialization.
        if (spec.audioParam) {
            self.audioParam = spec.audioParam;
            self.getter = spec.getter || Param.getters.audioParam;
            self.setter = spec.setter || Param.setters.audioParam;
        } else if (spec.options) {
            self.getter = spec.getter || Param.getters.value;
            self.setter = spec.setter || Param.setters.option;
        } else {
            self.getter = spec.getter || Param.getters.value;
            self.setter = spec.setter || Param.setters.value;
        }

        self.valueOf = self.getter;

        if ('value' in spec) {
            self.setter(spec.value);
        }

        return self;
    }

    // Take care of enumeration or "options" parameters.
    function processOptionsParam(spec) {
        if (spec.options) {
            var hash = {};
            spec.options.forEach(function (o, i) {
                hash['option:' + o] = i + 1;
            });

            // Set a limiting function that validates the
            // value being assigned to the parameter.
            spec.limit = function (val) {
                if (typeof val === 'number') {
                    if (val >= 0 && val < spec.options.length) {
                        return spec.options[val];
                    } 

                    throw new Error('Invalid enumeration index');
                } 
                
                if (hash['option:' + val]) {
                    return val;
                }

                throw new Error('Invalid enumeration value');
            };
        }
        return spec;
    }

    Param.getters = {
        value: function () {
            return this._value;
        },
        audioParam: function () {
            return this.audioParam.value;
        }
    };

    Param.setters = {
        value: function (v) {
            return (this._value = v);
        },
        audioParam: function (v) {
            return (this.audioParam.value = v);
        },
        option: function (v) {
            return (this._value = this.spec.limit(v));
        }
    };

    // Use for "mapping:" field of spec. This is not used internally at all, but
    // intended for UI use.
    Param.mappings = {};

    // Condition: spec.max > spec.min
    Param.mappings.linear = {
        fromNorm: function (p, f) {
            return p.spec.min + f * (p.spec.max - p.spec.min);
        },
        toNorm: function (p) {
            return (p.value - p.spec.min) / (p.spec.max - p.spec.min);
        }
    };

    // Condition: spec.max > spec.min > 0
    Param.mappings.log = {
        fromNorm: function (p, f) {
            var spec = p.spec;
            var lmin = Math.log(spec.min);
            var lmax = Math.log(spec.max);
            return Math.exp(lmin + f * (lmax - lmin));
        },
        toNorm: function (p) {
            var spec = p.spec;
            var lmin = Math.log(spec.min);
            var lmax = Math.log(spec.max);
            var lval = Math.log(p.value);
            return (lval - lmin) / (lmax - lmin);
        }
    };

    // Returns the names of all the exposed parameters of obj.
    Param.names = function (obj) {
        return Object.keys(obj).filter(function (k) {
            return obj[k] instanceof Param;
        });
    };

    // Exposes parameters of obj1 through obj2 as well.
    // `listOfParamNames`, if given, should be an array
    // of only those parameters that must be exposed.
    Param.expose = function (obj1, obj2, listOfParamNames) {
        if (!listOfParamNames) {
            listOfParamNames = Param.names(obj1);
        }

        listOfParamNames.forEach(function (n) {
            if (n in obj2) {
                console.error('WARNING: Overwriting parameter named [' + n + '] in Param.expose call.');
            }
            obj2[n] = obj1[n];
        });

        return Param;
    };

    // Bind one parameter to another. p2 is expected to 
    // be a parameter. If p1 is a parameter, then bind sets
    // things up so that updating p1 will cause p2 to be updated
    // to the same value. If p1 is just a value, then bind() simply
    // assigns its value to p2 once.
    //
    // This is similar in functionality to param.bind(p2), except that
    // it also works when p1 is not a parameter and is, say, an
    // audioParam or a normal numeric value.
    Param.bind = function (p1, p2, sh) {
        if (p1 instanceof Param) {
            p1.bind(p2, sh);
        } else if ('value' in p1) {
            if (sh) {
                sh.update(function () {
                    p2.value = p1.value;
                });
            } else {
                p2.value = p1.value;
            }
        } else {
            if (sh) {
                sh.update(function () {
                    p2.value = p1;
                });
            } else {
                p2.value = p1;
            }
        }

        return Param;
    };

    // To get the value of a parameter p, use p.value
    Param.prototype.__defineGetter__('value', function () {
        return this.getter();
    });

    // To set the value of a parameter p, do 
    //      p.value = v;
    Param.prototype.__defineSetter__('value', function (val) {
        if (val !== this.getter()) {
            return observeParam(this, this.setter(val));
        } else {
            return val;
        }
    });

    function observeParam(param, val) {
        var i, N, watchers = param.watchers;
        for (i = 0, N = watchers.length; i < N; ++i) {
            watchers[i](val, param);
        }
        return val;
    }

    // Installs a callback that gets called whenever the parameter's
    // value changes. The callback is called like this -
    //      callback(value, paramObject);
    Param.prototype.watch = function (callback) {
        var i, N, watchers = this.watchers;

        /* Make sure the callback isn't already installed. */
        for (i = 0, N = watchers.length; i < N; ++i) {
            if (watchers[i] === callback) {
                return this;
            }
        }

        watchers.push(callback);
        return this;
    };

    // Removes the given callback, or if none given removes
    // all installed watchers.
    Param.prototype.unwatch = function (callback) {
        var watchers = this.watchers;

        if (arguments.length < 1 || !callback) {
            /* Remove all watchers. */
            watchers.splice(0, watchers.length);
            return this;
        }

        /* Remove the installed watcher. Note that we only need
         * to check for one watcher because watch() will never 
         * add duplicates. */
        for (var i = watchers.length - 1; i >= 0; --i) {
            if (watchers[i] === callback) {
                watchers.splice(i, 1);
                return this;
            }
        }

        return this;
    };

    // Can call to force an observer notification.
    Param.prototype.changed = function () {
        observeParam(this, this.getter());
        return this;
    };

    // Makes an "alias" parameter - i.e. a parameter that 
    // represents the same value, but has a different name.
    // The alias is constructed such that p.alias("m").alias("n")
    // is equivalent to p.alias("n") - i.e. the original
    // parameter is the one being aliased all the time.
    Param.prototype.alias = function (name, label) {
        console.assert(name); // If name is not given, no point in calling alias().
        var self = this;

        // Inherit from the original.
        var p = Object.create(self);

        // Rename it.
        p.spec = Object.create(self.spec);
        p.spec.name = name;
        if (label) {
            p.spec.label = label;
        }

        // Bind core methods to the original.
        p.getter = function () { return self.getter(); };
        p.setter = function (val) { return self.setter(val); };
        p.alias = function (name, label) { return self.alias(name, label); };

        return p;
    };

    // Binds a parameter to the given element's value.
    // Whetever the element changes, the parameter will be updated
    // and whenever the parameter is assigned, the element will also
    // be updated.
    //
    // The "element" can be a DOM element such as a slider, or 
    // anything with a '.value' that needs to be updated with the
    // latest value of this parameter whenever it happens to change.
    // If it is a DOM element, the parameter is setup to update to
    // the value of the DOM element as well.
    //
    // If you pass a string for `elem`, it is taken to be a DOM
    // element identifier and will be used via querySelectorAll to
    // find which elements it refers to and bind to all of them.
    Param.prototype.bind = function (elem, sh) {
        var param = this;
        if (elem.addEventListener) {
            var spec = param.spec;
            var mapfn = spec.mapping ? Param.mappings[spec.mapping] : Param.mappings.linear;
            var updater;

            var onchange, updateElem;
            if (elem.type === 'checkbox') {
                updater = function () {
                    param.value = elem.checked ? 1 : 0;
                };

                onchange = sh ? (function () { sh.update(updater); }) : updater;

                updateElem = function (v) {
                    elem.checked = v ? true : false;
                };
            } else if (elem.type === 'range') {
                updater = function () {
                    param.value = mapfn.fromNorm(param, parseFloat(elem.value));
                };

                onchange = sh ? (function () { sh.update(updater); }) : updater;

                updateElem = function (v) {
                    elem.value = mapfn.toNorm(param);
                };
            } else {
                throw new Error('org.anclab.steller.Param.bind: Unsupported control type - ' + elem.type);
            }

            updateElem.elem = elem;
            updateElem.unbind = function () {
                elem.removeEventListener(onchange);
                param.unwatch(updateElem);
            };

            elem.addEventListener('change', onchange);
            param.watch(updateElem);
            updateElem(param.value);
        } else if (typeof elem === 'string') {
            var elems = document.querySelectorAll(elem);
            var i, N;
            for (i = 0, N = elems.length; i < N; ++i) {
                this.bind(elems[i]);
            }
        } else {
            function updateValueElem(v) {
                elem.value = v;
            }

            updateValueElem.elem = elem;
            updateValueElem.unbind = function () {
                param.unwatch(updateValueElem);
            };

            param.watch(updateValueElem);
            elem.value = param.value;
        }

        return this;
    };

    // Removes binding to element, where `elem` is the
    // same kind as for `.bind(elem)` above.
    Param.prototype.unbind = function (elem) {
        if (typeof elem === 'string') {
            var elems = document.querySelectorAll(elem);
            var i, N;
            for (i = 0, N = elems.length; i < N; ++i) {
                this.unbind(elems[i]);
            }
        } else {
            var i, N, watchers = this.watchers;
            for (i = 0, N = watchers.length; i < N; ++i) {
                if (watchers[i].elem === elem) {
                    watchers[i].unbind();
                    return this;
                }
            }
        }

        return this;
    };

    // A simple Queue class with the intention to minimize
    // memory allocation just for the sake of queue processing.
    function Queue(name) {
        var length = 0,
            maxLength = 4,
            store = [null,null,null,null],
            removeAt = -1,
            addAt = 0;


        // Add an element to the queue.
        function add(x) {
            if (length >= maxLength) {
                // Grow store
                var newStore = new Array(maxLength * 2);
                var i, j, N, M;
                for (i = removeAt, j = 0, N = length, M = maxLength; j < N; ++j, i = (i + 1) % M) {
                    newStore[j] = store[i];
                }
                store = newStore;
                addAt = length;
                removeAt = length === 0 ? -1 : 0;
                maxLength *= 2;
            }

            // Add element.
            store[addAt] = x;
            if (removeAt < 0) {
                removeAt = addAt;
            }
            addAt = (addAt + 1) % maxLength;

            return this.length = length = (length + 1);
        }

        // Remove an element from the queue.
        // Throws an exception when the queue is empty.
        function remove() {
            if (length <= 0) {
                throw new Error('Empty queue');
            }

            var x = store[removeAt];
            store[removeAt] = null; // Needed for garbage collector friendliness.
            removeAt = (removeAt + 1) % maxLength;
            this.length = length = (length - 1);

            return x;
        }

        // Remove all elements.
        function clear() {
            this.length = length = 0;
            store.splice(0, store.length, null, null, null, null);
            maxLength = 4;
            removeAt = -1;
            addAt = 0;
        }

        // Length is kept up to date.
        this.length = 0;

        this.add = add;
        this.remove = remove;
        this.clear = clear;

        return this;
    }

    //
    // ## Scheduler
    //
    // This is a scheduler for "models" .. which are functions
    // of the form --
    // 
    //      function (sched, clock, next) {
    //           // ... do something
    //           next(sched, clock, sched.stop); // Go to the next one (optional).
    //       }
    //
    // where --
    // 
    //   - `sched` is the scheduler object.
    //   - `clock` is the clock object containing absolute and rate integrated 
    //     time information for this interval.
    //   - `next` is the model that is supposed to follow this one in time.
    // 
    // To use the scheduler, you first make an instance using "new".
    //
    //      var sh = new Scheduler;
    //
    // Then you start it running by setting the 'running' property to true.
    //
    //      sh.running = true;
    //
    // Then you can play models already. Here is something that will keep
    // outputting 'fizz', 'buzz' alternately every 2 seconds.
    //
    //      var dur = Param({min: 0.01, max: 60, value: 2});
    //      var fizzbuzz = sh.loop(sh.track([
    //          sh.log('fizz'), sh.delay(dur),
    //          sh.log('buzz'), sh.delay(dur)
    //      ]));
    //      sh.play(fizzbuzz);
    // 
    // Now try changing the value of the duration parameter p.dur like below
    // while the fizzes and buzzes are being printed out --
    //      
    //      dur.value = 1
    //
    function Scheduler(audioContext, options) {
        /* Make sure we don't clobber the global namespace accidentally. */
        var self = (this === window ? {} : this);
        var Timer = PeriodicTimer; // or JSNodeTimer

        // We need requestAnimationFrame when scheduling visual animations.
        var requestAnimationFrame = getRequestAnimationFrameFunc();

        var AudioContext = getAudioContext();

        if (detectBrowserEnv() && !requestAnimationFrame) {
            throw new Error('Scheduler needs requestAnimationFrame support. Use a sufficiently modern browser version.');
        }

        /* How long is an "instant"? */
        var instant_secs = 0.001;

        /* Wrap Date.now() or audioContext.currentTime as appropriate.
         * The scheduler supports both mechanisms for tracking time. */
        var time_secs = (function () {
            if (!audioContext) {
                return getHighResPerfTimeFunc() || (function () { return Date.now() * 0.001; });
            } else if (audioContext instanceof AudioContext) {
                instant_secs = 1 / audioContext.sampleRate;
                audioContext.createGainNode();  // Looks useless, but it gets the
                                                // audioContext.currentTime running.
                                                // Otherwise currentTime continues to
                                                // be at 0 till some API call gets made,
                                                // it looks like.

                return function () {
                    return audioContext.currentTime;
                };
            } else {
                throw new Error("Scheduler: Argument is not an audio context");
            }
        }());


        var timer, running = false;

        // To start the scheduler, set "scheduler.running = true"
        // To stop it, set it to false.
        self.__defineGetter__('running', function () { return running; });
        self.__defineSetter__('running', function (state) {
            if (state) {
                if (!running) {
                    running = true;
                    mainClock.advanceTo(time_secs());
                    timer.start();
                }
            } else {
                running = false;
                timer.stop();
            }
        });

        // A frame rate observer that gets updated once in a while.
        // If you want to update a display when frame rate changes,
        // add a watcher.
        self.frame_rate = Param({min: 15, max: 75, value: 60});

        // Scheduled actions are placed in an event tick queue. The queue is
        // processed on each `scheduleTick()`.  A pair of arrays used as the
        // event tick queue.  Models placed in queue are processed and the
        // resultant models scheduled go into the requeue. Then after one such
        // cycle, the variables are swapped.
        var queue = new Queue('tick');

        // The frame queue is for running visual frame calculations after
        // the normal scheduling loop has finished. This runs *every*
        // scheduleTick.
        var fqueue = new Queue('frames');

        // Update queue. This can be used to synchronize parameter changes.
        var uqueue = new Queue('update');

        // Cancels all currently running actions.
        function cancel() {
            uqueue.clear();
            queue.clear();
            fqueue.clear();
        }

        // `scheduleTick` needs to be called with good solid regularity.
        // If we're running the scheduler under node.js, it can only
        // be because MIDI is needed, which needs high precision,
        // indicated by 0. The `PeriodicTimer` and `JSNodeTimer` encapsulate
        // this timing functionality required.
        timer = new Timer(scheduleTick, 0, audioContext);

        /* Keep track of time. */
        var kFrameInterval = 1/60;
        var kFrameAdvance = kFrameInterval;
        var clockDt = timer.computeAheadInterval_secs || 0.05; // Use a 60Hz time step.
        var clockBigDt = clockDt * 5; // A larger 10Hz time step.
        var mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
        var compute_upto_secs = mainClock.t1;
        var advanceDt = 0.0;

        // A simple mechanism to adjust the "frame rate". Normally, this
        // shouldn't be necessary, but given that we're operating audio and
        // visuals in the same framework, the notion of a steady frame rate is
        // needed to predict when to render stuff and how much further to
        // compute. We compute audio 3 callbacks ahead of time.
        //
        // runningFrameInterval is the low pass filtered frame interval. The
        // time constant of the filter is of the order of a second, so that
        // instantaneous changes to frame rate don't disrupt the rate for just
        // a few frames.
        var adaptFrameInterval = (function () {
            var runningFrameInterval = 1/60;
            var lastTickTime_secs = mainClock.t1;

            // Steller can periodically update the 'frame_rate' property
            // (which is actually a Param). You can watch it for changes
            // if you want.
            var frUpdateInterval = 15;
            var frUpdateCounter = frUpdateInterval;

            return function (t) {
                // Adjust the notion of frame interval if the going rate is smooth.
                var frameDt = t - lastTickTime_secs;
                if (frameDt > 0.01 && frameDt < 0.07) {
                    runningFrameInterval += 0.05 * (frameDt - runningFrameInterval);
                    kFrameAdvance = kFrameInterval = runningFrameInterval;
                    clockDt = 3.33 * kFrameInterval;
                    clockBigDt = clockDt * 5;
                    if (frUpdateCounter-- <= 0) {
                        self.frame_rate.value = Math.round(1/kFrameInterval);
                        frUpdateCounter = frUpdateInterval;
                    }
                }

                lastTickTime_secs = t;
            };
        }());

        /* Main scheduling work happens here.  */
        function scheduleTick() {
            var i, N, t, length, f, a, once = true;
            t = time_secs();

            adaptFrameInterval(t);

            // Determine target time up to which we need to compute.
            compute_upto_secs = t + clockDt;

            /* If lagging behind, advance time before processing models. */
            while (t - mainClock.t1 > clockBigDt) {
                advanceDt = t - mainClock.t1;
                mainClock.advance(advanceDt);
            }

            while (once || mainClock.t1 < compute_upto_secs) {
                if (uqueue.length > 0) {
                    length = uqueue.length;
                    for (i = 0; i < length; ++i) {
                        uqueue.remove()();
                    }
                }

                // Process no more than the existing number of elements
                // in the queue. Do not process any newly added elements
                length = queue.length;

                /* Process the scheduled tickers. The tickers
                 * will know to schedule themselves and for that
                 * we pass them the scheduler itself.
                 */
                for (i = 0; i < length; ++i) {
                    queue.remove()(self, mainClock, cont);
                }

                if (mainClock.t1 < compute_upto_secs) {
                    mainClock.tick();
                }

                advanceDt = 0.0;
                once = false;
            }

            if (fqueue.length > 0) {
                length = fqueue.length;

                for (i = 0; i < length; i += 2) {
                    f = fqueue.remove();
                    a = fqueue.remove();
                    f(t, a);
                }
            }

            // Finally, if there is an ontick handler installed, we call
            // that for every tick, passing it the current time.
            if (self.ontick) {
                self.ontick(t);
            }
        }

        // Schedules the model by placing it into the processing queue.
        function schedule(model) {
            if (model) {
                queue.add(model);
            }
        }

        // Schedules a "frame computation" which will run every scheduleTick
        // regardless of how much ahead the rest of the scheduler is running.
        //
        // f is expected to be a function and will be called with no arguments.
        function scheduleFrame(f, info) {
            if (f) {
                fqueue.add(f);
                fqueue.add(info);
            }
        }

        // Makes sure f is called before the next schedule.
        function scheduleUpdate(f) {
            if (f) {
                uqueue.add(f);
            }
        }

        // ### perform
        //
        // Wraps the concept of "performing" a model so that
        // the representation of the model as a continuation 
        // is not strewn all over the place. 
        function perform(model, clock, next) {
            model(self, clock, next);
        }

        // ### play
        //
        // Having constructed a model, you use play() to play it.
        // The playing starts immediately. See `delay` below if you want
        // the model to start playing some time in the future.
        function playNow(model) {
            model(self, mainClock.copy(), stop);
        }

        var play = (function () {
            if (audioContext) {
                /* waitForAudioClockStartAndPlay will play the given model only
                 * after the audio clock has advanced beyond zero.  This can
                 * take some time on iOS6. This is necessary for Web Audio API
                 * on iOS6. Sadly, as of this writing, (22 Sep 2012), this
                 * technique is sufficient only for iOS6 on iPhone4. Safari on
                 * iPad doesn't work even with this wait in place. 
                 */
                return function waitForAudioClockStartAndPlay(model) {
                    if (audioContext.currentTime === 0) {
                        setTimeout(waitForAudioClockStartAndPlay, 100, model);
                    } else {
                        mainClock = new Clock(time_secs(), 0, clockDt, 1.0);
                        compute_upto_secs = mainClock.t1;
                        self.play = play = playNow;
                        playNow(model);
                    }
                };
            } else {
                return playNow;
            }
        }());

        // ### stop
        //
        // This "model" says "stop right here, nothing more to do."
        // This is the "zero" of the algebra. No model placed after a stop
        // in a sequence will get to run.
        function stop(sched, clock, next) {
        }

        // ### cont
        //
        // This "model" just says "continue on with whatever's next".
        // This is the "one" of the algebra. Placing it anywhere in
        // a sequence has no consequence on it.
        function cont(sched, clock, next) {
            if (next) {
                next(sched, clock, stop);
            }
        }

        // ### delay
        //
        //      delay(dt)
        //      delay(dt, function (clock, t1r, t2r, startTime, endTime) {...})
        //
        // Gives a model that introduces the given amount of delay in a
        // sequence. Notice that the "valueOf" protocol on dt is used. This
        // lets us introduce fixed as well as variable delays. This is the
        // absolute *core* of the "scheduler" since it is the only function
        // which actually does something about invoking stuff at a specified
        // time! Any optimization of the scheduling loop will also involve this
        // function and, likely, this one *only*.
        //
        // Example:
        //
        //      sh.play(sh.track(sh.delay(1), model))
        //
        // Will cause the model to play after 1 second.
        //
        // If callback is provided, it will be called throughout the wait
        // period with the arguments (t1, t2, startTime, endTime) giving the
        // interval for which it is being called. Continuous parameter
        // animations can be handled using the callback, for example.
        function delay(dt, callback) {
            return function (sched, clock, next) {
                var startTime = clock.t1r;

                function tick(sched, clock) {
                    var endTime = startTime + dt.valueOf();

                    // If lagging behind, advance time before processing models.
                    // If, say, the user switched tabs and got back while
                    // the scheduler is locked to a delay, then all the pending
                    // delays need to be advanced by exactly the same amount.
                    // The way to determine this amount is to keep track of
                    // the time interval between the previous call and the
                    // current one. That value is guaranteed to be the same
                    // for all delays active within a single scheduleTick().
                    //
                    // Furthermore, the delay needs to be cryo-frozen frozen
                    // during the lapse and then thawed when the playback
                    // resumes. This also entails adjustment of the startTime
                    // and endTime so everything stays in sync. This results in
                    // an adjustment of the "past" of the delay to be consistent
                    // with the present and the future.
                    if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                        clock.advance(advanceDt);
                    }

                    if (clock.t1 > compute_upto_secs) {
                        // We're already ahead of time. Wait before
                        // computing further ahead.
                        schedule(poll);
                        return;
                    }

                    if (clock.t2r < endTime) {
                        if (callback) {
                            callback(clock, clock.t1r, clock.t2r, startTime, endTime);
                        }
                        clock.tick();
                        schedule(poll);
                    } else {
                        if (callback && endTime >= clock.t1r) {
                            callback(clock, clock.t1r, endTime, startTime, endTime);
                        }
                        if (clock.t2r > clock.t1r) {
                            next(sched, clock.nudgeToRel(endTime), stop);
                        } else {
                            next(sched, clock, stop);
                        }
                    }
                }

                function poll(sched) {
                    tick(sched, clock, stop);
                }

                tick(sched, clock);
            };
        }

        // ### seq (internal)
        //
        // The two given models will be performed in sequence.
        // When the first model ends, it will transfer control
        // to the second model. 
        //
        // Note: This is an internal combinator exposed via the
        // more convenient "track".
        function seq(model1, model2) {
            return function (sched, clock, next) {
                model1(sched, clock, seq(model2, next));
            };
        }

        // ### loop
        //
        // Here is a model that will never end. The given model
        // will be looped forever. You better have a delay in 
        // there or you'll get an infinite loop or blow the stack
        // or something like that.
        function loop(model) {
            return function looper(sched, clock, next) {
                model(sched, clock, looper);
            };
        }

        // ### loop_while(flag, model)
        //
        // Keeps executing model in a loop as long as flag.valueOf() is truthy.
        function loop_while(flag, model) {
            return function (sched, clock, next) {

                function loopWhileFlag() {
                    if (flag.valueOf()) {
                        model(sched, clock, loopWhileFlag);
                    } else {
                        next(sched, clock, stop);
                    }
                }

                loopWhileFlag();
            };
        }

        // ### repeat(n, model)
        //
        // Produces a model that, when played, repeats the model `n` times.
        // This means that the duration of the resultant model will be
        // n times the duration of the given model (if it is a constant).
        function repeat(n, model) {
            return function (sched, clock, next) {
                var counter = 0;

                function repeatNTimes() {
                    if (counter < n) {
                        counter++;
                        model(sched, clock, repeatNTimes);
                    } else {
                        next(sched, clock, stop);
                    }
                }

                repeatNTimes();
            };
        }

        // ### fork
        //
        // The models in the given array are spawned off simultanously.
        // When all the models finish their work, the fork will
        // continue on with whatever comes next.
        //
        //  Ex: 
        //
        //      sh.play(sh.track(sh.fork([drumpat1, drumpat2]), drumpat3));
        //
        // That will cause pat1 to be played simultaneously with pat2
        // and when both finish, pat3 will play.
        //
        // Supports both `fork(a, b, c, ..)` and `fork([a, b, c, ..])` forms.
        //
        function fork(models) {
            if (models && models.constructor === Function) {
                /* We're given the models as arguments instead of an array. */
                models = Array.prototype.slice.call(arguments, 0);
            } else {
                models = models.slice(0);
            }
            return function (sched, clock, next) {
                var syncCount = 0;
                function join(sched, clockJ) {
                    syncCount++;
                    if (syncCount === models.length) {
                        /* All models have finished. */
                        next(sched, clock.syncWith(clockJ), stop);
                    }
                }

                /* Start off all models. */
                models.forEach(function (model) {
                    model(sched, clock.copy(), join);
                });
            };
        }

        // ### spawn
        //
        // Similar to `fork`, except that the `spawn` will immediately
        // continue on with whatever is next, as though its duration
        // is zero.
        //
        // Supports both `spawn(a, b, c, ..)` and `spawn([a, b, c, ..])` forms.
        function spawn(models) {
            if (models && models.constructor === Function) {
                /* We're given the models as arguments instead of an array. */
                models = Array.prototype.slice.call(arguments, 0);
            } else {
                models = models.slice(0);
            }
            return function (sched, clock, next) {
                models.forEach(function (model) {
                    model(sched, clock.copy(), stop);
                });
                next(sched, clock, stop);
            };
        }

        // ### dynamic
        //
        // A generic 'dynamic model', which determines the
        // model to use at any given time according to some
        // rule. 'dyn' is a `function (clock)` and is expected
        // to return a model, which is then scheduled. You can
        // use this, for example, to do random choices, conditional
        // choices, etc.
        function dynamic(dyn) {
            return function (sched, clock, next) {
                dyn(clock)(sched, clock, next);
            };
        }

        // ### track
        //
        // Produces a model that consists of a sequence of
        // the given models (given as an array of models).
        // 
        // `track([a,b,c,d])` is just short hand for
        // `seq(a, seq(b, seq(c, d)))`
        //
        // Supports both `track(a, b, c, ..)` and `track([a, b, c, ..])` forms.
        //
        // Note that the intermediate continuations are one-shot
        // and are not reusable for the sake of performance.
        function track(models) {
            if (models && models.constructor === Function) {
                /* We're given the models as arguments instead of an array. */
                models = Array.prototype.slice.call(arguments, 0);
            }

            function track_iter(sched, clock, next, startIndex, endIndex) {
                // The extra arguments are used by slice() to provide a playback
                // range for a given track. When the arguments are not given,
                // the whole track is played. Use track_iter.minIndex and maxIndex
                // to determine valid values for the index range.
                var i = 0, i_end = models.length;

                if (arguments.length > 3) {
                    console.assert(arguments.length === 5);
                    i = startIndex;
                    i_end = endIndex;
                }

                function iter(sched, clock, _) {
                    if (i < i_end) {
                        models[i++](sched, clock, iter);
                    } else {
                        next(sched, clock, stop);
                    }
                }

                iter(sched, clock, next);
            }

            // minIndex and maxIndex give the range of possible index values
            // for the track. The range is [minIndex, maxIndex).
            track_iter.minIndex = 0;
            track_iter.maxIndex = models.length;
            track_iter.models = models;

            return track_iter;
        }

        // ### slice(aTrack, startIndex, endIndex)
        //
        // Makes an action that will play the given slice of the track.
        // The `aTrack` is created using the `track()` method.
        // The given indices are constrained by the track's index range
        // as specified by aTrack.minIndex and aTrack.maxIndex.
        // 
        // If you want control of a track or a slice *while* it is playing,
        // you need to build synchronization mechanisms into it yourself.
        // See `sync()` and `gate()`.
        function slice(aTrack, startIndex, endIndex) {
            endIndex = (arguments.length > 2 ? endIndex : aTrack.maxIndex);
            startIndex = (arguments.length > 1 ? Math.max(aTrack.minIndex, Math.min(startIndex, endIndex)) : aTrack.minIndex);
            return function (sched, clock, next) {
                aTrack(sched, clock, next, startIndex, endIndex);
            };
        }

        // ### fire
        //
        // A model that simply fires the given call at the right time, takes
        // zero duration itself and moves on.
        var fire;
        if (options && options.diagnostics) {
            console.log("fire: diagnostics on");
            fire = function (callback) {
                return function (sched, clock, next) {
                    var t = time_secs();
                    if (clock.t1 < t) {
                        console.error('fire: Late by ' + Math.round(1000 * (t - clock.t1)) + ' ms');
                    }
                    callback(clock);
                    next(sched, clock, stop);
                };
            };
        } else {
            fire = function (callback) {
                return function (sched, clock, next) {
                    callback(clock);
                    next(sched, clock, stop);
                };
            };
        }

        // ### display
        //
        // Very similar to fire(), except that the given callback will be
        // called for the next visual frame. Consecutive display()s in a
        // track will result in their callbacks being bunched.
        //
        //      callback(clock, scheduledTime, currentTime)
        function display(callback) {
            return function (sched, clock, next) {
                var t1 = clock.t1;

                function show(t) { 
                    if (t + kFrameAdvance > t1) {
                        callback(clock, t1, t); 
                    } else {
                        // Not yet time to display it. Delay by one
                        // more frame.
                        scheduleFrame(show);
                    }
                }
                
                scheduleFrame(show);
                next(sched, clock, stop);
            };
        }

        // ### frame
        // 
        // Similar to fire() and display(), but actually lasts one frame
        // duration.  So consecutive frame() actions in a track can be used for
        // frame by frame animation. The frame will be delayed at the time at
        // which it actually needs to be displayed. The scheduler runs
        // computations a little bit into the future so this may need the frame
        // to be delayed by a few frames. The clock will always advance by one
        // frame duration between two consecutive frames.
        //
        // Due to the "sync to time" behaviour of frame(), the very first frame
        // in a sequence may be delayed by more than one frame. Subsequent
        // frames will occur (typically) with a single frame delay.
        //
        // The callback will receive a clock whose `t1` field is exactly the
        // same as the current time.
        function frame(callback) {
            return function (sched, clock, next) {
                var t1 = clock.t1;

                function show(t) {
                    if (t + kFrameAdvance > t1) {
                        clock.jumpTo(t);
                        callback(clock);
                        next(sched, clock, stop);
                    } else {
                        // Delay by one more frame. Keep doing this
                        // until clock syncs with the real time.
                        scheduleFrame(show);
                    }
                }

                scheduleFrame(show);
            };
        }

        // ### frames(duration, callback)
        //
        // Couples a regular delay with a scheduled series of callbacks for
        // visual animation. The animation calls occur forked relative to the
        // main schedule and will sync to real time irrespective of the amount
        // of "compute ahead" used for audio. Therefore the following actions
        // may begin to run a little before the requested series of callbacks
        // finish. However, if the following action is also a frames(), then 
        // that will occur strictly (?) after the current frames() finishes,
        // due to the "sync to real time" behaviour.
        //
        // Responds live to changes in `duration` if it is a parameter.
        function frames(dt, callback) {
            return function (sched, clock, next) {
                var startTime = clock.t1r;
                var animTime = startTime;
                var animTimeAbs = clock.t1;
                var animTick, animInfo;

                if (callback) {
                    animTick = function (t, info) {
                        if (info.intervals.length > 0) {
                            var t1 = info.intervals[0], t1r = info.intervals[1], t2r = info.intervals[2], r = info.intervals[3];
                            if (t1r <= info.endTime) {
                                if (t1 < kFrameAdvance + t) { 
                                    callback(info.clock, t1r, t2r, info.startTime, info.endTime, r);
                                    info.intervals.splice(0, 4);
                                }
                                scheduleFrame(animTick, info);
                                return;
                            } else {
                                // Animation ended.
                            }
                        }

                        if (!info.end) {
                            scheduleFrame(animTick, info);
                        }
                    };

                    animInfo = {clock: clock, intervals: [], startTime: clock.t1r, endTime: clock.t1r + dt.valueOf(), end: false};
                    scheduleFrame(animTick, animInfo);
                }

                function tick(sched, clock) {
                    var i, N, dtr, step;
                    var endTime = startTime + dt.valueOf();

                    // If lagging behind, advance time before processing models.
                    // If, say, the user switched tabs and got back while
                    // the scheduler is locked to a delay, then all the pending
                    // delays need to be advanced by exactly the same amount.
                    // The way to determine this amount is to keep track of
                    // the time interval between the previous call and the
                    // current one. That value is guaranteed to be the same
                    // for all delays active within a single scheduleTick().
                    //
                    // Furthermore, the delay needs to be cryo-frozen frozen
                    // during the lapse and then thawed when the playback
                    // resumes. This "cryo" is achieved by only adjusting the
                    // real time and leaving the rate integrated time untouched.
                    // That implies that "logically" nothing happened during the
                    // advance - i.e. the world skipped some seconds, without
                    // leaving a trace!
                    if (advanceDt > 0.0 && clock.t1 < mainClock.t1) {
                        clock.advance(advanceDt);

                        if (animInfo) {
                            animTimeAbs += step;

                            if (animInfo.intervals.length > 4) {
                                // Leave only one frame in the queue intact.
                                animInfo.intervals.splice(0, animInfo.intervals.length - 4);
                            }

                            if (animInfo.intervals.length > 0) {
                                animInfo.intervals[0] += step;
                                animInfo.intervals[3] = clock.rate.valueOf();
                            }
                        }
                    }

                    if (clock.t1 > compute_upto_secs) {
                        // We're already ahead of time. Wait before
                        // computing further ahead.
                        schedule(poll);
                        return;
                    }

                    if (animInfo && clock.t1r <= endTime) {
                        animInfo.endTime = endTime;
                        var frozenRate = clock.rate.valueOf();
                        dtr = Math.max(0.001, kFrameInterval * frozenRate);
                        while (animTime < clock.t2r) {
                            animInfo.intervals.push(animTimeAbs);
                            animInfo.intervals.push(animTime);
                            animInfo.intervals.push(animTime + dtr);
                            animInfo.intervals.push(frozenRate);
                            animTime += dtr;
                        }
                    }

                    if (clock.t2r < endTime) {
                        clock.tick();
                        schedule(poll);
                    } else {
                        animInfo.end = true;
                        if (clock.t2r > clock.t1r) {
                            next(sched, clock.nudgeToRel(endTime), stop);
                        } else {
                            next(sched, clock, stop);
                        }
                    }
                }

                function poll(sched) {
                    tick(sched, clock, stop);
                }

                tick(sched, clock);
            };
        }

        // ### log
        //
        // Useful logging utility.
        function log(msg) {
            return fire(function () {
                console.log(msg);
            });
        }

        // ### Parameter animation curves.
        //
        // #### anim(param, dur, func)
        // func is expected to be a function (t) where t is 
        // in the range [0,1]. The given parameter will be assigned
        // the value of the function over the given duration.
        //
        // #### anim(param, dur, v1, v2)
        // The parameter will be linearly interpolated over the given duration
        // starting with value v1 and ending with v2.
        //
        // #### anim(param, dur, v1, v2, interp)
        // The parameter will be interpolated from value v1 to value v2
        // over the given duration using the given interpolation function
        // interp(t) whose domain and range are both [0,1].
        //
        // #### Notes
        //
        // Note that animation curves have a duration so that you
        // can sequence different curves using track().
        // If you want a bunch of parameters to animate simultaneously,
        // you need to use spawn() or fork().
        //
        // Also remember that the "dur" parameter can be anything
        // that supports "valueOf" protocol. That said, be aware that
        // varying the duration can result in the parameter jumping
        // values due to large changes in the fractional time. Sometimes,
        // that might be exactly what you want and at other times that
        // may not be what you want.
        function anim(param, dur) {
            var v1, v2, func, afunc;
            switch (arguments.length) {
                case 3: /* Third argument must be a function. */
                    afunc = arguments[2];
                    break;
                case 4: /* Third and fourth arguments are starting
                         * and ending values over the duration. */
                    v1 = arguments[2];
                    v2 = arguments[3];
                    afunc = function (f) { 
                        return (1 - f ) * v1.valueOf() + f * v2.valueOf(); 
                    };
                    break;
                case 5: /* Third and fourth are v1, and v2 and fifth is
                         * a function(fractionalTime) whose return value is
                         * in the range [0,1] which is remapped to [v1,v2].
                         * i.e. the function is an interpolation function. */
                    v1 = arguments[2];
                    v2 = arguments[3];
                    func = arguments[4];
                    afunc = function (frac) { 
                        var f = func(frac);
                        return (1 - f) * v1.valueOf() + f * v2.valueOf();
                    };

                    break;
                default:
                    throw new Error("Invalid arguments to anim()");
            }

            if (param.constructor.name === 'AudioGain' || param.constructor.name === 'AudioParam') {
                // Use linear ramp for audio parameters.
                return delay(dur, function (clock, t1, t2, startTime, endTime) {
                    var dt = endTime - startTime;
                    var t1f, t2f;
                    if (t1 <= startTime) {
                        t1f = dt > instant_secs ? (t1 - startTime) / dt : 0;
                        param.setValueAtTime(afunc(t1f), clock.rel2abs(t1));
                    }

                    t2f = dt > instant_secs ? (t2 - startTime) / dt : 1;
                    param.linearRampToValueAtTime(afunc(t2f), clock.rel2abs(t2));
                });
            } else {
                return delay(dur, function (clock, t1, t2, startTime, endTime) {
                    // When animating a parameter, we need to account for the
                    // fact that we're generating only one value for the
                    // parameter per call. This means the first call should
                    // have a fractional time of 0 and the last one should have
                    // a fractional time of 1. We can make that happen if we
                    // assume that t2-t1 stays constant.
                    //
                    // The ideal behaviour would be to generate two values for
                    // each call and have the audio engine interpolate between
                    // them. The technique below serves as a stop-gap
                    // arrangement until then.
                    var dt = endTime - startTime - (t2 - t1);
                    if (dt > instant_secs) {
                        param.value = afunc((t1 - startTime) / dt);
                    } else {
                        // If we're generating only one value because the
                        // animation duration is very short, make it 
                        // the final value.
                        param.value = afunc(1);
                    }
                });
            }
        }

        // ### rate
        //
        // Changes the rate of progress of time through delays.  The given rate
        // "r" can be anything that supports the valueOf() protocol. The rate
        // value/parameter will flow along with the clock object that arrives
        // at this point - meaning it will affect all events that occur
        // sequenced with the rate control action. Note that fork() and spawn()
        // copy the clock before propagating. This means that each track within
        // a spawn/fork can have its own rate setting and that won't interfere
        // with the others. However, if you set a rate in the track that
        // contains the fork/spawn (and before them), the rate setting will
        // propagate to all the forked tracks by virtue of the clock copy.
        //
        // You need to be aware of whether the rate is being propagated "by
        // reference" or "by value". If the rate is a parameter, it gets
        // propagated by reference - i.e. changing the *value* of the rate
        // parameter in one track (clock.rate.value = num) affects the rate of
        // all the tracks that share the rate parameter. If it is a simple
        // number, then it gets propagated by value - i.e. "clock.rate = num" in
        // one track won't change the rate for the other tracks.
        function rate(r) {
            return function (sched, clock, next) {
                clock.rate = r;
                next(sched, clock, stop);
            };
        }

        // A dynamic model that randomly chooses one from the given array of models
        // every time it is played.
        function choice(models) {
            return dynamic(function () {
                return models[Math.floor(Math.random() * models.length)];
            });
        }

        // Simple synchronization facility. You make a sync action and use it
        // in your composition. Keep a reference around to it and call its
        // `.play` with a model that has to be started when the sync point is
        // hit. Multiple models played will all be `spawn`ed.
        function sync(N) {
            if (arguments.length > 0) {
                // If N is given, make that many syncs.
                return (function (i, N, syncs) {
                    for (; i < N; ++i) {
                        syncs.push(sync());
                    }
                    return syncs;
                }(0, N, []));
            }

            var models = [];

            function syncModel(sched, clock, next) {
                var i, N, actions;
                if (models.length > 0) {
                    actions = models;
                    models = [];
                    for (i = 0, N = actions.length; i < N; ++i) {
                        actions[i](sched, clock.copy(), stop);
                    }
                } 

                next(sched, clock, stop);
            }

            syncModel.play = function (model) {
                models.push(model);
                return this;
            };

            syncModel.cancel = function () {
                models.splice(0, models.length);
                return this;
            };

            return syncModel;
        }

        // ### gate()
        //
        // Another synchronization option. You make a gate and use it at
        // various points. You can then close() and open() gate. A newly
        // created gate doesn't block by default. 
        //
        // You can use gate() as a primitive to implement context aware
        // pause/resume. You make a `gate()` instance `g` first and introduce
        // it at appropriate points in your composition where you can allow it
        // to pause/resume. You can then pause your composition by calling
        // `g.close()` and resume it by calling `g.open()`.
        //
        // Other methods of a gate include - 
        //  
        //  - g.toggle() 
        //  - g.isOpen property gives open status of gate.
        //  - g.cancel() discards all pending resume actions.
        //      
        function gate(N) {
            if (arguments.length > 0) {
                // If N is given, make that many gates.
                return (function (i, N, gates) {
                    for (; i < N; ++i) {
                        gates.push(gate());
                    }
                    return gates;
                }(0, N, []));
            }

            var cache = [];
            var state_stack = [];
            var isOpen = true;

            function gateModel(sched, clock, next) {
                if (isOpen) {
                    next(sched, clock, stop);
                } else {
                    // Cache this and wait.
                    cache.push({sched: sched, next: next, clock: clock});
                }
            }

            function release(clock) {
                var actions = cache;
                var i, N, a, t = time_secs();
                cache = [];
                for (i = 0, N = actions.length; i < N; ++i) {
                    a = actions[i];
                    a.next(a.sched, clock ? clock.copy() : a.clock.advanceTo(t), stop);
                }
            }

            gateModel.__defineGetter__('isOpen', function () { return isOpen; });
            gateModel.__defineSetter__('isOpen', function (v) {
                if (v) {
                    gateModel.open();
                } else {
                    gateModel.close();
                }
                return v;
            });

            gateModel.open = function (sched, clock, next) {
                isOpen = true;
                release(clock);
                if (next) {
                    next(sched, clock, stop);
                }
            };

            gateModel.close = function (sched, clock, next) {
                isOpen = false;
                if (next) {
                    next(sched, clock, stop);
                }
            };

            gateModel.toggle = function (sched, clock, next) {
                if (isOpen) {
                    return gateModel.close(sched, clock, next);
                } else {
                    return gateModel.open(sched, clock, next);
                }
            };

            gateModel.cancel = function (sched, clock, next) {
                cache.splice(0, cache.length);
                if (next) {
                    next(sched, clock, stop);
                }
            };

            gateModel.push = function (sched, clock, next) {
                state_stack.push({isOpen: isOpen, cache: cache});
                cache = [];
                if (next) {
                    next(sched, clock, stop);
                }
            };

            gateModel.pop = function (sched, clock, next) {
                var state = state_stack.pop();
                cache.push.apply(cache, state.cache);
                this.isOpen = state.isOpen;
                if (next) {
                    next(sched, clock, stop);
                }
            };

            return gateModel;
        }

        function stats() {
            return {
                frame_jitter_ms: 0
            };
        }

        self.audioContext   = audioContext;
        self.update         = scheduleUpdate;
        self.perform        = perform;
        self.cancel         = cancel;
        self.play           = play;
        self.stop           = stop;
        self.cont           = cont;
        self.delay          = delay;
        self.loop           = loop;
        self.loop_while     = loop_while;
        self.repeat         = repeat;
        self.fork           = fork;
        self.spawn          = spawn;
        self.dynamic        = dynamic;
        self.track          = track;
        self.slice          = slice;
        self.fire           = fire;
        self.display        = display;
        self.frame          = frame;
        self.frames         = frames;
        self.log            = log;
        self.anim           = anim;
        self.rate           = rate;
        self.choice         = choice;
        self.sync           = sync;
        self.gate           = gate;
        self.stats          = stats;

        // Start the scheduler by default. I decided to do this because
        // so far on many occasions I've spent considerable time in 
        // debugging an unexpected outcome simply because I forgot to
        // start the scheduler. Shows I have an expectation that once
        // a "new Scheduler" is created, it is expected to be up and
        // running. Hence this choice of a default. If you really
        // need it to be quiet upon start, provide an "options.running = false"
        // in the second argument.
        self.running = (options && ('running' in options) && options.running) || true;

        // If the Models collection is available, instantiate it for
        // this scheduler so that the user won't have to bother doing that
        // separately.         
        if (org.anclab.steller.Models) {
            self.models = org.anclab.steller.Models(self);
        }

        return self;
    }

    //
    // ## PeriodicTimer 
    //
    // A simple class with two methods - start() and stop().
    // The given callback is called periodically. I wrote
    // this class because setInterval() has **significantly* better
    // callback regularity than setTimeout in node.js. You can,
    // however, use this in a browser as well as in node.js as it
    // can check for a browser environment and adapt the precision
    // to the necessary level. Note that the *minimum* precision
    // in a browser environment will be that of requestAnimationFrame
    // if that API exists. Otherwise the callback will be called
    // at least once every 33 ms.
    //
    // Here are a couple of measurements (in ms) for N callbacks 
    // with dt interval for setInterval under node.js -
    //      {"N":1500,"dt":10,"mean":0.13,"min":-1,"max":1,"deviation":0.34}
    //      {"N":1500,"dt":10,"mean":-0.84,"min":-2,"max":0,"deviation":0.37}
    // Here are two measurements for setTimeout under node.js -
    //      {"N":1500,"dt":10,"mean":-850.31,"min":-1680,"max":-3,"deviation":486.16}
    //      {"N":1500,"dt":10,"mean":-833.59,"min":-1676,"max":0,"deviation":479.3}
    //
    // There is no such difference between the two in the browser, so
    // we always latch on to requestAnimationFrame if found. Here is 
    // a measurement of setInterval in the browser (Chrome) - 
    //      {"N":1500,"dt":10,"mean":-687.63,"min":-1381,"max":-1,"deviation":402.51}
    //

    function PeriodicTimer(callback, precision_ms) {

        var requestAnimationFrame = getRequestAnimationFrameFunc();

        if (detectBrowserEnv() && !requestAnimationFrame) {
            throw new Error('PeriodicTimer needs requestAnimationFrame support. Use a sufficiently modern browser.');
        }

        var self = this;
        var running = false;
        var intervalID;

        if (precision_ms === undefined) {
            precision_ms = 15; // Default to about 60fps just like requestAnimationFrame.
        } else {
            // If we're in a browser environment, no point trying to use
            // setInterval based code because the performance is as bad
            // as with setTimeout anyway -
            //      {"N":1500,"dt":10,"mean":-687.63,"min":-1381,"max":-1,"deviation":402.51}
            precision_ms = Math.min(Math.max(detectBrowserEnv() ? 15 : 1, precision_ms), 33);
        }

        if (requestAnimationFrame && precision_ms >= 12) {
            self.start = function () {
                if (!running) {
                    running = true;
                    requestAnimationFrame(function () {
                        if (running) {
                            requestAnimationFrame(arguments.callee);
                            callback();
                        }
                    });
                }
            };

            self.stop = function () {
                running = false;
            };
        } else {
            self.start = function () {
                if (!running) {
                    running = true;
                    intervalID = setInterval(callback, 1);
                }
            };

            self.stop = function () {
                if (running) {
                    running = false;
                    clearInterval(intervalID);
                    intervalID = undefined;
                }
            };
        }

        self.__defineGetter__('running', function () { return running; });
        self.__defineSetter__('running', function (state) {
            if (state) {
                self.start();
            } else {
                self.stop();
            }
            return running;
        });

        if (precision_ms <= 5) {
            console.error("WARNING: High precision timing used. May impact performance.");
        }

        // Indicate a usable compute ahead interval based on how
        // frequently the callbacks happen;
        self.computeAheadInterval_secs = (Math.round(precision_ms * 3.333)) / 1000;

        return self;
    }

    // ## JSNodeTimer
    //
    // This is a timer class with the same interface as `PeriodicTimer`, but which uses
    // a `JavaScriptNode` to generate the callbacks.

    function preserveNode(node) {
        (window.JSNodeTimer_jsnodes || (window.JSNodeTimer_jsnodes = [])).push(node);
    }

    function JSNodeTimer(callback, precision_ms, audioContext) {
        if (audioContext) {
            var kBufferSize = 1024;
            var jsnode = audioContext.createJavaScriptNode(kBufferSize);
            jsnode.onaudioprocess = function (event) {
                callback(); // For the moment, no timing information within these.
            };

            var self = this;
            var running = false;

            preserveNode(jsnode);

            self.start = function () {
                if (!running) {
                    running = true;
                    jsnode.connect(audioContext.destination);
                }
            };
            self.stop = function () {
                if (running) {
                    jsnode.disconnect();
                    running = false;
                }
            };
            self.__defineGetter__('running', function () { return running; });
            self.__defineSetter__('running', function (val) {
                if (val) {
                    self.start();
                } else {
                    self.stop();
                }
                return running;
            });

            // Indicate a usable compute ahead interval based on how
            // frequently the callbacks happen;
            self.computeAheadInterval_secs = (Math.round(kBufferSize * 2.5)) / audioContext.sampleRate;

           return self;
        } else {
            return PeriodicTimer.call(this, callback, precision_ms);
        }
    }

    //
    // ## Clock
    //
    // A clock type that can keep track of absolute time
    // as well as a rate-integrated relative time.
    //
    // [t1,t2] is the absolute time interval,
    // [t1r,t2r] is the rate integrated time interval,
    // dt is the absolute time step for scheduler tick. 'dt' is
    // expected to remain a constant.
    //
    // The 'rate' property can be anything that supports
    // the 'valueOf()' protocol.
    //
    function Clock(t, tr, dt, rate) {
        this.dt = dt;
        this.t1 = t;
        this.t2 = t + dt;
        this.t1r = tr;
        this.t2r = tr + rate.valueOf() * dt;
        this.rate = rate;

        // Keep an arbitrary data slot for use by scheduler tasks.  Each "track"
        // inherits this "data" field from the track that spawned/forked it.
        // The field is copied via prototypal inheritance using
        // `Object.create()`, so each track can treat "data" as though it owns it
        // and add and change properties. However, note that the "virtual copy"
        // isn't a deep copy, so modifying an object held in the data object
        // (ex: `data.arr[3]`) is likely to affect all tracks that can access
        // that object. You can override how data is copied by overriding a
        // clock's copy() method.
        this.data = null; 

        return this;
    }

    // A function for rounding time in seconds up to millisecond precision.
    function ms(t) {
        return Math.round(t * 1000) / 1000;
    }

    // Convenience method to show the state of a clock object.
    Clock.prototype.toString = function () {
        return JSON.stringify([this.t1r, this.t2r - this.t1r, this.t1, this.t2 - this.t1].map(ms));
    };

    // Makes a copy such that the absolute and rate-integrated
    // times both match and the "data" field is "inherited".
    Clock.prototype.copy = function () {
        var c = new Clock(this.t1, this.t1r, this.dt, this.rate);
        if (this.data) {
            c.data = Object.create(this.data);
        }
        return c;
    };

    // Advances the absolute time interval by dt. Doesn't touch the
    // rate integrated time. It is in general desirable to keep
    // the rate integrated time continuous.
    Clock.prototype.advance = function (dt) {
        this.t1 += dt;
        this.t2 += dt;
        return this;
    };

    // Advances the absolute time interval by dt = t - clock.t1. Doesn't 
    // touch the rate integrated time. It is in general desirable to keep
    // the rate integrated time continuous.
    Clock.prototype.advanceTo = function (t) {
        return this.advance(t - this.t1);
    };

    // Makes one scheduler time step. This just means that t1 takes
    // on the value of t2 and t2 correspondingly increments by a
    // tick interval. Similarly for the rate-integrated interval.
    Clock.prototype.tick = function () {
        this.t1 = this.t2;
        this.t2 += this.dt;
        this.t1r = this.t2r;
        this.t2r += this.dt * this.rate.valueOf();
        return this;
    };

    // Jumps the absolute time to the given time and adjusts
    // the rate-integrated value according to the jump difference.
    Clock.prototype.jumpTo = function (t) {
        var step_dt = t - this.t1;
        var step_dtr = step_dt * this.rate.valueOf();
        this.t1 += step_dt;
        this.t2 += step_dt;
        this.t1r += step_dtr;
        this.t2r += step_dtr;
        return this;
    };

    // syncWith will adjust the real time and the rate integrated
    // time to sync with the given clock, but the rate will
    // remain untouched and so will the time step.
    Clock.prototype.syncWith = function (clock) {
        this.t1 = clock.t1;
        this.t2 = this.t1 + this.dt;
        this.t1r = clock.t1r;
        this.t2r = this.t1r + this.rate.valueOf() * this.dt;
        return this;
    };

    // Nudges the rate-integrated "relative" time to the given value.
    // The absolute start time is also adjusted proportionally.
    //
    // WARNING: This needs t2r > t1r to hold.
    Clock.prototype.nudgeToRel = function (tr) {
        tr = Math.max(this.t1r, tr);
        if (this.t2r > this.t1r) {
            this.t1 += (tr - this.t1r) * (this.t2 - this.t1) / (this.t2r - this.t1r);
        }
        this.t1r = tr;
        return this;
    };

    // Relative time to absolute time.
    Clock.prototype.rel2abs = function (rel) {
        return this.t1 + (rel - this.t1r) / this.rate.valueOf();
    };

    // Absolute time to relative time.
    Clock.prototype.abs2rel = function (abs) {
        return this.t1r + (abs - this.t1) * this.rate.valueOf();
    };


    var UI = (function (UI) {

        function round(n) {
            var m = n % 1;
            var f = n - m;
            var k = Math.pow(10, 4 - Math.min(3, ('' + f).length));
            return Math.round(n * k) / k;
        }

        function mappingFn(mapping) {
            if (typeof(mapping) === 'string') {
                return Param.mappings[mapping];
            } else {
                return mapping || Param.mappings.linear;
            }
        }

        function insertBeforeEnd(target) {
            return function (e) {
                target.insertAdjacentElement('beforeend', e);
            };
        }

        // Makes a simple UI with sliders for the parameters exposed by the model.
        // The return value is a div element that can be inserted into some DOM part.
        // This element is also stored in "model.ui" for reuse. If one already exists,
        // a new one is not created.
        UI.basicUI = function (document, model, sectionLabel) {
            if (model.ui) {
                return model.ui;
            }

            var div = document.createElement('div');
            if (sectionLabel) {
                div.insertAdjacentHTML('beforeend', '<p><b>' + sectionLabel + '</b></p>');
            }

            var specs = Param.names(model).map(function (k) {
                var spec = Object.create(model[k].spec);
                spec.name = spec.name || k;
                spec.param = model[k];
                return spec;
            });

            specs.forEach(function (spec) {
                var paramName = spec.name;
                var param = spec.param;

                if ('min' in spec && 'max' in spec) {
                    // Only expose numeric parameters for the moment.
                    var cont = document.createElement('div');
                    var label = document.createElement('span');
                    var valueDisp = document.createElement('span');
                    label.innerText = (spec.label || paramName) + ': ';
                    label.style.width = '100px';
                    label.style.display = 'inline-block';
                    label.style.textAlign = 'left';

                    var slider = document.createElement('input');
                    slider.type = 'range';
                    slider.min = 0.0;
                    slider.max = 1.0;
                    slider.step = 0.001;

                    var mapping = mappingFn(spec.mapping);
                    var units = spec.units ? ' ' + spec.units : '';

                    slider.value = mapping.toNorm(param);
                    valueDisp.innerText = ' (' + round(param.value) + units + ')';

                    slider.changeModelParameter = function (e) {
                        // Slider value changed. So change the model parameter.
                        // Use curve() to map the [0,1] range of the slider to
                        // the parameter's range.
                        param.value = mapping.fromNorm(param, parseFloat(this.value));
                    };

                    slider.changeSliderValue = function (value) {
                        // Model value changed. So change the slider. Use curve()
                        // to map the parameter value to the slider's [0,1] range.
                        slider.value = mapping.toNorm(param);
                        valueDisp.innerText = ' (' + round(value) + units + ')';
                    };
                    
                    slider.addEventListener('change', slider.changeModelParameter);
                    param.watch(slider.changeSliderValue);

                    [label, slider, valueDisp].forEach(insertBeforeEnd(cont));
                    div.insertAdjacentElement('beforeend', cont);
                }
            });

            return model.ui = div;
        };

        return UI;
    }({}));

    // Some utility functions.
    var Util = {};

    Util.p2f = function (pitch) {
        return 440 * Math.pow(2, (pitch.valueOf() - 69) / 12);
    };
    
    Util.f2p = function (f) {
        var p = 69 + 12 * Math.log(f.valueOf() / 440) / Math.LN2;
        return Math.round(p * 100) / 100; // Cents level precision is enough.
    };

    Util.augment = function (submodName, fn) {
        var steller = org.anclab.steller;
        if (submodName in steller) {
            steller[submodName].augmentors.push(fn);
        } else {
            // New module.
            function newMod() {
                var argv = Array.prototype.slice.call(arguments, 0);
                var obj = {};
                newMod.augmentors.forEach(function (f) {
                    obj = f.apply(obj, argv) || obj;
                });
                return obj;
            }

            newMod.augmentors = [fn];
            steller[submodName] = newMod;
        }

        return steller[submodName];

    };

    steller.SoundModel    = SoundModel;
    steller.GraphNode     = GraphNode;
    steller.Param         = Param;
    steller.Scheduler     = Scheduler;
    steller.Clock         = Clock;
    steller.PeriodicTimer = PeriodicTimer;
    steller.JSNodeTimer   = JSNodeTimer;
    steller.UI            = UI;
    steller.Util          = Util;

    // Expose the ones that we use.
    steller.requestAnimationFrame = (function (raf) {
        return function (func) {
            return raf(func);
        };
    }(getRequestAnimationFrameFunc()));
    steller.AudioContext = getAudioContext();

    // A function to find out if we're running in a browser environment.
    // The other environment possible is node.js.
    function detectBrowserEnv() {
        try {
            window.document.getElementById;
            return true;
        } catch (e) {
            return false;
        }
    }

    // Until requestAnimationFrame comes standard in all browsers, test
    // for the prefixed names as well.
    function getRequestAnimationFrameFunc() {
        try {
            return (window.requestAnimationFrame ||
                    window.webkitRequestAnimationFrame ||
                    window.mozRequestAnimationFrame ||
                    window.msRequestAnimationFrame ||
                    (function (cb) {
                        setTimeout(cb, 1000/60);
                    }));
        } catch (e) {
            return undefined;
        }
    }

    // Gets the AudioContext class when in a browser environment.
    function getAudioContext() {
        try {
            return (window.webkitAudioContext || window.mozAudioContext);
        } catch (e) {
            return undefined;
        }
    }

    // Get a time function based on the high resolution performance
    // timer if present. The returned function, when called, will
    // give time in seconds.
    function getHighResPerfTimeFunc() {
        try {
            var perf = window.performance;
            var perfNow = (perf && (perf.now || perf.webkitNow || perf.mozNow));
            if (perfNow) {
                // High resolution performance time available.
                return function () {
                    return perfNow.call(perf) * 0.001;
                };
            }
        } catch (e) {
        }

        return undefined;
     }

}((function () { try { return window; } catch (e) { return undefined; } }()), org.anclab.steller));
