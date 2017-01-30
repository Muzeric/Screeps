var utils = require('utils');

var statClass = require('stat');
var stat = statClass.init();

module.exports.loop = function () {
    var moveErrors = {};
    var rolesCount = {};
    var objectCache = {};
    
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log(name + " DEAD (" + Memory.creeps[name].roomName + ")");
            statClass.die(name);
            delete Memory.creeps[name];
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            moveErrors[Game.creeps[name].room.name] = 1;
        }
    }

    let lastCPU = Game.cpu.getUsed();
    let cpuStat = {};
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
        if (!cpuStat[creep.memory.role])
            cpuStat[creep.memory.role] = {"cpu" : 0, "count" : 0};
        
        cpuStat[creep.memory.role]["cpu"] += (Game.cpu.getUsed() - lastCPU);
        cpuStat[creep.memory.role]["count"]++;

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
    
    //console.log(JSON.stringify(_.map(cpuStat, function(v, k) { return k + "=" + _.floor(v.cpu/v.count, 2);})));
    if (Game.time % 20 == 0)   
        console.log("main: rn.CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2));
    lastCPU = Game.cpu.getUsed();
    
    stat.roles = JSON.parse(JSON.stringify(rolesCount));
    
    if (!Memory.limitList || !Memory.limitTime) {
        Memory.limitList = {};
        Memory.limitTime = {};
    }
    let needList = [];

    let longbuilders = _.filter(Game.creeps, c => c.memory.role == "longbuilder" && (c.ticksToLive > 200 || c.spawning)).length;
    let buildFlags = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build').length;
    let stopLongBuilders = longbuilders * 1.5 >= buildFlags;
    _.forEach(
        _.uniq(
        _.map (
        _.filter(
            Game.flags, f => f.name.substring(0, 6) == 'Source' || f.name.substring(0, 10) == 'Controller' || f.name.substring(0, 5) == 'Build'), 'pos.roomName' 
        ) ).concat( 
        _.map( _.filter(Game.rooms, r => r.controller.my), 'name' ) 
    ),
    function(roomName) {
        let room = Game.rooms[roomName];
        let creepsCount =  _.countBy(_.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > 200 || c.spawning) ), 'memory.role');
        let bodyCount = _.countBy( _.flatten( _.map( _.filter(Game.creeps, c => c.memory.roomName == roomName && (c.ticksToLive > 200 || c.spawning) ), function(c) { return _.map(c.body, function(p) {return c.memory.role + "," + p.type;});}) ) );

        if (!Memory.limitList[roomName] || !Memory.limitTime[roomName] || (Game.time - Memory.limitTime[roomName] > 10)) {
            Memory.limitList[roomName] = room && room.controller.my ? getRoomLimits(room, creepsCount) : getNotMyRoomLimits(roomName, creepsCount, stopLongBuilders);
            Memory.limitTime[roomName] = Game.time;
        }

        for (let limit of Memory.limitList[roomName]) {
            let added = 0;
            let notEnoughBody = 0;
            if (limit["body"]) {
                for (let part in limit["body"]) {
                    if (limit["body"][part] && (bodyCount[limit.role + "," + part] || 0) < limit["body"][part]) {
                        //console.log("debug " + roomName + ": " + limit.role + ", " + part + "=" + bodyCount[limit.role + "," + part] + " < " + limit["body"][part]);
                        notEnoughBody = 1;
                    }
                }
            }
            while (
                (creepsCount[limit.role] || 0) + added < limit.count ||
                notEnoughBody && !added
            ) {
                needList.push(limit);
                added++;
            }
        }

        if (room)
            towerAction(room, creepsCount["upgrader"] ? 1 : 0);
    }); // each flag end
    
    if (Game.time % 20 == 0)
        console.log("main: nl.CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; needList=" + JSON.stringify(_.countBy(needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } ), function(l) {return l.roomName + '.' + l.role})));
    lastCPU = Game.cpu.getUsed();

    let skipSpawnNames = {};
    for (let need of needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } )) {
        if (!_.filter(Game.spawns, s => 
                !s.spawning && 
                !(s.name in skipSpawnNames) && 
                !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.ticksToLive < 1000)  
        ).length) {
            //console.log("All spawns are spawning");
            break;
        }
        
        let res = getSpawnForCreate(need, skipSpawnNames);
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
            let energy = spawn.room.energyAvailable;
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
            skipSpawnNames[spawn.name] = 1;
            
            //let newName = need.role;
            console.log(newName + " BURNING by " + spawn.room.name + '.' + spawn.name + " for " + need.roomName + ", energy (" + energy + "->" + leftEnergy + ":" + (energy - leftEnergy) + ") [" + body + "]");
        }
    }

    if (Game.time % 20 == 0)   
        console.log("main: cr.CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2));
    lastCPU = Game.cpu.getUsed();

    let link_to = Game.getObjectById('58771a999d331a0f7f5ae31a');
    for(let link_from of [Game.getObjectById('587869503d6c02904166296f'), Game.getObjectById('5885198c52b1ece7377c7f8b')]) {
        if(link_from && link_to && !link_from.cooldown && link_from.energy && link_to.energy < link_to.energyCapacity*0.7) {
            let res = link_from.transferEnergy(link_to);
            if(res < 0) 
                console.log("Link transfer energy with res=" + res);
        }
    }
};

