var utils = require('utils');


var spawn_config = {
    "Spawn1" : {
        "creeps" : [
            ["harvester", 1],
            ["miner", 1],
            ["ENERGY", 1500],
            ["attacker", 0, 1300],
            ["harvester", 4],
            ["miner", 2],
            ["upgrader", 1],
            ["longharvester", 3],
            ["REPAIR", 1],
            ["claimer", 3],
            ["longminer", 3],
            ["shortminer", 1],
            ["longbuilder", 1],
            ["longharvester", 5],
            ["builder", 1],
            ["upgrader", 3],
            ["longharvester", 12],
            ["upgrader", 4],
        ],
    },
    "Spawn2" : {
        "creeps" : [
            ["harvester", 1],
            ["miner", 1],
            ["ENERGY", 1500],
            ["harvester", 2],
            ["miner", 1],
            ["upgrader", 1],
            ["REPAIR", 1],
            ["builder", 1],
            ["upgrader", 2],
            ["longbuilder", 1],
            ["longharvester", 3],
            ["upgrader", 4],
        ],
    },
};

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
            moveErrors[Game.creeps[name].memory.roomName] = 1;
        }
    }

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
        
        if(moveErrors[creep.memory.roomName]) {
            if(creep.moveTo(creep.room.controller) == OK)
                creep.memory.errors = 0;
            continue;
        }
        
        let lastCPU = Game.cpu.getUsed();
        
        objectCache[role].run(creep);
            
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
        
    }
    
    stat.roles = JSON.parse(JSON.stringify(rolesCount));
    
