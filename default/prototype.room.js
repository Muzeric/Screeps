Object.defineProperty(Room.prototype, 'memory', {
    get: function() {
        if (!(this.name in Memory.rooms))
            Memory.rooms[this.name] = {};
        return Memory.rooms[this.name];
    },
    set: function(v) {
        return _.set(Memory, 'rooms.' + this.name, v);
    },
    configurable: true,
    enumerable: false
});

Room.prototype.init = function() {
}

Room.prototype.getLiveLairs = function() {
    if (!("structures" in this.memory))
        this.updateStructures;
}

Room.prototype.updateStructures = function() {
}