require('constants');
require('prototype.room');
require('prototype.creep');
var utils = require('utils');
var statObject = require('stat');
const profiler = require('screeps-profiler');
// This line monkey patches the global prototypes. 
// profiler.enable();

module.exports.loop = function () {
profiler.wrap(function() {
    var stat = statObject.init();
    var moveErrors = {};
    //var rolesCount = {};
    var objectCache = {};
    var roomNames = _.uniq( 
        _.map (Game.flags, 'pos.roomName').concat( 
        _.map( Game.rooms, 'name' ) ).concat( 
        Object.keys(Memory.rooms) ) 
    );
    Memory.energyWanted = _.reduce( _.filter(Game.creeps, c => c.memory.energyID), function (sum, value, key) { 
            sum[value.memory.energyID] = sum[value.memory.energyID] || {energy : 0, creepsCount : 0};
            sum[value.memory.energyID].energy += value.carryCapacity - value.carry.energy;
            sum[value.memory.energyID].creepsCount++;
            return sum; 
    }, {});
    
    //if(!("targets" in Memory))
    //    Memory.targets = {};
    if(!("warning" in Memory))
        Memory.warning = {};

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log(name + " DEAD (" + Memory.creeps[name].roomName + ")");
            //statObject.die(name);
            delete Memory.creeps[name];
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            moveErrors[Game.creeps[name].room.name] = 1;
        }
    }
    statObject.addCPU("memory");

    _.forEach(roomNames, function(roomName) {
        if (Game.rooms[roomName])
            Game.rooms[roomName].update();
    });
    
    statObject.addCPU("roomUpdate");

    let creepsCPUStat = {};
    for(let creep_name in Game.creeps) {
        let creep = Game.creeps[creep_name];
        if(creep.spawning) {
            continue;
        }
        let role = creep.memory.role;
        //if(!(role in rolesCount))
        //    rolesCount[role] = {};
        if(!(role in objectCache))
            objectCache[role] = require('role.' + role);
        
        //if (creep.ticksToLive > ALIVE_TICKS)
        //    rolesCount[role][creep.memory.roomName] = (rolesCount[role][creep.memory.roomName] || 0) + 1;
        
        if(moveErrors[creep.room.name]) {
            if(creep.moveTo(creep.room.controller) == OK)
                creep.memory.errors = 0;
            continue;
        }
        
        let lastCPU = Game.cpu.getUsed();
        
        try {
            objectCache[role].run(creep);
        } catch (e) {
            console.log(creep.name + " RUNNING ERROR: " + e);
            Game.notify(creep.name + " RUNNING ERROR: " + e);
        }
        
        
        if (!creepsCPUStat[creep.memory.role])
            creepsCPUStat[creep.memory.role] = {"cpu" : 0, "sum" : 0};
        
        creepsCPUStat[creep.memory.role]["cpu"] += (Game.cpu.getUsed() - lastCPU);
        creepsCPUStat[creep.memory.role]["sum"]++;

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
    statObject.addCPU("run", creepsCPUStat);
    
    //stat.roles = JSON.parse(JSON.stringify(rolesCount));
    
    if (!Memory.limitList || !Memory.limitTime) {
        Memory.limitList = {};
        Memory.limitTime = {};
    }
    let needList = [];

    let longbuilders = _.filter(Game.creeps, c => c.memory.role == "longbuilder" && (c.ticksToLive > ALIVE_TICKS || c.spawning)).length;
    let buildFlags = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build').length;
    let stopLongBuilders = longbuilders * 1.5 >= buildFlags;
    let roomsCPUStat = {};
    _.forEach(roomNames, function(roomName) {
        if (roomName == "undefined")
            return;
        let lastCPU = Game.cpu.getUsed();
        roomsCPUStat[roomName] = {
            cpu: 0,
            towers: 0,
            links: 0,
        };
        let room = Game.rooms[roomName];
        let hostiles = room ? room.find(FIND_HOSTILE_CREEPS, {filter: c => c.owner.username != "Source Keeper"}).length : -1;
        if (hostiles == -1 && Memory.warning[roomName] > 0)
            ; // TODO: can leave room forever
        else
            Memory.warning[roomName] = hostiles;

            

        if (Game.time % PERIOD_NEEDLIST == 1) {
            let creepsCount =  _.countBy(_.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), 'memory.role');
            let bodyCount = _.countBy( _.flatten( _.map( _.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > ALIVE_TICKS + c.body.length*3 || c.spawning) ), function(c) { return _.map(c.body, function(p) {return c.memory.role + "," + p.type;});}) ) );

            if (!Memory.limitList[roomName] || !Memory.limitTime[roomName] || (Game.time - Memory.limitTime[roomName] > 10)) {
                Memory.limitList[roomName] = room && room.controller && room.controller.my ? getRoomLimits(room, creepsCount) : getNotMyRoomLimits(roomName, creepsCount, stopLongBuilders, hostiles);
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
                if ( (creepsCount[limit.role] || 0) < limit.count && (!hasBodyLimits || notEnoughBody) ) {
                    needList.push(limit);
                    creepsCount[limit.role] = (creepsCount[limit.role] || 0) + 1;
                }
            }
        }

        if (room && Memory.rooms[roomName].type == 'my') {
            let localCPU = Game.cpu.getUsed();
            towerAction(room);
            roomsCPUStat[roomName].towers = Game.cpu.getUsed() - localCPU;
            localCPU = Game.cpu.getUsed();
            linkAction(room);
            roomsCPUStat[roomName].links = Game.cpu.getUsed() - localCPU;
        }
        roomsCPUStat[roomName].cpu = Game.cpu.getUsed() - lastCPU;
    });
    statObject.addCPU("needList");
    if (Game.time % PERIOD_NEEDLIST == 1)
        console.log("needList=" + JSON.stringify(_.countBy(needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } ), function(l) {return l.roomName + '.' + l.role})));
    
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
            
            let newName = spawn.createCreep(body, need.role + "." + Math.random().toFixed(3), {
                "role": need.role,
                "spawnName": spawn.name,
                "roomName" : need.roomName,
                "energy" : energy - leftEnergy,
                "body" : body,
                "arg" : need.arg,
                "stat" : {
                    spentEnergy : 0,
                    gotEnergy : 0,
                    CPU : 0,
                    moves : 0,
                },
            });
            if(newName)
                reservedEnergy[spawn.room.name] = (reservedEnergy[spawn.room.name] || 0) + (energy - leftEnergy);
            skipSpawnNames[spawn.name] = 1;
            
            //let newName = need.role;
            console.log(newName + " (arg: " + JSON.stringify(need.arg) + ") BURNING by " + spawn.room.name + '.' + spawn.name + " for " + need.roomName + ", energy (" + energy + "->" + leftEnergy + ":" + (energy - leftEnergy) + ") " + body.length + ":[" + body + "]");
        }
    }
    statObject.addCPU("create");
    statObject.addCPU("finish");
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