function getNotMyRoomLimits (roomName, creepsCount, stopLongBuilders) {
    let lastCPU = Game.cpu.getUsed();
    let room = Game.rooms[roomName];
    //console.log(roomName + ": start observing");

    let fcount = _.countBy(_.filter(Game.flags, f => f.pos.roomName == roomName), f => f.name.substring(0,f.name.indexOf('.')) );
    let containers = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' && f.pos.roomName == roomName && f.room && 
        f.pos.findInRange(FIND_STRUCTURES, 2, {filter : s => s.structureType == STRUCTURE_CONTAINER }).length 
    ).length;

    let repairLimit = utils.roomConfig[roomName] ? utils.roomConfig[roomName].repairLimit : 250000;
    let builds = room ? room.find(FIND_MY_CONSTRUCTION_SITES).length : 0;
    let repairs = room ? room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 && s.hits < repairLimit } ).length : 0;
    let reservation = room && room.controller.reservation ? room.controller.reservation.ticksToEnd : 0;
    let liteClaimer = reservation > 3000 ? 1 : 0;
    let allMiners = _.filter(Game.creeps, c => c.memory.role == "longminer" && c.memory.roomName == roomName).length;
    let workerHarvester = containers && containers >= fcount["Source"] && allMiners >= containers ? 0 : 1;
    
    let limits = [];
    limits.push({
        "role" : "longharvester",
        "count" : fcount["Source"],
        "arg" : workerHarvester,
        "priority" : 10,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 10*fcount["Source"] : 0,
            "carry" : 20,
        },
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
        "count" : containers,
        "priority" : 12,
        "wishEnergy" : 910,
        "range" : 3,
        "body" : {
            "work" : 5 * containers,
        },
    },{
        "role" : "longbuilder",
        "count" : stopLongBuilders ? 0 : (builds ? 1 : 0) + (repairs ? 1 : 0),
        "priority" : 13,
        "wishEnergy" : 1500,
        "range" : 2,
    },{
        "role" : "longharvester",
        "count" : fcount["Source"] * (2 + workerHarvester),
        "arg" : workerHarvester,
        "priority" : 14,
        "minEnergy" : 550,
        "wishEnergy" : 1500,
        "range" : 1,
        "body" : {
            "work" : workerHarvester ? 20*fcount["Source"] : 0,
            "carry" : 20,
        },
    },{
        "role" : "antikeeper",
        "count" : fcount["Antikeeper"],
        "priority" : 1,
        "wishEnergy" : 2300,
        "minEnergy" : 2300,
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
    //console.log(room.name + ": start observing");
    let scount = _.countBy(room.find(FIND_STRUCTURES), 'structureType' );
    scount["source"] = room.find(FIND_SOURCES).length;
    scount["construction"] = room.find(FIND_MY_CONSTRUCTION_SITES).length;
    let repairLimit = utils.roomConfig[room.name] ? utils.roomConfig[room.name].repairLimit : 100000;
    scount["repair"] = room.find(FIND_STRUCTURES, { filter : s => s.hits < s.hitsMax*0.9 && s.hits < repairLimit }).length;

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
            "count" : _.min([scount[STRUCTURE_CONTAINER], scount["source"], 1]),
            "priority" : 1,
            "wishEnergy" : 650,
            "body" : {
                "work" : 5 * _.min([scount[STRUCTURE_CONTAINER], scount["source"], 1]),
            },
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
            "count" : _.min([scount[STRUCTURE_CONTAINER], scount["source"]]),
            "priority" : 2,
            "wishEnergy" : 650,
            "body" : {
                "work" : 5 * _.min([scount[STRUCTURE_CONTAINER], scount["source"]]),
            },
    },{
            role : "upgrader",
            "count" : scount["source"],
            "priority" : 3,
            "wishEnergy" : 1500,
    },{
            "role" : "builder",
            "count" : (scount["construction"] || scount["repair"] && !scount[STRUCTURE_TOWER]) ? 1 : 0,
            "priority" : 4,
            "wishEnergy" : 1500,
    },{
            "role" : "shortminer",
            "count" : (scount[STRUCTURE_LINK] >= 2 && scount[STRUCTURE_STORAGE]) ? 1 : 0, // TODO: harvester count
            "priority" : 5,
            "wishEnergy" : 300,
    },{
            role : "upgrader",
            "count" : scount["source"] + 1,
            "priority" : 20,
            "wishEnergy" : 1500,
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

function getSpawnForCreate (need, skipSpawnNames) {
    let spawnsInRange = _.filter(Game.spawns, s => 
        Game.map.getRoomLinearDistance(s.room.name, need.roomName) <= need.range &&
        !s.spawning && 
        !(s.name in skipSpawnNames) && 
        !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(s) && c.ticksToLive < 1000)  
    );
    
    if (!spawnsInRange.length)
        return [-2];
    
    //if (need.minEnergy && _.maxBy(spawnsInRange, function(s) {return s.room.energyCapacityAvailable} ).room.energyCapacityAvailable < need.minEnergy)
    //    return [-3];

    let waitSpawnName = null;
    for (let spawn of spawnsInRange.sort( function(a,b) { 
        return (Game.map.getRoomLinearDistance(a.room.name, need.roomName) - Game.map.getRoomLinearDistance(b.room.name, need.roomName)) || (b.room.energyAvailable - a.room.energyAvailable); 
    } )) {
        //console.log("getSpawnForCreate: " + need.roomName + " wants " + need.role + ", skipSpawnNames=" + JSON.stringify(skipSpawnNames) + ":" + spawn.name + " minEnergy=" + need.minEnergy + ", energyAvailable=" + spawn.room.energyAvailable);
        if (
            spawn.room.energyAvailable >= need.minEnergy &&
            (
                spawn.room.energyAvailable >= need.wishEnergy ||
                spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable && spawn.room.energyAvailable >= need.originalEnergyCapacity
            )
        )
            return [0, spawn];
        else if (!waitSpawnName && spawn.room.energyCapacityAvailable >= need.minEnergy)
            waitSpawnName = spawn.name;
    }

    return [-1, waitSpawnName];
}

