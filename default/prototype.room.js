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

Room.prototype.needRoad = function(creep) {
    let roads = this.memory.needRoads;
    let key = creep.pos.x + "," + creep.pos.y;
    
    if (!(key in roads)) {
        roads[key] = {wanted : 1, lastUpdate : Game.time, needRepair : 0, id : null};
    } else {
        roads[key].wanted = Game.time - roads[key].lastUpdate < 500 ? roads[key].wanted + 1 : 1;
        roads[key].lastUpdate = Game.time;
    }

    if (roads[key].needRepair && roads[key].id && creep.carry.energy && creep.getActiveBodyparts(WORK)) {
        let road = Game.getObjectByID(roads[key].id);
        if (!road) {
            roads[key].id = null;
            return -1;
        }
        if (road.hits && road.hits < road.hitsMax) {
            console.log(creep.name + ": repair road on " + key);
            //creep.repair(road);
        } else if (road.progress) {
            console.log(creep.name + ": build road on " + key);
            //creep.build(road);
        }
        return 0;
    }

    return 0;
}

Room.prototype.refreshRoad = function (memory, s) {
    let key = s.pos.x + "," + s.pos.y;
    if (memory.needRoads[key]) {
        memory.needRoads[key].id = s.id;
        if (Game.time - (memory.needRoads[key].lastUpdate || 0) > 500)
            memory.needRoads[key].wanted = 0;

        if (memory.needRoads[key].wanted > 10 && (s.progress || s.hits && s.hits < s.hitsMax * 0.9))
            memory.needRoads[key].needRepair = 1;
        else
            memory.needRoads[key].needRepair = 0;
    }

    return;
}

Room.prototype.updateStructures = function() {
    console.log(this.name + ": updateStructures");
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.structuresTime = Game.time;
    delete memory.roads; // TODO: remove it
    if (!("needRoads" in memory))
        memory.needRoads = {};
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
            this.refreshRoad(memory, s);
        }

        if (elem) {
            memory.structures[s.structureType] = memory.structures[s.structureType] || [];
            memory.structures[s.structureType].push(elem);
        }
    });

    this.find(FIND_STRUCTURES).forEach( function(s) {
        if (s.structureType == STRUCTURE_ROAD) {
            this.refreshRoad(memory, s);
        }
    });

    for (let key of _.filter(memory.needRoads, r => r.needRepair && !r.id)) {
        let pos = _.split(key, ',');
        //this.createConstructionSite(pos[0], pos[1], STRUCTURE_ROAD);
        console.log(this.name + ": want to build road on " + key);
    }
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