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

    for ( let elem of _.filter(_.flatten(_.values(memory.structures)), s => "energy" in s) )  {
        let s = Game.getObjectById(elem.id);
        if (!s) {
            console.log(this.name + ": no resource object " + elem.id);
            elem.energy = 0;
            continue;
        }
        elem.energy = "energy" in s ? s.energy : ("store" in s ? s.store[RESOURCE_ENERGY] : 0);
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

Room.prototype.getStoragedLink = function() {
    let link = _.filter(this.memory.structures[STRUCTURE_LINK], l => l.storaged)[0];
    if (link)
        return Game.getObjectById(link.id);
    
    return null;
}

Room.prototype.getUnStoragedLinks = function() {
    return _.map( _.filter(this.memory.structures[STRUCTURE_LINK], l => !l.storaged), l => Game.getObjectById(l.id));
}

Room.prototype.getTowers = function() {
    return _.map( this.memory.structures[STRUCTURE_TOWER], t => Game.getObjectById(t.id) );
}

Room.prototype.getPairedContainer = function() {
    let containers = _.filter(
        (this.memory.structures[STRUCTURE_CONTAINER] || []).concat( 
        (this.memory.structures[STRUCTURE_LINK] || []) ),
     c => c.source);

     if (!containers.length)
        return null;
    
    let resultContainer;
    let minTicks;
    for (let container of containers) {
        let ticks = _.sum(_.filter(Game.creeps, c => c.memory.cID == container.id), c => c.ticksToLive);
        if (minTicks === undefined || ticks < minTicks) {
            resultContainer = container;
            minTicks = ticks;
        }
    }

    return resultContainer;
}

Room.prototype.updateStructures = function() {
    console.log(this.name + ": updateStructures");
    let room = this;
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.structuresTime = Game.time;
    memory.constructions = 0;
    memory.repairs = 0;
    if (!("needRoads" in memory))
        memory.needRoads = {};
    memory.pointPos = null;
        
    this.find(FIND_SOURCES).forEach( function(s) {
        let elem = {
                id : s.id,
                pos : s.pos,
                energy : s.energy,
                minersFrom : _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner") && c.memory.energyID == s.id),
                structureType : STRUCTURE_SOURCE,
                places : utils.getRangedPlaces(null, s.pos, 1).length,
        };
        memory.structures[STRUCTURE_SOURCE] = memory.structures[STRUCTURE_SOURCE] || [];
        memory.structures[STRUCTURE_SOURCE].push(elem);
    });

    this.find(FIND_STRUCTURES).forEach( function(s) {
        let elem;
        if (s.structureType == STRUCTURE_KEEPER_LAIR) {
            memory.type = 'lair';
            elem = {
                ticksToSpawn : s.ticksToSpawn,
            };
        } else if (s.structureType == STRUCTURE_CONTROLLER) {
            if (s.my) {
                memory.type = 'my';
            } else if (s.reservation && s.reservation.username == 'Saint') {
                memory.type = 'reserved';
                memory.reserveEnd = Game.time + s.reservation.ticksToEnd;
            } else if (s.reservation || s.owner) {
                memory.type = 'hostiled';
            } else {
                memory.type = 'empty';
            }
            memory.pointPos = s.pos;
        } else if (s.structureType == STRUCTURE_ROAD) {
            room.refreshRoad(memory, s);
        } else if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_LAB].indexOf(s.structureType) !== -1) {
            elem = {
                structureType : s.structureType,
                places : utils.getRangedPlaces(null, s.pos, 1).length,
                hits : s.hits,
                hitsMax : s.hitsMax, 
            };

            if ("energy" in s)
                elem.energy = s.energy;
            else if ("store" in s)
                elem.energy = s.store[RESOURCE_ENERGY];

            if (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_LINK) {
                elem.minersTo = _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner" || c.memory.role == "shortminer") && c.memory.cID == s.id);
                elem.source = _.filter(memory.structures[STRUCTURE_SOURCE], sr => s.pos.inRangeTo(sr.pos, 2))[0];
                if (elem.source) {
                    elem.source.betweenPos = _.filter( utils.getRangedPlaces(null, elem.source.pos, 1), p => p.isNearTo(s.pos) )[0];
                    if (elem.source.betweenPos)
                        elem.source.pair = (elem.source.pair || 0) + 1;
                }
            }

            if (s.structureType == STRUCTURE_LINK) {
                elem.minersFrom = _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner" || c.memory.role == "shortminer") && c.memory.energyID == s.id);
                if (room.storage && s.pos.inRangeTo(room.storage.pos, 2))
                    elem.storaged = 1;
            }
        } else if ([STRUCTURE_WALL, STRUCTURE_RAMPART].indexOf(s.structureType) !== -1 && s.hits < s.hitsMax*0.9 && s.hits < REPAIR_LIMIT ) {
            elem = {
                hits : s.hits,
                hitsMax : s.hitsMax, 
            }
        }

        if (elem) {
            elem.id = s.id;
            elem.pos = s.pos;
            memory.structures[s.structureType] = memory.structures[s.structureType] || [];
            memory.structures[s.structureType].push(elem);
            if (elem.hits < elem.hitsMax * 0.9 && elem.hits < REPAIR_LIMIT)
                memory.repairs++;
        }
    });

    this.find(FIND_MY_CONSTRUCTION_SITES).forEach( function(s) {
        memory.constructions++;
        if (s.structureType == STRUCTURE_ROAD) {
            room.refreshRoad(memory, s);
        }
    });

    for (let key of _.filter(Object.keys(memory.needRoads), r => !memory.needRoads[r].id && memory.needRoads[r].wanted > ROADS_CONSTRUCT_WANTED)) {
        if (memory.constructions < 5) {
            let pos = key.split(',');
            if (pos[0] != 0 && pos[0] != 49 && pos[1] != 0 && pos[1] != 49) {
                let res = this.createConstructionSite(parseInt(pos[0]), parseInt(pos[1]), STRUCTURE_ROAD);
                console.log(this.name + " BUILT (" + res + ") road at " + key);
                memory.constructions++;
            }
        }
    }

    if (!memory.pointPos) {
        let flag = _.filter(Game.flags, f => f.pos.roomName == this.name)[0];
        if (flag)
            memory.pointPos = flag.pos;
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