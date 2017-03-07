require('constants');
require('prototype.creep');
require('prototype.roomposition');
var utils = require('utils');
const profiler = require('screeps-profiler');
// This line monkey patches the global prototypes. 
profiler.enable();

module.exports.loop = function () {
profiler.wrap(function() {
    Game.roomsHelper = require('prototype.room');
    global.cache = {};
    global.cache.stat = require('stat');
    global.cache.stat.init();
    global.cache.matrix = {};
    global.cache.wantCarry = {};
    global.cache.wantEnergy = {};
    global.cache.creeps = {};
    
    var moveErrors = {};
    var objectCache = {};
    var roomNames = _.filter( _.uniq( [].concat( 
        _.map(Game.flags, 'pos.roomName'), 
        _.map( Game.rooms, 'name' ), 
        Object.keys(Memory.rooms) 
    ) ), n => n != "undefined");

    global.cache.wantEnergy = _.reduce( _.filter(Game.creeps, c => c.memory.energyID), function (sum, value, key) { 
            sum[value.memory.energyID] = sum[value.memory.energyID] || {energy : 0, creepsCount : 0};
            sum[value.memory.energyID].energy += value.carryCapacity - value.carry.energy;
            sum[value.memory.energyID].creepsCount++;
            return sum; 
    }, {});

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log(name + " DEAD (" + Memory.creeps[name].roomName + ")");
            global.cache.stat.die(name);
            delete Memory.creeps[name];
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            moveErrors[Game.creeps[name].room.name] = 1;
        }
    }

    global.cache.stat.addCPU("memory");

    _.forEach(roomNames, function(roomName) {
        Game.roomsHelper.fakeUpdate(roomName);
    });
    
    global.cache.stat.addCPU("roomUpdate");

    let creepsCPUStat = {};
    for(let creep_name in Game.creeps) {
        let creep = Game.creeps[creep_name];
        
        let role = creep.memory.role;
        if(!(role in objectCache))
            objectCache[role] = require('role.' + role);
        
        if(creep.spawning) {
            if ("prerun" in objectCache[role]) {
                try {
                    objectCache[role].prerun(creep);
                } catch (e) {
                    console.log(creep.name + " PRERUNNING ERROR: " + e.toString() + " => " + e.stack);
                    Game.notify(creep.name + " PRERUNNING ERROR: " + e.toString() + " => " + e.stack);
                }
            }
            continue;
        }
        
        if(moveErrors[creep.room.name]) {
            if(creep.moveTo(creep.room.controller) == OK)
                creep.memory.errors = 0;
            continue;
        }
        
        let lastCPU = Game.cpu.getUsed();
        
        try {
            creep.memory.carryEnergy = creep.carry.energy;
            objectCache[role].run(creep);
        } catch (e) {
            console.log(creep.name + " RUNNING ERROR: " + e.toString() + " => " + e.stack);
            Game.notify(creep.name + " RUNNING ERROR: " + e.toString() + " => " + e.stack);
        }
        
        
        if (!creepsCPUStat[creep.memory.role])
            creepsCPUStat[creep.memory.role] = {"cpu" : 0, "sum" : 0};
        
        let cpu = Game.cpu.getUsed() - lastCPU;
        creepsCPUStat[creep.memory.role]["cpu"] += cpu;
        creepsCPUStat[creep.memory.role]["sum"]++;

        global.cache.stat.updateRoom(creep.room.name, 'cpu', cpu);

        /*
        creep.memory.stat.CPU += (Game.cpu.getUsed() - lastCPU);
        let diffEnergy = creep.carry[RESOURCE_ENERGY] - creep.memory.lastEnergy;
        creep.memory.lastEnergy = creep.carry[RESOURCE_ENERGY];
        if (diffEnergy < 0)
            creep.memory.stat.spentEnergy -= diffEnergy;
        else
            creep.memory.stat.gotEnergy += diffEnergy;

        if (creep.pos.toString() != creep.memory.lastPos) {
            creep.memory.stat.moves++;
            creep.memory.lastPos = creep.pos.toString();
        }
        */
    }
    global.cache.stat.addCPU("run", creepsCPUStat);
    
    //stat.roles = JSON.parse(JSON.stringify(rolesCount));
    
    if (!Memory.limitList || !Memory.limitTime) {
        Memory.limitList = {};
        Memory.limitTime = {};
    }
    let needList = [];

    let longbuilders = _.filter(Game.creeps, c => c.memory.role == "longbuilder" && (c.ticksToLive > ALIVE_TICKS || c.spawning)).length;
    let buildFlags = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build').length;
    let stopLongBuilders = longbuilders * 1.5 >= buildFlags;
    _.forEach(roomNames, function(roomName) {
        let lastCPU = Game.cpu.getUsed();
        let room = Game.rooms[roomName];

        if (Game.time % PERIOD_NEEDLIST == 1) {
            let creepsCount =  _.countBy(_.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), c => c.memory.countName || c.memory.role);
            let bodyCount = _.countBy( _.flatten( _.map( _.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), function(c) { return _.map(c.body, function(p) {return c.memory.role + "," + p.type;});}) ) );

            if (!Memory.limitList[roomName] || !Memory.limitTime[roomName] || (Game.time - Memory.limitTime[roomName] > 10)) {
                try {
                    Memory.limitList[roomName] = room && room.controller && room.controller.my ? getRoomLimits(room, creepsCount) : getNotMyRoomLimits(roomName, creepsCount, stopLongBuilders);
                } catch (e) {
                    console.log(creep.name + " NEEDLIST ERROR: " + e.toString() + " => " + e.stack);
                    Game.notify(creep.name + " NEEDLIST ERROR: " + e.toString() + " => " + e.stack);
                }
                Memory.limitTime[roomName] = Game.time;
            }

            for (let limit of Memory.limitList[roomName]) {
                let notEnoughBody = 0;
                let hasBodyLimits = 0;
                if (limit["body"]) {
                    for (let part in limit["body"]) {
                        if (limit["body"][part])
                            hasBodyLimits = 1;
                        if ((bodyCount[limit.role + "," + part] || 0) < limit["body"][part])
                            notEnoughBody = 1;
                    }
                }
                if ( (creepsCount[limit.countName] || 0) < limit.count && (!hasBodyLimits || notEnoughBody) ) {
                    needList.push(limit);
                    creepsCount[limit.countName] = (creepsCount[limit.countName] || 0) + 1;
                }
            }
        }

        if (room && Memory.rooms[roomName].type == 'my') {
            towerAction(room);
            linkAction(room);
        }
        global.cache.stat.updateRoom(roomName, 'cpu', Game.cpu.getUsed() - lastCPU);
    });
    global.cache.stat.addCPU("needList");
    if (Game.time % PERIOD_NEEDLIST == 1)
        console.log("needList=" + JSON.stringify(_.countBy(needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } ), function(l) {return l.roomName + '.' + l.countName})));
    
    let skipSpawnNames = {};
    let skipRoomNames = {};
    let reservedEnergy = {};
    for (let need of needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } )) {
        if (!_.filter(Game.spawns, s => 
                !s.spawning && 
                !(s.name in skipSpawnNames) && 
                !(s.room.name in skipRoomNames) &&
                !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.ticksToLive < 1000)  
        ).length) {
            //console.log("All spawns are spawning");
            break;
        }
        
        let res = getSpawnForCreate(need, skipSpawnNames, skipRoomNames, reservedEnergy);
        if (res[0] == -2) {
            //console.log("needList: " + need.role + " for " + need.roomName + " has no spawns in range");
        } else if (res[0] == -1) {
            if (res[1])
                skipRoomNames[res[1]] = 1;
            //console.log("needList: " + need.role + " for " + need.roomName + " return waitSpawnName=" + res[1]);
        } else if (res[0] == -3) {
            console.log("needList: " + need.role + " for " + need.roomName + " has no spawns with enough energyCapacity");
        } else if (res[0] == 0) {
            let spawn = res[1];
            let energy = res[2];
            if(!(need.role in objectCache))
                objectCache[need.role] = require('role.' + need.role);
            let [body, leftEnergy] = objectCache[need.role].create(energy, need.arg);
            
            let newName = spawn.createCreep(body, need.role + "-" + _.round(Math.random()*1000), {
                "role": need.role,
                "spawnName": spawn.name,
                "roomName" : need.roomName,
                "energy" : energy - leftEnergy,
                "body" : body,
                "arg" : need.arg,
                "countName": need.countName,
                /*
                "stat" : {
                    spentEnergy : 0,
                    gotEnergy : 0,
                    CPU : 0,
                    moves : 0,
                },
                */
            });
            if(newName) {
                reservedEnergy[spawn.room.name] = (reservedEnergy[spawn.room.name] || 0) + (energy - leftEnergy);
                global.cache.stat.updateRoom(need.roomName, 'create', -1 * (energy - leftEnergy));
            }
            skipSpawnNames[spawn.name] = 1;
            
            //let newName = need.role;
            console.log(newName + " (arg: " + JSON.stringify(need.arg) + ") BURNING by " + spawn.room.name + '.' + spawn.name + " for " + need.roomName + ", energy (" + energy + "->" + leftEnergy + ":" + (energy - leftEnergy) + ") " + body.length + ":[" + body + "]");
        }
    }
    global.cache.stat.addCPU("create");
    global.cache.stat.finish();
});
};

