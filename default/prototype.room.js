const profiler = require('screeps-profiler');
var travel = require('travel');

var roomsHelper = {
    fakeUpdate: function (roomName) {
        let lastCPU = Game.cpu.getUsed();
        let res;
        if (Game.rooms[roomName]) {
            try {
                res = Game.rooms[roomName].update();
            } catch (e) {
                console.log(roomName + " ROOMUPDATE ERROR: " + e.toString() + " => " + e.stack);
                Game.notify(roomName + " ROOMUPDATE ERROR: " + e.toString() + " => " + e.stack);
            }
        } else if (!(roomName in Memory.rooms)) {
            res = ERR_NOT_FOUND;
        } else {
            let memory = Memory.rooms[roomName];
            if ("costMatrix" in memory) {
                global.cache.matrix[roomName] = global.cache.matrix[roomName] || {};
                global.cache.matrix[roomName]["common"] = PathFinder.CostMatrix.deserialize(memory.costMatrix);
                global.cache.matrix[roomName]["withCreeps"] = global.cache.matrix[roomName]["common"];
            }
            memory.hostilesCount = memory.hostilesCount && memory.hostilesDeadTime - Game.time > 0 ? memory.hostilesCount : 0;
            res = OK;
        }
        global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
        return res;
    },

    fakeUpdate2: function (roomName) {
        let lastCPU = Game.cpu.getUsed();
        let res;
        if (Game.rooms[roomName]) {
            try {
                res = Game.rooms[roomName].update2();
            } catch (e) {
                console.log(roomName + " ROOMUPDATE2 ERROR: " + e.toString() + " => " + e.stack);
                Game.notify(roomName + " ROOMUPDATE2 ERROR: " + e.toString() + " => " + e.stack);
            }
        }
        global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
        return res;
    },

    getHostilesCount: function (roomName, timeout = HOSTILES_DEAD_TIMEOUT) {
        if (!(roomName in Memory.rooms))
            return null;

        let memory = Memory.rooms[roomName];
        return memory.hostilesCount && memory.hostilesDeadTime - Game.time > timeout ? memory.hostilesCount : 0;
    },
    
};

module.exports = roomsHelper;
profiler.registerObject(roomsHelper, 'roomsHelper');

Room.prototype.update = function() {
    global.cache.matrix[this.name] = {};
    global.cache.hostiles[this.name] = {};

    if (!("pathCache" in this.memory) || Game.time - (this.memory.pathCacheTime || 0) >= UPDATE_INTERVAL_PATHCACHE)
        this.updatePathCache();
    if (!("structures" in this.memory) || Game.time - (this.memory.structuresTime || 0) >= UPDATE_INTERVAL_STRUCTURES)
        this.updateStructures();
    this.updateCreeps();
    if (!("resources" in this.memory) || Game.time - (this.memory.resourcesTime || 0) >= UPDATE_INTERVAL_RESOURCES)
        this.updateResources();
    
    for (let pos of this.memory.visuals) {
        this.visual.circle(pos, {fill: 'red'});
    }

    return OK;
}

Room.prototype.update2 = function() {
    if (!("balanceTime" in this.memory) || Game.time - (this.memory.balanceTime || 0) >= UPDATE_INTERVAL_BALANCE)
        this.balanceStore();

    return OK;
}

Room.prototype.getPathToRoom = function (roomName) {
    if (roomName == this.name)
        return 0;
    let memory = this.memory;
    memory.pathToRoomCache = memory.pathToRoomCache || {};

    if (!(roomName in memory.pathToRoomCache)) {
        let length = null;
        if (Memory.rooms[roomName] && Memory.rooms[roomName].pointPos && memory.pointPos) {
            let ps = memory.pointPos;
            let pt = Memory.rooms[roomName].pointPos;
            let path = travel.getPath(new RoomPosition(ps.x, ps.y, ps.roomName), {pos: new RoomPosition(pt.x, pt.y, pt.roomName), range: 2}, null, 0, null, PATH_OPS_LIMIT_LONG * 2);
            if (path.path.length && !path.incomplete)
                length = path.path.length;
        } 
        if (length === null)
            length = Game.map.getRoomLinearDistance(this.name, roomName) * 50 || null;
        memory.pathToRoomCache[roomName] = {"length": length, "createTime": Game.time};
    }

    return memory.pathToRoomCache[roomName].length;
}

