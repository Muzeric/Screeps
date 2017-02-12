Room.prototype.init = function() {
}

Room.prototype.update = function() {
    if (!("structures" in this.memory) || Game.time - this.memory.structuresTime > 100)
        this.updateStructures();
    if (!("hostileCreeps" in this.memory) || Game.time - this.memory.hostileCreepsTime > 2)
        this.updateHostileCreeps();
}

Room.prototype.getNearComingLair = function(pos, range, leftTime) {
    return _.filter( this.memory.structures['keeperLair'], s => _.inRange(this.memory.structuresTime + s.ticksToSpawn - Game.time, 1, leftTime || 10) && pos.inRangeTo(s.pos, range) )[0];
}

Room.prototype.updateStructures = function() {
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.structuresTime = Game.time;
    this.find(FIND_STRUCTURES).forEach( function(s) {
        memory.structures[s.structureType] = memory.structures[s.structureType] || [];
        memory.structures[s.structureType].push(s);
        if (s.structureType == STRUCTURE_KEEPER_LAIR) {
            memory.type = 'lair';
        } else if (s.structureType == STRUCTURE_CONTROLLER) {
            if (s.my) {
                memory.type = 'my';
            } else if (s.reservation && s.reservation.username == 'Saint') {
                memory.type = 'reserved';
                memory.reserveEnd = Game.time + s.reservation.ticksToEnd;
            } 
        }
    });
}

Room.prototype.getNearKeeper = function(pos, range) {
    return _.filter( this.memory.hostileCreeps, c => c.owner.username == "Source Keeper" && pos.inRangeTo(c.pos, range) )[0];
}

Room.prototype.updateHostileCreeps = function() {
    let memory = this.memory;
    memory.hostileCreeps = [];
    memory.hostileCreepsTime = Game.time;
    memory.hostilesCount = 0;
    memory.hostilesDeadTime = 0;

    this.find(FIND_HOSTILE_CREEPS).forEach( function(c) {
        memory.hostileCreeps.push(c);
        if (c.owner.username == "Invader") {
            memory.hostilesCount++;
            if (Game.tiime + c.ticksToLive > memory.hostilesDeadTime)
                memory.hostilesDeadTime = Game.tiime + c.ticksToLive;
        }
    });
}