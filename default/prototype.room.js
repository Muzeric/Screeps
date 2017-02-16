var utils = require('utils');

Room.prototype.init = function() {
}

Room.prototype.update = function() {
    if (!("structures" in this.memory) || Game.time - this.memory.structuresTime > 100)
        this.updateStructures();
    if (!("hostileCreeps" in this.memory) || Game.time - this.memory.hostileCreepsTime > 2)
        this.updateHostileCreeps();
}

Room.prototype.updateResources = function() {
    let memory = this.memory;
    memory.resources = [];
    memory.resourcesTime = Game.time;

    this.find(FIND_DROPPED_ENERGY).forEach( function(r) {
        let elem = {
            find : FIND_DROPPED_ENERGY,
            amount : r.amount,
            wanted : _.reduce(_.filter(Game.creeps, c => c.memory.energyID == r.id), function (sum, value) { return sum + value.carryCapacity; }, 0),
            type : r.resourceType,
            pos : r.pos,
            id : r.id,
        };
        memory.resources.push(elem);
    });

    this.find(FIND_SOURCES).forEach( function(r) {
        let elem = {
            find : FIND_SOURCES,
            amount : r.energy,
            wanted : _.reduce(_.filter(Game.creeps, c => c.memory.energyID == r.id), function (sum, value) { return sum + value.carryCapacity; }, 0),
            type : RESOURCE_ENERGY,
            pos : r.pos,
            id : r.id,
        };
        memory.resources.push(elem);
    });

    this.find(FIND_STRUCTURES).forEach( function(r) {
        let elem = {
            find : FIND_SOURCES,
            amount : r.energy,
            wanted : _.reduce(_.filter(Game.creeps, c => c.memory.energyID == r.id), function (sum, value) { return sum + value.carryCapacity; }, 0),
            type : RESOURCE_ENERGY,
            pos : r.pos,
            id : r.id,
        };
        memory.resources.push(elem);
    });
}

Room.prototype.getNearComingLair = function(pos, range, leftTime) {
    return _.filter( this.memory.structures['keeperLair'], s => _.inRange(this.memory.structuresTime + s.ticksToSpawn - Game.time, 1, leftTime || 10) && pos.inRangeTo(s.pos, range) )[0];
}

Room.prototype.updateStructures = function() {
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.structuresTime = Game.time;
    if (!("roads" in memory))
        memory.roads = {};
    this.find(FIND_STRUCTURES).forEach( function(s) {
        let elem;
        if (s.structureType == STRUCTURE_KEEPER_LAIR) {
            memory.type = 'lair';
            elem = {
                id : s.id,
                pos : s.pos,
                ticksToSpawn : s.ticksToSpawn,
            };
        } else if (s.structureType == STRUCTURE_CONTROLLER) {
            if (s.my) {
                memory.type = 'my';
            } else if (s.reservation && s.reservation.username == 'Saint') {
                memory.type = 'reserved';
                memory.reserveEnd = Game.time + s.reservation.ticksToEnd;
            } 
        } else if (s.structureType == STRUCTURE_ROAD) {
            if (memory.roads[s.pos.x + "," + s.pos.y]) {
                memory.roads[s.pos.x + "," + s.pos.y].hits = s.hits;
                if (Game.time - (memory.roads[s.pos.x + "," + s.pos.y].lastUpdate || 0) > 500)
                    memory.roads[s.pos.x + "," + s.pos.y].wanted = 0;
            } else {
                memory.roads[s.pos.x + "," + s.pos.y] = {wanted : 0, lastUpdate : 0, id : s.id, hits : s.hits};
            }
        }

        if (elem) {
            memory.structures[s.structureType] = memory.structures[s.structureType] || [];
            memory.structures[s.structureType].push(elem);
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

Room.prototype.getNearHostile = function(pos, range) {
    return _.filter( this.memory.hostileCreeps, c => c.owner.username != "Source Keeper" && pos.inRangeTo(c.pos, range) )[0];
}