Room.prototype.balanceStore = function () {
    let memory = this.memory;
    let thisRoomName = this.name;

    if (memory.type != "my") {
        memory.balanceTime = Game.time;
        return;
    }
    
    for (let object of [this.storage, this.terminal]) {
        if (!object || !("store" in object))
            continue;
        let store = object.store;
        let balanceMax = object.structureType == STRUCTURE_TERMINAL ? 0 : BALANCE_MAX;
        for (let rt in store) {
            if (rt == "energy" || store[rt] < balanceMax || global.cache.queueTransport.getStoreWithReserved(object, rt) < balanceMax)
                continue;
            let est = global.cache.queueTransport.getStoreWithReserved(object, rt) - balanceMax;
            //console.log(`${this.name}: has ${store[rt]} of ${rt} and est = ${est}`);
            for (let room of _.sortBy(Game.rooms, r => this.getPathToRoom(r.name) || 1000)) {
                if (est < BALANCE_TRANSPORT_MIN)
                    break;
                let roomName = room.name;
                if ((roomName == this.name && object.structureType == STRUCTURE_STORAGE) || !room.controller || !room.controller.my || !room.storage || global.cache.queueTransport.getStoreWithReserved(room.storage, rt) >= BALANCE_MIN)
                    continue;
                let amount = _.min([est, BALANCE_MIN - global.cache.queueTransport.getStoreWithReserved(room.storage, rt)]);
                if (amount >= BALANCE_TRANSPORT_MIN) {
                    console.log(`${this.name}: balance ${amount} of ${rt} to ${room.name}`);
                    global.cache.queueTransport.addRequest(object, room.storage, rt, amount);
                    est -= amount;
                }
            }
            if (est >= BALANCE_TRANSPORT_MIN && this.terminal && this.terminal.id != object.id) {
                console.log(`${this.name}: balance other ${rt} to terminal`);
                global.cache.queueTransport.addRequest(object, this.terminal, rt, _.min([est, this.terminal.storeCapacity - _.sum(this.terminal.store)]));
            }
        }
    }

    memory.balanceTime = Game.time;
}

Room.prototype.updatePathCache = function() {
    let memory = this.memory;
    memory.pathCache = memory.pathCache || {};
    memory.pathCount = travel.clearPathCache(memory.pathCache);
    memory.pathToRoomCache = memory.pathToRoomCache || {};
    //console.log(this.name + ": updatePathCache: " + allCount + " paths, " + delCount + " deleted");
    for (let roomName in memory.pathToRoomCache) {
        if (Game.time - (memory.pathToRoomCache[roomName].createTime || 0) > PATHCACHE_CREATE_TIMEOUT)
            delete memory.pathToRoomCache[roomName];
    }
    memory.pathCacheTime = Game.time;
}

Room.prototype.getAmount = function (rt) {
    return this.memory.store[rt] || 0;
}

Room.prototype.canBuildContainers = function () {
    let memory = this.memory;
    if (memory.type == "my" && (memory.structures[STRUCTURE_SPAWN] || []).length && (memory.structures[STRUCTURE_EXTENSION] || []).length || 
        memory.type != "my" && (this.name in global.cache.creepsByRoomName ? _.filter(global.cache.creepsByRoomName[this.name], c => c.memory.role == "longharvester") : []).length > 1
    )
        return 1;
    
    return 0;
}

