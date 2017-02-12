Room.prototype.init = function() {
}

Room.prototype.getLiveLairs = function() {
    if (!("structures" in this.memory))
        this.updateStructures;
}

Room.prototype.updateStructures = function() {
}