if(0) {    
    if (!Memory.limitList || !Memory.limitTime) {
        Memory.limitList = {};
        Memory.limitTime = {};
    }
    let needList = [];
    let lastCPU = Game.cpu.getUsed();
    _.forEach(_.filter(Game.rooms, r => r.controller.my), function(room) {
        let creepsCount =  _.countBy(_.filter(Game.creeps, c => c.memory.roomName == room.name && c.ticksToLive > 200), 'memory.role'); 

        if (!Memory.limitList[room.name] || !Memory.limitTime[room.name] || (Game.time - Memory.limitTime[room.name] > 10)) {
            Memory.limitList[room.name] = getLimits(room, creepsCount);
            Memory.limitTime[room.name] = Game.time;
        }

        for (let limit of Memory.limitList[room.name]) {
            if ((creepsCount[limit.role] || 0) < limit.count)
                needList.push(limit);
        }

        let canRepair = creepsCount["upgrader"] ? 1 : 0;
        // TODO tower actions
    }); // each room end
    
    console.log("needList: CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; list=" + JSON.stringify(needList));
    lastCPU = Game.cpu.getUsed();

    let skipSpawnNames = {};
    for (let need of needList.sort(function(a,b) { return (a.priority - b.priority) || (a.wishEnergy - b.wishEnergy); } )) {
        if (!_.filter(Game.spawns, s => !s.spawning && !s.name in skipSpawnNames).length) {
            console.log("All spawns are spawning");
            break;
        }
        
        let res = getSpawnForCreate(need, skipSpawnNames);
        if (res[0] == -2) {
            console.log("needList: " + need.role + " has no spawns in range");
        } else if (res[0] == -1) {
            if (res[1])
                skipSpawnNames[res[1]] = 1;
            console.log("needList: " + need.role + " return waitSpawnName=" + res[1]);
        } else if (res[0] == -3) {
            console.log("needList: " + need.role + " has no spawns with enough energyCapacity");
        } else if (res[0] == 0) {
            let spawn = res[1];
            console.log("needList: " + need.role + " for room " + need.roomName + " creation by " + spawn.name + " with energy " + spawn.room.energyAvailable);
        }
    }
/*
                // Need, but not enough energy, so break & WAIT
                if (limit.emin && room.energyAvailable < room.energyCapacityAvailable && room.energyAvailable < limit.emin)
                    break;

                // Check, global energy limit
                if (
                    room.energyAvailable >= room.energyCapacityAvailable || 
                    room.energyAvailable >= minEnergy
                ) {
                    let energy = room.energyAvailable;
                    let spawn = spawns.pop();
                    console.log(room.name + ": tries to create " + limit.role + " with energy=" + energy);

                    if(!role in objectCache)
                        objectCache[role] = require('role.' + role);

                    let res = objectCache[role].create(spawn.name, role, energy);
                    
                    if(Game.creeps[res[0]]) {
                        let creepm = Game.creeps[res[0]].memory;
                        creepm.body = res[1].join();
                        creepm.energy = energy - res[2];
                        creepm.roomName = spawn.room.name;
                        creepm.stat = {
                            spentEnergy : 0,
                            gotEnergy : 0,
                            CPU : 0,
                            moves : 0,
                        };
                    }

                    console.log(res[0] + " BORN by " + spawnName + ", energy (" + energy + "->" + res[2] + ":" + (energy - res[2]) + ") [" + res[1] + "]");
                }
*/

}
    
    
    for (let spawnName in spawn_config) {
        //console.log("Start operations for: " + spawnName);
        var spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn: " + spawnName);
            continue;
        }
        
                
        let canRepair = 0;
        if (!spawn.spawning && !_.some(Game.creeps, c => c.memory.role == "harvester" && c.pos.isNearTo(spawn) && c.ticksToLive < 1000) ) {
            let cs = spawn.room.find(FIND_CONSTRUCTION_SITES);
            let rs = [];
            if (!_.some(spawn.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}))) {
                rs = spawn.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 } );
            }
            let addCheck = {
                longbuilder : utils.getLongBuilderTargets() ? 1 : 0,
                builder : ((rolesCount["builder"] ? rolesCount["builder"][spawn.room.name] : 0) < cs.length + rs.length),
            };

            let addCount = {
                claimer : _.sum(Game.flags, f => 
                    f.name.substring(0, 10) == 'Controller' &&
                    !_.some(Game.creeps, c => 
                        c.memory.role == "claimer" && 
                        c.memory.controllerName == f.name && 
                        c.ticksToLive > 200
                    ) 
                ),
                longminer :  _.filter(Game.flags, f => 
                    f.name.substring(0, 6) == 'Source' &&
                    f.room && 
                    f.pos.findInRange(FIND_STRUCTURES, 2, {filter : s => 
                            s.structureType == STRUCTURE_CONTAINER && 
                            !_.some(Game.creeps, c => 
                                c.memory.role == "longminer" &&
                                c.memory.cID == s.id && 
                                c.ticksToLive > 200) 
                    }).length 
                ).length,
            };


            let minEnergy = 300;
            for (let arr of spawn_config[spawnName]["creeps"]) {
                let role = arr[0];
                let climit = arr[1];
                let emin = arr[2];
                let count = (rolesCount[role] ? (rolesCount[role][spawn.room.name]||0) : 0);
    
                //if (spawnName == "Spawn2")
                //    console.log(spawnName + " check " + role + "; climit=" + climit + "; count=" + count + "; addCount=" + addCount[role]);
                
                if (climit <= 0 || role in addCount && addCount[role] <= 0)
                    continue;

                if (role == "ENERGY") {
                    minEnergy = climit;
                    continue;
                } else if (role == "REPAIR") {
                    canRepair = 1;
                    continue;
                }
                if (role in addCheck && !addCheck[role])
                    continue;
                if(!(role in objectCache))
                    objectCache[role] = require('role.' + role);

                if (
                    role in addCount && addCount[role] > 0 ||
                    !(role in addCount) && count < climit
                ) {
                    // Need, but not enough energy, so break & WAIT
                    if (emin && spawn.room.energyAvailable < spawn.room.energyCapacityAvailable && spawn.room.energyAvailable < emin)
                        break;

                    // Check, global energy limit
                    if (
                        spawn.room.energyAvailable >= spawn.room.energyCapacityAvailable || 
                        spawn.room.energyAvailable >= minEnergy
                    ) {
                        let energy = spawn.room.energyAvailable;
                        let res = objectCache[role].create(spawnName, role, energy);
                        
                        if(Game.creeps[res[0]]) {
                            let creepm = Game.creeps[res[0]].memory;
                            creepm.body = res[1].join();
                            creepm.energy = energy - res[2];
                            creepm.roomName = spawn.room.name;
                            creepm.stat = {
                                spentEnergy : 0,
                                gotEnergy : 0,
                                CPU : 0,
                                moves : 0,
                            };
                        }

                        console.log(res[0] + " BORN by " + spawnName + ", energy (" + energy + "->" + res[2] + ":" + (energy - res[2]) + ") [" + res[1] + "]");
                    }
                    break;
                }
                //console.log("Create " + role + " used " + Math.floor(Game.cpu.getUsed() * 100 / Game.cpu.tickLimit) + "% of CPU" );
            }
            //console.log("Enough creeps by " + spawnName);
        } else {
            canRepair = 1;
        }

        let towers = spawn.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER });
        for(let tower of towers) {
            let hostile = tower.room.find(FIND_HOSTILE_CREEPS).sort(function (a,b) { return a.hits - b.hits;})[0];
            if(hostile) {
                tower.attack(hostile);
                console.log("Tower " + tower.id + " attacked hostile: owner=" + hostile.owner.username + "; hits=" + hostile.hits);
            } else {
                if (canRepair) {
                    let repairLimit = utils.roomConfig[tower.room.name].repairLimit || 100000;
                    let dstructs = tower.room.find(FIND_STRUCTURES, {
                        filter: (structure) => structure.hits < 0.9*structure.hitsMax && structure.hits < repairLimit
                    });
                    if(dstructs.length && tower.energy > 700) {
                        let dstruct = dstructs.sort(function (a,b) {
                            return a.hits - b.hits;
                        })[0];
                        tower.repair(dstruct);
                    }
                }
                
                let needheals = tower.room.find(FIND_MY_CREEPS, {filter : c => c.hits < c.hitsMax});
                if(needheals.length) {
                    let creep = needheals[0];
                    let res = tower.heal(creep);
                    console.log("Tower " + tower.id + " healed " + creep.name + " with res=" + res + " hits: " + creep.hits);
                }
            }
        }
    }
    
    let link_to = Game.getObjectById('58771a999d331a0f7f5ae31a');
    for(let link_from of [Game.getObjectById('587869503d6c02904166296f'), Game.getObjectById('5885198c52b1ece7377c7f8b')]) {
        if(link_from && link_to && !link_from.cooldown && link_from.energy && link_to.energy < link_to.energyCapacity*0.7) {
            let res = link_from.transferEnergy(link_to);
            if(res < 0) 
                console.log("Link transfer energy with res=" + res);
        }
    }
};