function getNotMyRoomLimits (roomName, creepsCount, stopLongBuilders, hostiles) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[roomName] || {structures : {}};
    let fcount = _.countBy(_.filter(Game.flags, f => f.pos.roomName == roomName), f => f.name.substring(0,f.name.indexOf('.')) );
    let builds = memory.constructions || 0;
    let repairs = memory.repairs || 0;
    let liteClaimer = memory.type == 'reserved' && memory.reserveEnd - Game.time > 3000 ? 1 : 0;
    let workerHarvester = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom) ? 1 : 0;
    let sourcesForWork = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let antikeeperArged = _.filter(Game.creeps, c => c.memory.role == "antikeeper" && c.memory.roomName == roomName && c.memory.arg).length;
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);

    if (!fcount["Antikeeper"] && !fcount["Source"] && !fcount["Controller"])
        return [];
    
    let limits = [];
    limits.push({
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] ? 0 : sourcesForWork,
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 10*sourcesForWork : 0,
            "carry" : 20*sourcesForWork,
        },
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
        "count" : fcount["Build"] && !stopLongBuilders && builds && !(fcount["Antikeeper"] && !creepsCount["antikeeper"]) ? 1 : 0,
        "priority" : 13,
        "wishEnergy" : 1500,
        "range" : 2,
        "maxEnergy" : 2000,
    },{
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] ? 0 : sourcesForWork * (2 + workerHarvester),
        "arg" : {work: workerHarvester, attack: 1},
        "priority" : 14,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 20 * 3 * sourcesForWork : 0,
            "carry" : 20 * 2 * sourcesForWork,
        },
        "maxEnergy" : 3000,
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"] && !antikeeperArged ? (creepsCount["antikeeper"]+1) : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 3580,
        "minEnergy" : 3580,
        "range" : 3,
        "arg" : 1,
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"] && antikeeperArged ? 3 : 0,
        "priority" : _.sum(creepsCount) > 5 ? 3 : 15,
        "wishEnergy" : 3860,
        "minEnergy" : 3860,
        "range" : 3,
        "arg" : 0,
    },{
        "role" : "longharvester",
        "count" : creepsCount["antikeeper"] ? sourcesForWork * (3 + workerHarvester) : 0,
        "arg" : {work: workerHarvester, attack: 0},
        "priority" : 17,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 5,
        "body" : {
            "work" : workerHarvester ? 20 * 4 * sourcesForWork : 0,
            "carry" : 30 * 3 * sourcesForWork,
        },
        "maxEnergy" : 4000,
    },{
        "role" : "longminer",
        "count" : creepsCount["antikeeper"] ? pairedSources : 0,
        "arg" : 1,
        "priority" : 18,
        "wishEnergy" : 1200,
        "minEnergy" : 1200,
        "range" : 3,
    });

    for (let limit of limits) {
        limit["roomName"] = roomName;
        limit["originalEnergyCapacity"] = 0;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
    }

    //console.log(roomName + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getRoomLimits (room, creepsCount) {
    let lastCPU = Game.cpu.getUsed();
    let memory = Memory.rooms[room.name] || {structures : {}};

    let builds = memory.constructions || 0;
    let repairs = memory.repairs || 0;
    let unminerSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => !s.minersFrom);
    let sources = (memory.structures[STRUCTURE_SOURCE] || []).length;
    let pairedSources = _.sum(memory.structures[STRUCTURE_SOURCE], s => s.pair);
    let countHarvester = _.ceil((memory.structures[STRUCTURE_EXTENSION] || []).length / 15) + _.floor((memory.structures[STRUCTURE_TOWER] || []).length / 3);
    let storagedLink = _.sum(memory.structures[STRUCTURE_LINK], l => l.storaged);
    let hostiles = memory.hostilesCount && memory.hostilesDeadTime - Game.time > 50 ? 1 : 0;
    
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
            "count" : hostiles * 2,
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
            "maxEnergy" : 3000,
            "body" : {
                "carry" : (builds ? 6 : 0 ) + (repairs > 10 ? 18 : (repairs ? 9 : 0)),
            },
    },{
            role : "upgrader",
            "count" : builds ? 1 : sources,
            "priority" : 5,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
    },{
            "role" : "shortminer",
            "count" : storagedLink ? 1 : 0, // TODO: harvester count
            "priority" : 6,
            "wishEnergy" : 300,
    });

    for (let limit of limits) {
        limit["roomName"] = room.name;
        limit["originalEnergyCapacity"] = room.energyCapacityAvailable;
        limit["range"] = 2;
        if (!("minEnergy" in limit))
            limit["minEnergy"] = 0;
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