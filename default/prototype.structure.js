const profiler = require('screeps-profiler');
var utils = require('utils');
var travel = require('travel');

Object.defineProperty(Structure.prototype, 'memory', {
    configurable: true,
    get: function() {
        if(_.isUndefined(Memory.myStructuresMemory)) {
            Memory.myStructuresMemory = {};
        }
        if(!_.isObject(Memory.myStructuresMemory)) {
            return undefined;
        }
        return Memory.myStructuresMemory[this.id] = 
                Memory.myStructuresMemory[this.id] || {};
    },
    set: function(value) {
        if(_.isUndefined(Memory.myStructuresMemory)) {
            Memory.myStructuresMemory = {};
        }
        if(!_.isObject(Memory.myStructuresMemory)) {
            throw new Error('Could not set structure memory');
        }
        Memory.myStructuresMemory[this.id] = value;
    }
});