function getLimits (room, creepsCount) {
    let lastCPU = Game.cpu.getUsed();
    console.log(room.name + ": start observing");
    let scount = _.countBy(room.find(FIND_STRUCTURES), 'structureType' );
    scount["source"] = room.find(FIND_SOURCES).length;
    scount["construction"] = room.find(FIND_MY_CONSTRUCTION_SITES).length;
    let repairLimit = utils.roomConfig[room.name].repairLimit || 100000;
    scount["repair"] = room.find(FIND_STRUCTURES, { filter : s => s.hits < s.hitsMax*0.9 && s.hits < repairLimit }).length;
    
    let limits = [];
    limits.push({
            "role" : "harvester",
            "count" : 1,
            "args" : [scount[STRUCTURE_CONTAINER] && creepsCount["miner"] ? 0 : 1],
            "priority" : 1,
            "wishEnergy" : 300,
    },{
            "role" : "miner",
            "count" : _.min([scount[STRUCTURE_CONTAINER], scount["source"], 1]),
            "priority" : 1,
            "wishEnergy" : 650,
    },{
            "role" : "harvester",
            "count" : _.ceil((scount[STRUCTURE_EXTENSION] || 0) / 15) + _.floor((scount[STRUCTURE_TOWER] || 0) / 3),
            "args" : [scount[STRUCTURE_CONTAINER] && creepsCount["miner"] ? 0 : 1],
            "priority" : 2,
            "wishEnergy" : 1350,
    },{
            "role" : "miner",
            "count" : _.min([scount[STRUCTURE_CONTAINER], scount["source"]]),
            "priority" : 2,
            "wishEnergy" : 650,
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
            "count" : (scount[STRUCTURE_LINK] >= 2 && scount[STRUCTURE_STORAGE] && creepsCount["longharvester"]) ? 1 : 0,
            "priority" : 5,
            "wishEnergy" : 300,
    });

    for (let limit of limits) {
        limit["roomName"] = room.name;
        limit["originalEnergyCapacity"] = room.energyCapacityAvailable;
        limit["range"] = 2;
        if (!"minEnergy" in limit)
            limit["minEnergy"] = 0;
    }

    console.log(room.name + ": CPU=" + _.floor(Game.cpu.getUsed() - lastCPU, 2) + "; limits=" + JSON.stringify(limits));

    return limits;
}

function getSpawnForCreate (need, skipSpawnNames) {
    let spawnsInRange = _.filter(Game.spawns, s => Game.map.getRoomLinearDistance(s.room.name, need.roomName) <= need.range && !s.spawning && !s.name in skipSpawnNames);
    
    if (!spawnsInRange.length)
        return [-2];
    
    //if (need.minEnergy && _.maxBy(spawnsInRange, function(s) {return s.room.energyCapacityAvailable} ).room.energyCapacityAvailable < need.minEnergy)
    //    return [-3];

    let waitSpawnName = null;
    for (let spawn of spawnsInRange.sort( function(a,b) { 
        return (Game.map.getRoomLinearDistance(a.room.name, need.roomName) - Game.map.getRoomLinearDistance(b.room.name, need.roomName)) || (b.room.energyAvailable - a.room.energyAvailable); 
    } )) {
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