Room.prototype.updateResources = function() {
    let memory = this.memory;
    memory.resources = [];
    memory.energy = 0;
    memory.freeEnergy = 0;
    memory.store = {};

    if (memory.type == "hostiled") {
        memory.resourcesTime = Game.time;
        return;
    }

    this.find(FIND_DROPPED_RESOURCES).forEach( function(r) {
        let elem = {
            id : r.id,
            pos : r.pos,
            amount : r.amount,
            energy : r.resourceType == RESOURCE_ENERGY ? r.amount : 0,
            resourceType : r.resourceType,
        };
        memory.resources.push(elem);
    });

    for ( let elem of _.filter(_.flatten(_.values(memory.structures)), s => "energy" in s || "store" in s || s.structureType == STRUCTURE_KEEPER_LAIR || "power" in s) )  {
        let s = Game.getObjectById(elem.id);
        if (!s) {
            console.log(this.name + ": no resource object " + elem.id);
            elem.energy = 0;
            memory.structuresTime = 0;
            continue;
        }
        elem.energy = "energy" in s ? s.energy : ("store" in s ? s.store[RESOURCE_ENERGY] : 0);
        memory.energy += elem.energy;
        if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE].indexOf(s.structureType) !== -1)
            memory.freeEnergy += elem.energy;
        if ("store" in s) {
            elem.store = _.clone(s.store);
            for (let rt in s.store)
                memory.store[rt] = (memory.store[rt] || 0) + s.store[rt];
        }
        if (elem.structureType == STRUCTURE_SOURCE && s.ticksToRegeneration == 1) {
            global.cache.stat.updateRoom(this.name, 'lost', elem.energy);
        } else if (elem.structureType == STRUCTURE_LAB) {
            elem.mineralType = s.mineralType;
            elem.mineralAmount = s.mineralAmount;
            elem.cooldown = s.cooldown;
            if (s.mineralType)
                memory.store[s.mineralType] = (memory.store[s.mineralType] || 0) + s.mineralAmount;
        } else if (elem.structureType == STRUCTURE_POWER_SPAWN) {
            elem.power = s.power;
        } else if (elem.structureType == STRUCTURE_POWER_BANK) {
            elem.power = s.power;
            elem.ticksToDecay = s.ticksToDecay;
        /*} else if (elem.structureType == STRUCTURE_NUKER) {
            elem.ghodium = s.ghodium;
            memory.store["G"] = (memory.store["G"] || 0) + (s.ghodium || 0);
        */
        } else if (elem.structureType == STRUCTURE_KEEPER_LAIR) {
            elem.ticksToSpawn = s.ticksToSpawn;
        }

        if (s.structureType == STRUCTURE_SPAWN && s.hits < s.hitsMax * 0.5 && s.my && !room.controller.safeMode && !room.controller.safeModeCooldown && room.controller.safeModeAvailable) {
            let res = room.controller.activateSafeMode();
            console.log(room.name + ": ACTIVATING SAFE MODE: " + res);
            Game.notify(room.name + ": ACTIVATING SAFE MODE: " + res);
        }
    }
    memory.resourcesTime = Game.time;
}

Room.prototype.getNearComingLairPos = function(pos, range, leftTime) {
    let lair = _.filter( this.memory.structures['keeperLair'], s => _.inRange(s.ticksToSpawn, 1, leftTime || KEEPLAIR_LEAVE_TIME) && pos.inRangeTo(s.pos, range) )[0];
    return lair ? (new RoomPosition(lair.pos.x, lair.pos.y, lair.pos.roomName)) : null;
}

Room.prototype.getComingLairPos = function () {
    let lair = _.sortBy(this.memory.structures['keeperLair'], l => l.ticksToSpawn)[0];
    return lair ? (new RoomPosition(lair.pos.x, lair.pos.y, lair.pos.roomName)) : null;
}

Room.prototype.needRoad = function(creep) {
    if (this.memory.type == "hostiled")
        return -1;
    let memory = this.memory;

    let road =  _.find(creep.pos.lookFor(LOOK_STRUCTURES), s => s.structureType == STRUCTURE_ROAD)
             || _.find(creep.pos.lookFor(LOOK_CONSTRUCTION_SITES), s => s.structureType == STRUCTURE_ROAD);
    if (road && creep.carry.energy && creep.getActiveBodyparts(WORK)) {
        if (road.hits && road.hits < road.hitsMax) {
            //console.log(creep.name + ": repair road on " + key);
            creep.repair(road);
        } else if (road.progressTotal) {
            //console.log(creep.name + ": build road on " + key);
            creep.build(road);
        }
    }
    if ((!road || road.progressTotal) && ["harvester","longharvester","upgrader","transporter","antikeeper"].indexOf(creep.memory.role) !== -1) {
        if (!("wantRoads" in memory))
            memory.wantRoads = {};

        let value = memory.wantRoads[creep.pos.getKey()] || 0;
        let time = _.floor(value / 10);
        let count = value - time;
        if (Game.time - time < ROADS_TIMEOUT) {
            if (count < 9)
                count++;
        } else {
            count = 1;
        }
        memory.wantRoads[creep.pos.getKey()] = Game.time * 10 + count;
    }

    return 0;
}

Room.prototype.linkAction = function () {
    let link_to = this.getStoragedLink();
    if (!link_to)
        return ERR_NOT_FOUND;

    let space = link_to.energyCapacity - link_to.energy;
    for (let link_from of this.getUnStoragedLinks()) {
        if (link_from && !link_from.cooldown && link_from.energy && link_from.energy <= space) {
            space -= link_from.energy;
            link_from.transferEnergy(link_to);
        }
    }

    return OK;
}

