var utils = require('utils');
var statObject = require('stat');

module.exports.loop = function () {
    var stat = statObject.init();
    var moveErrors = {};
    var rolesCount = {};
    var objectCache = {};
    if(!Memory.targets)
        Memory.targets = {};

    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log(name + " DEAD (" + Memory.creeps[name].roomName + ")");
            statObject.die(name);
            delete Memory.creeps[name];
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            moveErrors[Game.creeps[name].room.name] = 1;
        }
    }
    statObject.addCPU("memory");

    let creepsCPUStat = {};
    for(let creep_name in Game.creeps) {
        let creep = Game.creeps[creep_name];
        if(creep.spawning) {
            continue;
        }
        let role = creep.memory.role;
        if(!(role in rolesCount))
            rolesCount[role] = {};
        if(!(role in objectCache))
            objectCache[role] = require('role.' + role);
        
        if (creep.ticksToLive > 200)
            rolesCount[role][creep.memory.roomName] = (rolesCount[role][creep.memory.roomName] || 0) + 1;
        
        if(moveErrors[creep.room.name]) {
            if(creep.moveTo(creep.room.controller) == OK)
                creep.memory.errors = 0;
            continue;
        }
        
        let lastCPU = Game.cpu.getUsed();
        
        objectCache[role].run(creep);
            
        creep.memory.stat.CPU += (Game.cpu.getUsed() - lastCPU);
        if (!creepsCPUStat[creep.memory.role])
            creepsCPUStat[creep.memory.role] = {"cpu" : 0, "sum" : 0};
        
        creepsCPUStat[creep.memory.role]["cpu"] += (Game.cpu.getUsed() - lastCPU);
        creepsCPUStat[creep.memory.role]["sum"]++;

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
        
    }
    statObject.addCPU("run", creepsCPUStat);
    
    stat.roles = JSON.parse(JSON.stringify(rolesCount));
    
    if (!Memory.limitList || !Memory.limitTime) {
        Memory.limitList = {};
        Memory.limitTime = {};
    }
    let needList = [];

    let longbuilders = _.filter(Game.creeps, c => c.memory.role == "longbuilder" && (c.ticksToLive > 200 || c.spawning)).length;
    let buildFlags = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build').length;
    let stopLongBuilders = longbuilders * 1.5 >= buildFlags;
    let roomsCPUStat = {};
    _.forEach(
        _.uniq(_.map (Game.flags, 'pos.roomName') ).concat( 
        _.map( _.filter(Game.rooms, r => r.controller && r.controller.my), 'name' ) 
    ),
    function(roomName) {
        let lastCPU = Game.cpu.getUsed();
        roomsCPUStat[roomName] = {
            cpu: 0,
            towers: 0,
            links: 0,
        };
        let room = Game.rooms[roomName];
        let creepsCount =  _.countBy(_.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > 200 || c.spawning) ), 'memory.role');
        let bodyCount = _.countBy( _.flatten( _.map( _.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > 200 || c.spawning) ), function(c) { return _.map(c.body, function(p) {return c.memory.role + "," + p.type;});}) ) );

        if (!Memory.limitList[roomName] || !Memory.limitTime[roomName] || (Game.time - Memory.limitTime[roomName] > 10)) {
            Memory.limitList[roomName] = room && room.controller && room.controller.my ? getRoomLimits(room, creepsCount) : getNotMyRoomLimits(roomName, creepsCount, stopLongBuilders);
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

        if (room) {
            let localCPU = Game.cpu.getUsed();
            towerAction(room, creepsCount["upgrader"] ? 1 : 0);
            roomsCPUStat[roomName].towers = Game.cpu.getUsed() - localCPU;
            localCPU = Game.cpu.getUsed();
            linkAction(room);
            roomsCPUStat[roomName].links = Game.cpu.getUsed() - localCPU;
        }
        roomsCPUStat[roomName].cpu = Game.cpu.getUsed() - lastCPU;
    }); // each flag end
    statObject.addCPU("needList", roomsCPUStat);
    if (Game.time % 20 == 0)
        console.log("needList=" + JSON.stringify(_.countBy(needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } ), function(l) {return l.roomName + '.' + l.role})));
    
    let skipSpawnNames = {};
    let reservedEnergy = {};
    for (let need of needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } )) {
        if (!_.filter(Game.spawns, s => 
                !s.spawning && 
                !(s.name in skipSpawnNames) && 
                !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.ticksToLive < 1000)  
        ).length) {
            //console.log("All spawns are spawning");
            break;
        }
        
        let res = getSpawnForCreate(need, skipSpawnNames, reservedEnergy);
        if (res[0] == -2) {
            //console.log("needList: " + need.role + " for " + need.roomName + " has no spawns in range");
        } else if (res[0] == -1) {
            if (res[1])
                skipSpawnNames[res[1]] = 1;
            //console.log("needList: " + need.role + " for " + need.roomName + " return waitSpawnName=" + res[1]);
        } else if (res[0] == -3) {
            console.log("needList: " + need.role + " for " + need.roomName + " has no spawns with enough energyCapacity");
        } else if (res[0] == 0) {
            let spawn = res[1];
            let energy = res[2];
            if(!(need.role in objectCache))
                objectCache[need.role] = require('role.' + need.role);
            let [body, leftEnergy] = objectCache[need.role].create(energy, need.arg);
            
            let newName = spawn.createCreep(body, need.role + "." + Math.random().toFixed(2), {
                "role": need.role,
                "spawnName": spawn.name,
                "roomName" : need.roomName,
                "energy" : energy - leftEnergy,
                "body" : body,
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
            console.log(newName + " BURNING by " + spawn.room.name + '.' + spawn.name + " for " + need.roomName + ", energy (" + energy + "->" + leftEnergy + ":" + (energy - leftEnergy) + ") " + body.length + ":[" + body + "]");
        }
    }
    statObject.addCPU("create");
    statObject.addCPU("finish");
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
    let room = Game.rooms[roomName];
    //console.log(roomName + ": start observing");

    let fcount = _.countBy(_.filter(Game.flags, f => f.pos.roomName == roomName), f => f.name.substring(0,f.name.indexOf('.')) );
    let scount = room ? _.countBy(room.find(FIND_STRUCTURES), 'structureType' ) : {};
    scount["source"] = room ? room.find(FIND_SOURCES).length : 0;

    let repairLimit = utils.roomConfig[roomName] ? utils.roomConfig[roomName].repairLimit : 250000;
    let builds = room ? room.find(FIND_MY_CONSTRUCTION_SITES).length : 0;
    let repairs = room ? room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 && s.hits < repairLimit } ).length : 0;
    let reservation = room && room.controller && room.controller.reservation ? room.controller.reservation.ticksToEnd : 0;
    let liteClaimer = reservation > 3000 ? 1 : 0;
    let allMiners = _.filter(Game.creeps, c => c.memory.role == "longminer" && c.memory.roomName == roomName).length;
    let workerHarvester = scount[STRUCTURE_CONTAINER] && scount["source"] && scount[STRUCTURE_CONTAINER] >= scount["source"] && allMiners >= scount[STRUCTURE_CONTAINER] ? 0 : 1;
    let sourcesForWork = fcount["Source"] ? _.max([fcount["Source"], scount["source"]]) : 0;
    
    let limits = [];
    limits.push({
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] ? 0 : sourcesForWork,
        "arg" : workerHarvester,
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 10*sourcesForWork : 0,
            "carry" : 20*sourcesForWork,
        },
        "maxEnergy" : 2000,
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
        "count" : fcount["Antikeeper"] ? 0 : scount[STRUCTURE_CONTAINER],
        "priority" : 12,
        "wishEnergy" : 1060,
        "range" : 3,
        "body" : {
            "work" : 6 * scount[STRUCTURE_CONTAINER],
        },
    },{
        "role" : "longbuilder",
        "count" : fcount["Antikeeper"] ? 0 : (stopLongBuilders ? 0 : (builds ? 1 : 0) + (repairs ? 1 : 0)),
        "priority" : 13,
        "wishEnergy" : 1500,
        "range" : 2,
        "maxEnergy" : 2000,
    },{
        "role" : "longharvester",
        "count" : fcount["Antikeeper"] ? 0 : sourcesForWork * (2 + workerHarvester),
        "arg" : workerHarvester,
        "priority" : 14,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 20 * 3 * sourcesForWork : 0,
            "carry" : 20 * 2 * sourcesForWork,
        },
        "maxEnergy" : 2000,
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"],
        "priority" : 15,
        "wishEnergy" : 4900,
        "minEnergy" : 4900,
        "range" : 3,
    },{
        "role" : "longharvester",
        "count" : creepsCount["antikeeper"] ? sourcesForWork * (3 + workerHarvester) : 0,
        "arg" : workerHarvester,
        "priority" : 16,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 5,
        "body" : {
            "work" : workerHarvester ? 20 * 4 * sourcesForWork : 0,
            "carry" : 20 * 3 * sourcesForWork,
        },
        "maxEnergy" : 2000,
    },{
        "role" : "longminer",
        "count" : creepsCount["antikeeper"] ? scount[STRUCTURE_CONTAINER] : 0,
        "arg" : 1,
        "priority" : 17,
        "wishEnergy" : 1700,
        "range" : 3,
        "body" : {
            "work" : 10 * scount[STRUCTURE_CONTAINER],
        },
    },{
        "role" : "attacker",
        "count" : fcount["War"] ? (Memory.attackerCount || 0) : 0,
        "priority" : 1,
        "wishEnergy" : 1300,
        "minEnergy" : 1300,
        "maxEnergy" : 1300,
        "range" : 5,
    },{
        "role" : "healer",
        "count" : fcount["War"] ? (Memory.healerCount || 0) : 0,
        "priority" : 1,
        "wishEnergy" : 1500,
        "minEnergy" : 1500,
        "maxEnergy" : 1500,
        "range" : 5,
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
    //console.log(room.name + ": start observing");
    let scount = _.countBy(room.find(FIND_STRUCTURES), 'structureType' );
    scount["source"] = room.find(FIND_SOURCES).length;
    scount["construction"] = room.find(FIND_MY_CONSTRUCTION_SITES).length;
    let repairLimit = utils.roomConfig[room.name] ? utils.roomConfig[room.name].repairLimit : 100000;
    scount["repair"] = room.find(FIND_STRUCTURES, { filter : s => s.hits < s.hitsMax*0.9 && s.hits < repairLimit }).length;
    let hostiles = room.find(FIND_HOSTILE_CREEPS, {filter: h => h.getActiveBodyparts(HEAL)}).length;
    scount["sourceLink"] = room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK && _.some(s.pos.findInRange(FIND_SOURCES, 2)) }).length;

    let workerHarvester = scount[STRUCTURE_CONTAINER] && creepsCount["miner"] ? 0 : 1;
    let countHarvester = _.ceil((scount[STRUCTURE_EXTENSION] || 0) / 15) + _.floor((scount[STRUCTURE_TOWER] || 0) / 3);
    
    let limits = [];
    limits.push({
            "role" : "harvester",
            "count" : 1,
            "arg" : workerHarvester,
            "priority" : 1,
            "wishEnergy" : 300,
    },{
            "role" : "miner",
            "count" : _.min([scount[STRUCTURE_CONTAINER] + scount["sourceLink"], scount["source"], 1]),
            "priority" : 1,
            "wishEnergy" : 650,
            "body" : {
                "work" : 5 * _.min([scount[STRUCTURE_CONTAINER] + scount["sourceLink"], scount["source"], 1]),
            },
    },{
            "role" : "defender",
            "count" : hostiles * 2,
            "arg" : scount[STRUCTURE_TOWER] ? 1 : 0,
            "priority" : 1,
            "wishEnergy" : 1500,
            "minEnergy" : 1500,
    },{
            "role" : "harvester",
            "count" : countHarvester,
            "arg" : workerHarvester,
            "priority" : 2,
            "wishEnergy" : 1350,
            "body" : {
                "work" : workerHarvester ? 10*scount["source"] : 0,
                "carry" : 10*countHarvester,
            },
    },{
            "role" : "miner",
            "count" : _.min([scount[STRUCTURE_CONTAINER] + scount["sourceLink"], scount["source"]]),
            "priority" : 2,
            "wishEnergy" : 650,
            "body" : {
                "work" : 5 * _.min([scount[STRUCTURE_CONTAINER] + scount["sourceLink"], scount["source"]]),
            },
    },{
            role : "upgrader",
            "count" : 1,
            "priority" : 3,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
    },{
            "role" : "builder",
            "count" : (scount["construction"] || scount["repair"] && !scount[STRUCTURE_TOWER]) ? 3 : 0,
            "priority" : 4,
            "wishEnergy" : 1500,
            "body" : {
                "carry" : (scount["construction"] || scount["repair"] && !scount[STRUCTURE_TOWER]) ? 9 : 0,
            },
    },{
            role : "upgrader",
            "count" : scount["construction"] ? 1 : scount["source"],
            "priority" : 5,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
    },{
            "role" : "shortminer",
            "count" : (scount[STRUCTURE_LINK] >= 2 && scount[STRUCTURE_STORAGE]) ? 1 : 0, // TODO: harvester count
            "priority" : 6,
            "wishEnergy" : 300,
    },{
            "role" : "upgrader",
            "count" : scount["construction"] ? 1 : scount["source"],
            "priority" : 20,
            "wishEnergy" : 1500,
            "maxEnergy" : 2000,
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

function getSpawnForCreate (need, skipSpawnNames, reservedEnergy) {
    let spawnsInRange = _.filter(Game.spawns, s => 
        Game.map.getRoomLinearDistance(s.room.name, need.roomName) <= need.range &&
        !s.spawning && 
        !(s.name in skipSpawnNames) && 
        !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.memory.needRepair)  
    );
    
    if (!spawnsInRange.length)
        return [-2];
    
    //if (need.minEnergy && _.maxBy(spawnsInRange, function(s) {return s.room.energyCapacityAvailable} ).room.energyCapacityAvailable < need.minEnergy)
    //    return [-3];

    let waitSpawnName = null;
    for (let spawn of spawnsInRange.sort( function(a,b) { 
        return (Game.map.getRoomLinearDistance(a.room.name, need.roomName) - Game.map.getRoomLinearDistance(b.room.name, need.roomName)) || (a.room.energyAvailable - b.room.energyAvailable); 
    } )) {
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
        } else if (!waitSpawnName && spawn.room.energyCapacityAvailable >= need.minEnergy) {
            waitSpawnName = spawn.name;
        }
    }

    return [-1, waitSpawnName];
}

