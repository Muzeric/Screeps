var utils = require('utils');

Room.prototype.init = function() {
}

Room.prototype.update = function() {
    if (!("structures" in this.memory) || Game.time - (this.memory.structuresTime || 0) > UPDATE_INTERVAL_STRUCTURES)
        this.updateStructures();
    if (!("hostileCreeps" in this.memory) || Game.time - (this.memory.hostileCreepsTime || 0) > UPDATE_INTERVAL_HOSTILES)
        this.updateHostileCreeps();
    if (!("resources" in this.memory) || Game.time - (this.memory.resourcesTime || 0) > UPDATE_INTERVAL_RESOURCES)
        this.updateResources();
    
    /*
    for (let key of _.filter(Object.keys(this.memory.needRoads), r => this.memory.needRoads[r].wanted > ROADS_REPAIR_WANTED)) {
        let color = 'green';
        if (this.memory.needRoads[key].wanted > ROADS_CONSTRUCT_WANTED)
            color = 'red';
        else if (this.memory.needRoads[key].wanted > 10)
            color = 'yellow';
            
        let pos = key.split(',');
        
        this.visual.circle(parseInt(pos[0]), parseInt(pos[1]), {fill: color});
    }
    */
}

Room.prototype.updateResources = function() {
    let memory = this.memory;
    memory.resources = [];
    memory.resourcesTime = Game.time;

    this.find(FIND_DROPPED_ENERGY).forEach( function(r) {
        let elem = {
            id : r.id,
            pos : r.pos,
            amount : r.amount,
            energy : r.resourceType == RESOURCE_ENERGY ? r.amount : 0,
            resourceType : r.resourceType,
        };
        memory.resources.push(elem);
    });

    for (let elem of (memory.structures[STRUCTURE_CONTAINER] || []).concat( (memory.structures[STRUCTURE_STORAGE] || []), (memory.structures[STRUCTURE_SOURCE] || []) )) {
        let s = Game.getObjectById(elem.id);
        if (!s) {
            console.log(this.name + ": no resource object " + elem.id);
            continue;
        }
        elem.energy = s.structureType ? s.store[RESOURCE_ENERGY] : s.energy;
        if (s.structureType == STRUCTURE_CONTAINER)
            elem.miners = _.filter(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner") && c.memory.cID == s.id).length;
        else if (s.structureType == STRUCTURE_SOURCE)
            elem.miners = _.filter(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner") && c.memory.energyID == s.id).length;
    }
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
    
    this.find(FIND_SOURCES).forEach( function(s) {
        let elem = {
                id : s.id,
                pos : s.pos,
                energy : s.energy,
                miners : _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner") && c.memory.energyID == s.id),
                structureType : STRUCTURE_SOURCE,
        };
        memory.structures[STRUCTURE_SOURCE] = memory.structures[STRUCTURE_SOURCE] || [];
        memory.structures[STRUCTURE_SOURCE].push(elem);
    });

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
        } else if (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE || s.structureType == STRUCTURE_LINK) {
            elem = {
                id : s.id,
                pos : s.pos,
                energy : s.structureType == STRUCTURE_LINK ? s.energy : s.store[RESOURCE_ENERGY],
                structureType : s.structureType,
            };

            if (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_LINK) {
                elem.miners = _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner" || c.memory.role == "shortminer") && c.memory.cID == s.id);
                elem.source = _.filter(memory.structures[STRUCTURE_SOURCE], sr => s.pos.inRangeTo(sr.pos, 2))[0];
            }

            if (s.structureType == STRUCTURE_LINK && this.storage && s.pos.inRangeTo(this.storage.pos, 2))
                elem.storaged = 1;
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