Room.prototype.getStoragedLink = function(ret) {
    let link = _.filter(this.memory.structures[STRUCTURE_LINK], l => l.storaged)[0];
    if (link) {
        if (ret)
            ret.object = link;
        return Game.getObjectById(link.id);
    }
    
    return null;
}

Room.prototype.getUnStoragedLinks = function() {
    return _.map( _.filter(this.memory.structures[STRUCTURE_LINK], l => !l.storaged), l => Game.getObjectById(l.id));
}

Room.prototype.getTowers = function() {
    return _.map( this.memory.structures[STRUCTURE_TOWER], t => Game.getObjectById(t.id) );
}

Room.prototype.getPairedContainer = function(pos) {
    let containers = _.filter( [].concat(
        (this.memory.structures[STRUCTURE_CONTAINER] || []),
        (this.memory.structures[STRUCTURE_LINK] || []),
        (this.memory.structures[STRUCTURE_STORAGE] || [])
    ), c => c.source && c.betweenPos);

     if (!containers.length)
        return null;
    
    let resultContainer;
    let minTicks;
    let minRange;
    for (let container of containers) {
        let ticks = _.sum(_.filter(Game.creeps, c => c.memory.cID == container.id && (c.memory.role == "longminer" || c.memory.role == "miner")), c => c.ticksToLive);
        let range = 0;
        if (pos) {
            let cPos = new RoomPosition(container.pos.x, container.pos.y, container.pos.roomName);
            range = cPos.getRangeTo(pos);
        }
        if (minTicks === undefined || ticks < minTicks || (ticks == minTicks && range < minRange)) {
            resultContainer = container;
            minTicks = ticks;
            minRange = range;
        }
    }

    return resultContainer;
}

Room.prototype.getPairedExtractor = function(withAmount) {
    if (STRUCTURE_EXTRACTOR in this.memory.structures 
        && this.memory.structures[STRUCTURE_EXTRACTOR].length
        && (this.memory.structures[STRUCTURE_EXTRACTOR][0].cID || this.memory.structures[STRUCTURE_EXTRACTOR][0].buildContainerID)
        && (!withAmount || this.memory.structures[STRUCTURE_EXTRACTOR][0].mineralAmount > 0)
    )
        return this.memory.structures[STRUCTURE_EXTRACTOR][0];
    return null;
}

Room.prototype.getInputLabs = function () {
    return _.filter((this.memory.structures[STRUCTURE_LAB] || []), l => l.input).sort(function(a,b) {if (a.id > b.id) return 1; if (a.id < b.id) return -1; return 0;});
}

Room.prototype.getOutputLabs = function () {
    return _.filter((this.memory.structures[STRUCTURE_LAB] || []), l => !l.input && !l.cooldown);
}

Room.prototype.getBoostLabs = function () {
    return _.filter((this.memory.structures[STRUCTURE_LAB] || []), l => l.boostFlag);
}

Room.prototype.getFreeLab = function (needEnergy) {
    let lab = _.filter(this.memory.structures[STRUCTURE_LAB] || [], l => l.mineralType === null && (!needEnergy || l.energy >= needEnergy))[0];
    if (lab)
        return Game.getObjectById(lab.id);
    
    return null;
}

Room.prototype.getRepairLimit = function () {
    return this.memory.repairLimit || REPAIR_LIMIT;
}

Room.prototype.getConstructions = function () {
    return _.filter( this.memory.structures[FIND_MY_CONSTRUCTION_SITES] || [], s => !s.finished);
}

Room.prototype.getRepairs = function (all) {
    return _.filter( _.flatten(_.values(this.memory.structures)), s => !s.finished && s.hits < s.hitsMax*0.9 && (all || s.hits < this.getRepairLimit()) );
}

Room.prototype.getBuilderTicks = function () {
    return (this.memory.constructionHits || 0) / BUILD_POWER + (this.memory.repairHits || 0) / REPAIR_POWER;
}

Room.prototype.finishBuildRepair = function (targetID) {
    for (let key in this.memory.structures) {
        for (let i = 0; i < this.memory.structures[key].length; i++) {
            let s = this.memory.structures[key][i];
            if (s.id == targetID) {
                s.finished = 1;
                if (s.structureType == FIND_MY_CONSTRUCTION_SITES)
                    this.memory.structuresTime = 0;
                return;
            }
        }
    }
}