function linkAction (room) {
    if (!room.storage)
        return;
    let links_to = room.storage.pos.findInRange(FIND_STRUCTURES, 2, {filter: s => s.structureType == STRUCTURE_LINK});
    if (!links_to.length)
        return;
    let link_to = links_to[0];

    for (let link_from of room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK})) {
        //console.log("linkAction: in " + room.name + " " + link_from.id + " -> " + link_to.id);
        if (link_from.id == link_to.id)
            continue;
        if (!link_from.cooldown && link_from.energy && link_to.energy < link_to.energyCapacity*0.7)
            link_from.transferEnergy(link_to);
    }
}

function getNotMyRoomLimits (roomName, creepsCount, stopLongBuilders) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[roomName] || {structures : {}};
    let fcount = _.countBy(_.filter(Game.flags, f => f.pos.roomName == roomName), f => f.name.substring(0,f.name.indexOf('.')) );
    let builds = (memory.constructions || 0) - (memory.constructionsRoads || 0);
    let repairs = memory.repairs || 0;
    let liteClaimer = memory.type == 'reserved' && memory.reserveEnd - Game.time > 3000 ? 1 : 0;
    let sourcesForWork = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let sourcesCapacity = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.energyCapacity);
    let sourcesWorkCapacity = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom ? s.energyCapacity : 0);
    let antikeepersCount = (creepsCount["antikeeper-a"] || 0) + (creepsCount["antikeeper-r"] || 0);
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);

    let needSpeed = sourcesCapacity / ENERGY_REGEN_TIME;
    let needWorkSpeed = sourcesWorkCapacity / ENERGY_REGEN_TIME;
    let haveSpeed = 0;
    let haveWorkSpeed = 0;
    _.forEach( _.filter(Game.creeps, c => c.memory.role == "longharvester" && c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), function(c) {
        let carryCapacity = _.sum(c.body, p => p.type == CARRY) * CARRY_CAPACITY;
        let workParts = _.sum(c.body, p => p.type == WORK);
        let workSpeed = workParts * HARVEST_POWER;
        let workTicks = workParts > 1 && haveWorkSpeed < needWorkSpeed ? carryCapacity/workSpeed : 0;
        let carryDistance = Game.map.getRoomLinearDistance(c.memory.containerRoomName, roomName) * 50 * 2;
        haveSpeed += carryCapacity / (carryDistance + workTicks);
        if (workParts > 1)
            haveWorkSpeed += carryCapacity / (carryDistance + workTicks);
        
    });
    let needHarvester = needSpeed > haveSpeed || needWorkSpeed > haveWorkSpeed ? 1 : 0;
    let workerHarvester = sourcesWorkCapacity > 0 ? 1 : 0;
    console.log(`getNotMyRoomLimits for ${roomName}: needSpeed=${needSpeed}, haveSpeed=${haveSpeed}, needWorkSpeed=${needWorkSpeed}, haveWorkSpeed=${haveWorkSpeed}, needHarvester=${needHarvester}`);
        
    if (!fcount["Antikeeper"] && !fcount["Source"] && !fcount["Controller"])
        return [];
    
    let limits = [];
    limits.push({
        "role" : "defender",
        "count" : !fcount["Antikeeper"] && Game.roomsHelper.getHostilesCount(roomName) > 1 ? 1 : 0,
        "priority" : 3,
        "wishEnergy" : 1500,
        "minEnergy" : 1500,
        "range": 3,
    },{
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] ? 0 : needHarvester * sourcesForWork,
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "maxEnergy" : 3000,
    },{
        "role" : "claimer",
        "count" : fcount["Controller"],
        "arg" : liteClaimer,
        "priority" : 11,
        "minEnergy" : liteClaimer ? 650 : 1300,
        "wishEnergy" : 1300,
        "range" : 2,
    },{
        "role" : "longminer",
        "count" : fcount["Antikeeper"] ? 0 : pairedSources,
        "priority" : 12,
        "wishEnergy" : 1060,
        "minEnergy" : 1060,
        "range" : 3,
    },{
        "role" : "longbuilder",
        "count" : fcount["Build"] && !stopLongBuilders && builds && !(fcount["Antikeeper"] && !antikeepersCount) ? 1 : 0,
        "priority" : 13,
        "wishEnergy" : 1500,
        "range" : 2,
        "maxEnergy" : 2000,
    },{
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] || !needHarvester ? 0 : (creepsCount["longharvester"] || 0) + 1,
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 14,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "maxEnergy" : 3000,
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"] ? 1 : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 3580,
        "minEnergy" : 3580,
        "range" : 3,
        "arg" : 1,
        "countName" : "antikeeper-a",
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"] ? 1 : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 3860,
        "minEnergy" : 3860,
        "range" : 3,
        "arg" : 0,
        "countName" : "antikeeper-r",
    },{
        "role" : "longharvester",
        "count" : antikeepersCount ? needHarvester * sourcesForWork : 0,
        "arg" : {work: workerHarvester, attack: 0},
        "priority" : 16,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 5,
        "maxEnergy" : 4000,
    },{
        "role" : "longminer",
        "count" : antikeepersCount ? pairedSources : 0,
        "arg" : 1,
        "priority" : 17,
        "wishEnergy" : 1200,
        "minEnergy" : 1200,
        "range" : 3,
    },{
        "role" : "longharvester",
        "count" : antikeepersCount && needHarvester ? (creepsCount["longharvester"] || 0) + 1 : 0,
        "arg" : {work: workerHarvester, attack: 0},
        "priority" : 18,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 5,
        "maxEnergy" : 4000,
    });

    for (let limit of limits) {
        limit["roomName"] = roomName;
        limit["originalEnergyCapacity"] = 0;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(roomName + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getRoomLimits (room, creepsCount) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[room.name] || {structures : {}};

    let builds = (memory.constructions || 0) - (memory.constructionsRoads || 0);
    let repairs = memory.repairs || 0;
    let unminerSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom);
    let sources = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);
    let countHarvester = _.ceil((memory.structures[STRUCTURE_EXTENSION] || []).length / 15) + _.floor((memory.structures[STRUCTURE_TOWER] || []).length / 3);
    let storagedLink = _.sum(memory.structures[STRUCTURE_LINK], l => l.storaged);
    let extraUpgraders = utils.clamp( _.floor(memory.energy / UPGRADERS_EXTRA_ENERGY), 0, 2);
    
    let limits = [];
    limits.push({
            "role" : "harvester",
            "count" : 1,
            "arg" : unminerSources ? 1 : 0,
            "priority" : 1,
            "wishEnergy" : 300,
    },{
            "role" : "miner",
            "count" : _.min([pairedSources, 1]),
            "priority" : 1,
            "wishEnergy" : 650,
            "body" : {
                "work" : 5 * _.min([pairedSources, 1]),
            },
    },{
            "role" : "defender",
            "count" : Game.roomsHelper.getHostilesCount(room.name) * 2,
            "arg" : memory.structures[STRUCTURE_TOWER] ? 1 : 0,
            "priority" : 1,
            "wishEnergy" : 1500,
            "minEnergy" : 1500,
    },{
            "role" : "harvester",
            "count" : countHarvester,
            "arg" : unminerSources ? 1 : 0,
            "priority" : 2,
            "wishEnergy" : 1350,
            "body" : {
                "work" : 10*unminerSources,
                "carry" : 10*countHarvester,
            },
    },{
            "role" : "miner",
            "count" : pairedSources,
            "priority" : 2,
            "minEnergy" : 700,
            "wishEnergy" : 700,
    },{
            role : "upgrader",
            "count" : 1,
            "priority" : 3,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
    },{
            "role" : "builder",
            "count" : (builds ? 1 : 0) + (repairs > 10 ? 2 : (repairs ? 1 : 0)),
            "priority" : 4,
            "wishEnergy" : 1500,
            "maxEnergy" : builds ? 3000 : 2000,
            "body" : {
                "carry" : (builds ? 6 : 0 ) + (repairs > 10 ? 18 : (repairs ? 9 : 0)),
            },
    },{
            "role" : "shortminer",
            "count" : storagedLink ? 1 : 0, // TODO: harvester count
            "priority" : 5,
            "wishEnergy" : 300,
    },{
            role : "upgrader",
            "count" : builds ? 1 : sources + extraUpgraders,
            "priority" : 6,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
    },{
            role : "scout",
            "count" : memory.scoutCount || 0,
            "priority" : 1,
            "wishEnergy" : 50,
    });

    for (let limit of limits) {
        limit["roomName"] = room.name;
        limit["originalEnergyCapacity"] = room.energyCapacityAvailable;
        limit["range"] = 2;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
        if (!("countName" in limit))
            limit["countName"] = limit.role;
    }

    //console.log(room.name + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getSpawnForCreate (need, skipSpawnNames, skipRoomNames, reservedEnergy) {
    let spawnsInRange = _.filter(Game.spawns, s => 
        (Game.map.getRoomLinearDistance(s.room.name, need.roomName) || 0) <= need.range &&
        !s.spawning && 
        !(s.name in skipSpawnNames) && 
        !(s.room.name in skipRoomNames) &&
        !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.memory.needRepair)  
    );
    
    if (!spawnsInRange.length)
        return [-2];
    
    //if (need.minEnergy && _.maxBy(spawnsInRange, function(s) {return s.room.energyCapacityAvailable} ).room.energyCapacityAvailable < need.minEnergy)
    //    return [-3];

    let waitRoomName = null;
    for (let spawn of spawnsInRange.sort( function(a,b) { 
        return (Game.map.getRoomLinearDistance(a.room.name, need.roomName) - Game.map.getRoomLinearDistance(b.room.name, need.roomName)) || (a.room.energyAvailable - b.room.energyAvailable); 
    } )) {
        if (spawn.room.name == waitRoomName)
            continue;
        let energy = spawn.room.energyAvailable - (reservedEnergy[spawn.room.name] || 0);
        //console.log("getSpawnForCreate: " + need.roomName + " wants " + need.role + ", skipSpawnNames=" + JSON.stringify(skipSpawnNames) + ":" + spawn.name + " minEnergy=" + need.minEnergy + ", energyAvailable=" + spawn.room.energyAvailable);
        if (
            energy >= need.minEnergy &&
            (
                energy >= need.wishEnergy ||
                energy >= spawn.room.energyCapacityAvailable && energy >= need.originalEnergyCapacity
            )
        ) {
            if (need.maxEnergy && energy > need.maxEnergy)
                energy = need.maxEnergy;
            return [0, spawn, energy];
        } else if (!waitRoomName && spawn.room.energyCapacityAvailable >= need.minEnergy) {
            waitRoomName = spawn.room.name;
        }
    }

    return [-1, waitRoomName];
}

function towerAction (room) {
    let towers = room.getTowers();
    if (!towers.length)
        return;
    
    let dstructs = room.find(FIND_STRUCTURES, {filter: s => s.structureType != STRUCTURE_ROAD && s.hits < 0.5*s.hitsMax && s.hits < 10000});

    for(let tower of towers) {
        let target;
        if(target = room.find(FIND_HOSTILE_CREEPS).sort(function (a,b) { return a.hits - b.hits;})[0]) {
            tower.attack(target);
            console.log("Tower " + room.name + "." + tower.id + " attacked hostile: owner=" + target.owner.username + "; hits=" + target.hits);
        } else if (target = room.find(FIND_MY_CREEPS, {filter : c => c.hits < c.hitsMax})[0]) {
            tower.heal(target);
            console.log("Tower " + room.name + "." + tower.id + " healed " + target.name + " (" + target.hits + "/" + target.hitsMax + ")");
        } else if(dstructs.length && tower.energy > 700) {
            let dstruct = dstructs.sort(function (a,b) {return a.hits - b.hits;})[0];
            tower.repair(dstruct);
        }
    }
}