function towerAction (room, canRepair) {
    let towers = room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER });
    for(let tower of towers) {
        let hostile = room.find(FIND_HOSTILE_CREEPS).sort(function (a,b) { return a.hits - b.hits;})[0];
        if(hostile) {
            tower.attack(hostile);
            console.log("Tower " + tower.id + " attacked hostile: owner=" + hostile.owner.username + "; hits=" + hostile.hits);
        } else {
            let needheals = room.find(FIND_MY_CREEPS, {filter : c => c.hits < c.hitsMax});
            if(needheals.length) {
                let creep = needheals[0];
                let res = tower.heal(creep);
                console.log("Tower " + tower.id + " healed " + creep.name + " with res=" + res + " hits: " + creep.hits);
            }

            if (!canRepair)
                continue;

            let repairLimit = utils.roomConfig[room.name] ? utils.roomConfig[room.name].repairLimit : 100000;
            let dstructs = room.find(FIND_STRUCTURES, {
                filter: (structure) => structure.hits < 0.9*structure.hitsMax && structure.hits < repairLimit
            });
            if(dstructs.length && tower.energy > 700) {
                let dstruct = dstructs.sort(function (a,b) {
                    return a.hits - b.hits;
                })[0];
                tower.repair(dstruct);
            }
        }
    }
}