Room.prototype.updateStructures = function() {
    console.log(this.name + ": updateStructures");
    let room = this;
    let memory = this.memory;
    memory.structures = {};
    memory.type = 'other';
    memory.constructions = 0;
    memory.constructionHits = 0;
    memory.constructionsRoads = 0;
    memory.repairs = 0;
    memory.repairHits = 0;
    memory.visuals = [];
    memory.spawnStructures = [];
    if (!("wantRoads" in memory))
        memory.wantRoads = {};
    memory.pointPos = Game.flags["PointPos." + this.name] ? Game.flags["PointPos." + this.name].pos : null;
    let costs = new PathFinder.CostMatrix;
        
    this.find(FIND_SOURCES).forEach( function(s) {
        let elem = {
                id : s.id,
                pos : s.pos,
                energy : s.energy,
                energyCapacity : s.energyCapacity,
                minersFrom : _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner") && c.memory.energyID == s.id),
                structureType : STRUCTURE_SOURCE,
                places : global.cache.utils.getRangedPlaces(null, s.pos, 1).length,
                rangedPlaces : global.cache.utils.getRangedPlaces(null, s.pos, 1),
        };
        memory.structures[STRUCTURE_SOURCE] = memory.structures[STRUCTURE_SOURCE] || [];
        memory.structures[STRUCTURE_SOURCE].push(elem);
    });

    if (this.storage && this.storage.store.energy > REPAIR_ENERGY_LIMIT)
        memory.repairLimit = REPAIR_LIMIT_HIGH;
    else if (!("repairLimit" in memory) || this.storage && this.storage.store.energy < 0.8*REPAIR_ENERGY_LIMIT)
        memory.repairLimit = REPAIR_LIMIT;

    let betweenCache = {};
    this.find(FIND_STRUCTURES).forEach( function(s) {
        let elem;
        if (s.structureType == STRUCTURE_KEEPER_LAIR) {
            memory.type = 'lair';
            elem = {
                ticksToSpawn : s.ticksToSpawn,
            };
            if (!memory.pointPos)
                memory.pointPos = s.pos;
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
            if (!memory.pointPos)
                memory.pointPos = s.pos;
            elem = {
                rangedPlaces : global.cache.utils.getRangedPlaces(null, s.pos, 1),
            };
        } else if (s.structureType == STRUCTURE_POWER_BANK) {
            memory.type = 'banked';
            elem = {
                places : global.cache.utils.getRangedPlaces(null, s.pos, 1).length,
                power: s.power,
                ticksToDecay: s.ticksToDecay,
                hits : s.hits,
                hitsMax : s.hitsMax,
            };
        } else if (s.structureType == STRUCTURE_ROAD) {
            costs.set(s.pos.x, s.pos.y, 1);
        } else if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK, STRUCTURE_EXTENSION, STRUCTURE_TOWER, STRUCTURE_SPAWN, STRUCTURE_POWER_SPAWN, STRUCTURE_LAB, STRUCTURE_EXTRACTOR, STRUCTURE_TERMINAL, STRUCTURE_NUKER, STRUCTURE_OBSERVER].indexOf(s.structureType) !== -1) {
            elem = {
                places : global.cache.utils.getRangedPlaces(null, s.pos, 1).length,
                hits : s.hits,
                hitsMax : s.hitsMax, 
            };

            if ("energy" in s) {
                elem.energy = s.energy;
            } else if ("store" in s) {
                elem.energy = s.store[RESOURCE_ENERGY];
                elem.store = _.clone(s.store);
            }
            
            if ("energyCapacity" in s)
                elem.energyCapacity = s.energyCapacity;
            else if ("storeCapacity" in s)
                elem.energyCapacity = s.storeCapacity;

            if ([STRUCTURE_CONTAINER, STRUCTURE_STORAGE, STRUCTURE_LINK].indexOf(s.structureType) !== -1) {
                elem.minersTo = _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner" || c.memory.role == "shortminer") && c.memory.cID == s.id);
                elem.source = _.filter(memory.structures[STRUCTURE_SOURCE], sr => s.pos.inRangeTo(sr.pos, 2))[0];
                if (elem.source) {
                    if (s.structureType == STRUCTURE_CONTAINER && s.pos.isNearTo(elem.source.pos))
                        elem.betweenPos = s.pos;
                    else
                        elem.betweenPos = _.filter( global.cache.utils.getRangedPlaces(null, elem.source.pos, 1), p => p.isNearTo(s.pos) && !(p.getKey() in betweenCache) )[0];
                    if (elem.betweenPos) {
                        elem.source.pair = (elem.source.pair || 0) + 1;
                        costs.set(elem.betweenPos.x, elem.betweenPos.y, 100);
                        betweenCache[elem.betweenPos.getKey()] = 1;
                    }
                }
            }

            if (s.structureType == STRUCTURE_LINK) {
                elem.minersFrom = _.some(Game.creeps, c => (c.memory.role == "longminer" || c.memory.role == "miner" || c.memory.role == "shortminer") && c.memory.energyID == s.id);
                if (room.storage && s.pos.inRangeTo(room.storage.pos, 2)) {
                    elem.storaged = 1;
                    elem.betweenPos = _.filter( global.cache.utils.getRangedPlaces(null, room.storage.pos, 1), p => p.isNearTo(s.pos) && !(p.getKey() in betweenCache) )[0];
                    if (elem.betweenPos) {
                        costs.set(elem.betweenPos.x, elem.betweenPos.y, 100);
                        betweenCache[elem.betweenPos.getKey()] = 1;
                    }
                }
            } else if (s.structureType == STRUCTURE_EXTRACTOR) {
                elem.rangedPlaces = global.cache.utils.getRangedPlaces(null, s.pos, 1);
                let mineral = s.pos.lookFor(LOOK_MINERALS)[0];
                if (!mineral) {
                    console.log(room.name + ": no mineral under extractor");
                } else {
                    elem.mineralID = mineral.id;
                    elem.mineralType = mineral.mineralType;
                    elem.mineralAmount = mineral.mineralAmount;
                }
            } else if (s.structureType == STRUCTURE_LAB) {
                elem.mineralCapacity = s.mineralCapacity;
            } else if (s.structureType == STRUCTURE_POWER_SPAWN) {
                elem.powerCapacity = s.powerCapacity;
            } else if (s.structureType == STRUCTURE_NUKER) {
                if (room.storage) {
                    let stored = global.cache.queueTransport.getStoreWithReserved(s, "G");
                    let able = global.cache.queueTransport.getStoreWithReserved(room.storage, "G");
                    let need = s.ghodiumCapacity - stored;
                    if (need > 0 && able >= need)
                        global.cache.queueTransport.addRequest(room.storage, s, "G", need);
                }
            }

            if (s.structureType != STRUCTURE_CONTAINER)
                costs.set(s.pos.x, s.pos.y, 0xff);
            
        } else if ([STRUCTURE_WALL, STRUCTURE_RAMPART].indexOf(s.structureType) !== -1) {
            if (s.hits < s.hitsMax*0.9) {
                elem = {
                    hits : s.hits,
                    hitsMax : s.hitsMax, 
                }
            }

            if ((s.structureType != STRUCTURE_RAMPART || !s.my))
                costs.set(s.pos.x, s.pos.y, 0xff);
        } else if (s.structureType == STRUCTURE_PORTAL) {
            memory.type = 'portal';
            costs.set(s.pos.x, s.pos.y, 0xff);
        } else {
            costs.set(s.pos.x, s.pos.y, 0xff);
        }

        if (elem) {
            elem.id = s.id;
            elem.pos = s.pos;
            elem.structureType = s.structureType;
            memory.structures[s.structureType] = memory.structures[s.structureType] || [];
            memory.structures[s.structureType].push(elem);
            if (elem.hits < elem.hitsMax * 0.9 && elem.hits < room.getRepairLimit()) {
                memory.repairs++;
                memory.repairHits += _.min([elem.hitsMax * 0.9, room.getRepairLimit()]) - elem.hits;
            }
        }
    });

    let constructionsContainers = {};
    let extensionConstructionCount = 0;
    let extractorConstructionCount = 0;
    this.find(FIND_MY_CONSTRUCTION_SITES).forEach( function(s) {
        memory.constructions++;
        memory.constructionHits += s.progressTotal - s.progress;
        if (s.structureType == STRUCTURE_ROAD) {
            let value = memory.wantRoads[s.pos.getKey()] || 0;
            let time = _.floor(value / 10);
            if (Game.time - time > ROADS_TIMEOUT) {
                let res = s.remove();
                delete memory.wantRoads[s.pos.getKey()];
                console.log(room.name + ": REMOVE (" + res + ") constr road at " + s.pos.getKey());
            } else {
                memory.constructionsRoads++;
                costs.set(s.pos.x, s.pos.y, 1);
            }
        } else if ((s.structureType != STRUCTURE_RAMPART || !s.my) && s.structureType != STRUCTURE_CONTAINER) {
            costs.set(s.pos.x, s.pos.y, 0xff);
            if (s.structureType == STRUCTURE_EXTENSION)
                extensionConstructionCount++;
            else if (s.structureType == STRUCTURE_EXTRACTOR)
                extractorConstructionCount++;
        } else if (s.structureType == STRUCTURE_CONTAINER) {
            constructionsContainers[s.pos.getKey()] = s.id;
        }
        let elem = {
            id: s.id,
            pos: s.pos,
            structureType: FIND_MY_CONSTRUCTION_SITES,
            constructionStructureType : s.structureType,
            progress : s.progress,
            progressTotal: s.progressTotal, 
        };
        memory.structures[FIND_MY_CONSTRUCTION_SITES] = memory.structures[FIND_MY_CONSTRUCTION_SITES] || [];
        memory.structures[FIND_MY_CONSTRUCTION_SITES].push(elem);
    });

    for (let extractor of (memory.structures[STRUCTURE_EXTRACTOR] || [])) {
        let container = _.filter(memory.structures[STRUCTURE_CONTAINER], c => extractor.pos.inRangeTo(c.pos, 2))[0];
        if (container) {
            extractor.pair = 1;
            extractor.cID = container.id;
            if (extractor.pos.isNearTo(container.pos))
                extractor.betweenPos = container.pos;
            else
                extractor.betweenPos = _.filter( global.cache.utils.getRangedPlaces(null, extractor.pos, 1), p => p.isNearTo(container.pos) )[0];
            costs.set(extractor.betweenPos.x, extractor.betweenPos.y, 100);
        }
    }

    memory.costMatrix = costs.serialize();
    global.cache.matrix[this.name]["common"] = costs;

    if (memory.type == "other" && (memory.structures[STRUCTURE_SOURCE] || []).length) {
        memory.type = "central";
    }

    if (memory.type != "hostiled" && this.canBuildContainers()) {
        for (let source of _.filter([].concat(memory.structures[STRUCTURE_SOURCE] || [], memory.structures[STRUCTURE_EXTRACTOR] || []), s => !s.pair && s.rangedPlaces.length)) {
            if (source.structureType == STRUCTURE_EXTRACTOR && !source.mineralAmount)
                continue;
            let contPos;
            let maxPlaces = 0;
            for (let pos of source.rangedPlaces) {
                let places = global.cache.utils.getRangedPlaces(null, pos, 1).length;
                if (places > maxPlaces) {
                    contPos = pos;
                    maxPlaces = places;
                }
                
                if (constructionsContainers[pos.x + "x" + pos.y]) {
                    source.buildContainerID = constructionsContainers[pos.x + "x" + pos.y];
                    break;
                }
            }
            if (source.buildContainerID)
                continue;
            let res = this.createConstructionSite(contPos.x, contPos.y, STRUCTURE_CONTAINER);
            console.log(this.name + ": BUILT (" + res + ") container at " + contPos.x + "x" + contPos.y);
            if (res == OK)
                memory.constructions++;
        }
    }

    for (let key in memory.wantRoads) {
        let value = memory.wantRoads[key];
        let time = _.floor(value / 10);
        let count = value - time;
        if (Game.time - time > ROADS_TIMEOUT) {
            delete memory.wantRoads[key];
        } else if (count > ROADS_CONSTRUCT_WANTED && memory.constructions < MAX_CONSTRUCTIONS_PER_ROOM) {
            let coor = key.split(',');
            if (coor[0] != 0 && coor[0] != 49 && coor[1] != 0 && coor[1] != 49) {
                let res = this.createConstructionSite(parseInt(coor[0]), parseInt(coor[1]), STRUCTURE_ROAD);
                console.log(this.name + ": BUILT (" + res + ") road at " + key);
                memory.constructions++;
                memory.constructionsRoads++;
            }
        }
    }

    if (!memory.pointPos) {
        let flag = _.filter(Game.flags, f => f.pos.roomName == this.name)[0];
        if (flag)
            memory.pointPos = flag.pos;
    }

    if (memory.type == 'my') {
        let maxCount = CONTROLLER_STRUCTURES["extension"][room.controller.level] || 0;
        let curCount = (memory.structures[STRUCTURE_EXTENSION] || []).length + extensionConstructionCount;
        if (maxCount > curCount && (memory.structures[STRUCTURE_SPAWN] || []).length) {
            let basePos = memory.structures[STRUCTURE_SPAWN][0].pos;
            let sum = 2;
            let newCount = 0;
            SEARCHING: while (curCount + newCount < maxCount && sum < 12) {
                for (let xmod = 0; xmod <= sum; xmod++) {
                    let ymod = sum - xmod;
                    for (let xdiff of xmod ? [-1 * xmod, xmod] : [0]) {
                        for (let ydiff of ymod ? [-1 * ymod, ymod] : [0]) {
                            let newPos = basePos.change(xdiff, ydiff, 1);
                            if (global.cache.utils.checkPosForExtension(newPos, costs)) {
                                newCount++;
                                //memory.visuals.push(newPos);
                                let res = this.createConstructionSite(newPos, STRUCTURE_EXTENSION);
                                console.log(this.name + ": BUILT (" + res + ") extension at " + newPos.getKey());
                                if (curCount + newCount >= maxCount)
                                    break SEARCHING;
                            }
                        }
                    }
                }
                sum += 2;
            }
        }

        if (CONTROLLER_STRUCTURES["extractor"][room.controller.level] && !(memory.structures[STRUCTURE_EXTRACTOR] || []).length && !extractorConstructionCount) {
            let mineral = this.find(FIND_MINERALS)[0];
            if (mineral) {
                let res = this.createConstructionSite(mineral.pos, STRUCTURE_EXTRACTOR);
                console.log(this.name + ": BUILT (" + res + ") extractor");
            }
        }

        if ((memory.structures[STRUCTURE_LAB] || []).length >= 3) {
            let inputCount = 0;
            let boostCount = 0;
            for (let lab1 of memory.structures[STRUCTURE_LAB].sort(function(a,b) {if (a.id > b.id) return 1; if (a.id < b.id) return -1; return 0;})) {
                let got = 0;
                for (let lab2 of memory.structures[STRUCTURE_LAB]) {
                    if (lab1.pos.inRangeTo(lab2, 2))
                        got++;
                }
                if (got == memory.structures[STRUCTURE_LAB].length && inputCount < 2) {
                    lab1.input = 1;
                    inputCount++;
                } else if (boostCount < 1) {
                    lab1.boostFlag = 1;
                    boostCount++;
                }
            }
        }

        if (this.storage) {
            memory.spawnStructures = _.map(
                _.sortBy(memory.structures[STRUCTURE_EXTENSION].concat(memory.structures[STRUCTURE_SPAWN]), s => s.pos.getRangeTo(this.storage.pos)),
                s => s.id
            );
        }
    }

    if (memory.type == "hostiled")
        memory.structures = {};

    memory.structuresTime = Game.time;
}