function towerAction (room, canRepair) {
    let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER });
    if (!towers.length)
        return;
    
    let energy = _.sum(room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_STORAGE}), 'store.energy');
    if (energy < room.energyCapacityAvailable)
        canRepair = 0;
    let repairLimit = canRepair ? (utils.roomConfig[room.name] ? utils.roomConfig[room.name].repairLimit : 100000) : 10000;
    let dstructs = room.find(FIND_STRUCTURES, {filter: s => s.hits < 0.9*s.hitsMax && s.hits < repairLimit});

    for(let tower of towers) {
        let target;
        if(target = room.find(FIND_HOSTILE_CREEPS).sort(function (a,b) { return a.hits - b.hits;})[0]) {
            tower.attack(target);
            console.log("Tower " + tower.id + " attacked hostile: owner=" + target.owner.username + "; hits=" + target.hits);
        } else if (target = room.find(FIND_MY_CREEPS, {filter : c => c.hits < c.hitsMax})[0]) {
            tower.heal(target);
            console.log("Tower " + tower.id + " healed " + target.name + " (" + target.hits + "/" + target.hitsMax + ")");
        } else if(dstructs.length && tower.energy > 700) {
            let dstruct = dstructs.sort(function (a,b) {return a.hits - b.hits;})[0];
            tower.repair(dstruct);
        }
    }
}