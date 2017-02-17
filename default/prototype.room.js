var utils = require('utils');

Room.prototype.init = function() {
}

Room.prototype.update = function() {
    if (!("structures" in this.memory) || Game.time - (this.memory.structuresTime || 0) > UPDATE_INTERVAL_STRUCTURES)
        this.updateStructures();
    if (!("hostileCreeps" in this.memory) || Game.time - (this.memory.hostileCreepsTime || 0) > UPDATE_INTERVAL_HOSTILES)
        this.updateHostileCreeps();
    
    for (let key of _.filter(Object.keys(this.memory.needRoads), r => this.memory.needRoads[r].wanted > ROADS_REPAIR_WANTED)) {
        let color = 'green';
        if (this.memory.needRoads[key].wanted > ROADS_CONSTRUCT_WANTED)
            color = 'red';
        else if (this.memory.needRoads[key].wanted > 10)
            color = 'yellow';
            
        let pos = key.split(',');
        
        this.visual.circle(parseInt(pos[0]), parseInt(pos[1]), {fill: color});
    }
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
    
    if (creep.memory.role == 'harvester' || creep.memory.role == 'longharvester' || creep.memory.role == 'upgrader') {
        if (!(key in roads)) {
            roads[key] = {wanted : 1, lastUpdate : Game.time, needRepair : 0, id : null};
        } else {
            roads[key].wanted = Game.time - roads[key].lastUpdate < ROADS_TIMEOUT ? roads[key].wanted + 1 : 1;
            roads[key].lastUpdate = Game.time;
        }
    }

    if (roads[key] && roads[key].needRepair && roads[key].id && creep.carry.energy && creep.getActiveBodyparts(WORK)) {
        let road = Game.getObjectById(roads[key].id);
        if (!road) {
            roads[key].id = null;
            return -1;
        }
        if (road.hits && road.hits < road.hitsMax) {
            //console.log(creep.name + ": repair road on " + key);
            creep.repair(road);
        } else if (road.progressTotal) {
            //console.log(creep.name + ": build road on " + key);
            creep.build(road);
        }
        return 0;
    }

    return 0;
}

Room.prototype.refreshRoad = function (memory, s) {
    let key = s.pos.x + "," + s.pos.y;
    if (memory.needRoads[key]) {
        memory.needRoads[key].id = s.id;
        if (Game.time - (memory.needRoads[key].lastUpdate || 0) > ROADS_TIMEOUT) {
            delete memory.needRoads[key];
            return;
        }

        if (memory.needRoads[key].wanted > ROADS_REPAIR_WANTED && (s.progressTotal || s.hits && s.hits < s.hitsMax * 0.9))
            memory.needRoads[key].needRepair = 1;
        else
            memory.needRoads[key].needRepair = 0;
    }

    return;
}

Room.prototype.updateStructures = function() {
    console.log(this.name + ": updateStructures");
    let room = this;
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.structuresTime = Game.time;
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
            room.refreshRoad(memory, s);
        }

        if (elem) {
            memory.structures[s.structureType] = memory.structures[s.structureType] || [];
            memory.structures[s.structureType].push(elem);
        }
    });

    let ccount = 0;
    this.find(FIND_MY_CONSTRUCTION_SITES).forEach( function(s) {
        if (s.structureType == STRUCTURE_ROAD) {
            room.refreshRoad(memory, s);
            ccount++;
        }
    });

    for (let key of _.filter(Object.keys(memory.needRoads), r => !memory.needRoads[r].id && memory.needRoads[r].wanted > ROADS_CONSTRUCT_WANTED)) {
        if (ccount < 5) {
            let pos = key.split(',');
            if (pos[0] != 0 && pos[0] != 49 && pos[1] != 0 && pos[1] != 49) {
                let res = this.createConstructionSite(parseInt(pos[0]), parseInt(pos[1]), STRUCTURE_ROAD);
                console.log(this.name + " BUILT (" + res + ") road at " + key);
                ccount++;
            }
        }
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