Room.prototype.getNearKeeperPos = function(pos, range) {
    let keeper = _.filter( global.cache.hostiles[this.name].keepers, c => pos.inRangeTo(c.pos, range) )[0];
    if (keeper)
        return keeper.pos;

    return null;
}

Room.prototype.getNearAttackers = function (pos, range = 5) {
    return _.filter( global.cache.hostiles[this.name].attackers, c => pos.inRangeTo(c.pos, range) );
}

Room.prototype.getAllAttackers = function () {
    return global.cache.hostiles[this.name].attackers.concat(global.cache.hostiles[this.name].keepers);
}

Room.prototype.updateCreeps = function() {
    let memory = this.memory;
    let roomName = this.name;
    memory.creepsTime = Game.time;
    global.cache.hostiles[this.name] = {
        keepers: [],
        attackers: [],
    };
    let hostileCache = global.cache.hostiles[this.name];
    memory.hostilesCount = 0;
    memory.hostilesDeadTime = 0;
    if (!("common" in global.cache.matrix[this.name]))
        global.cache.matrix[this.name]["common"] = PathFinder.CostMatrix.deserialize(memory.costMatrix);
    let costs = global.cache.matrix[this.name]["common"].clone();

    this.find(FIND_HOSTILE_CREEPS).forEach( function(c) {
        if (c.owner.username == "Source Keeper") {
            hostileCache.keepers.push(c);
        } else {
            hostileCache.attackers.push(c);
            memory.hostilesCount++;
            if (Game.time + c.ticksToLive > memory.hostilesDeadTime)
                memory.hostilesDeadTime = Game.time + c.ticksToLive;
        }
        costs.set(c.pos.x, c.pos.y, 0xff);
    });

    if (this.name in global.cache.creepsByRoom) {
        for (let c of _.values(global.cache.creepsByRoom[this.name]))
            costs.set(c.pos.x, c.pos.y, 0xff);
    }

    global.cache.matrix[this.name]["withCreeps"] = costs;
}
