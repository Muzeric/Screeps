var roles = {
    "harvester" : {},
    "builder" : {},
    "upgrader" : {},
    "miner" : {},
    "longminer" : {},
    "claimer" : {},
    "attacker" : {},
    "shortminer" : {},
    "longbuilder" : {},
    "longharvester" : {},
};
for (let role in roles) {
    roles[role]["obj"] = require('role.' + role);
}
var utils = require('utils');

var spawn_config = {
    "Spawn1" : {
        "creeps" : [
            ["harvester", 1],
            ["miner", 1],
            ["ENERGY", 1500],
            ["attacker", 0, 1800],
            ["harvester", 4],
            ["miner", 2],
            ["upgrader", 1],
            ["longharvester", 3],
            ["REPAIR", 1],
            ["claimer", 3],
            ["longminer", 2],
            ["shortminer", 1],
            ["longbuilder", 1],
            ["longharvester", 7],
            ["builder", 1],
            ["upgrader", 2],
            ["longharvester", 12],
            ["upgrader", 4],
        ],
    },
    "Spawn2" : {
        "creeps" : [
            ["harvester", 1],
            ["miner", 1],
            ["ENERGY", 1500],
            ["harvester", 1],
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
    var error_count = {};
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log(name + " DEAD (" + Memory.creeps[name].spawnName + ")");
            delete Memory.creeps[name];
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            error_count[Game.creeps[name].memory.spawnName] = error_count[Game.creeps[name].memory.spawnName] + 1 || 1;
        }
    }
    
    for (let role in roles) {
        roles[role]["count"] = {};
        for (let spawnName in spawn_config)
            roles[role]["count"][spawnName] = 0;
    }
    
    for(let creep_name in Game.creeps) {
        let creep = Game.creeps[creep_name];
        if(creep.spawning) {
            continue;
        }
        roles[creep.memory.role]["count"][creep.memory.spawnName]++;
        
        if(error_count[creep.memory.spawnName]) {
            if(creep.moveTo(creep.room.controller) == OK) {
                creep.memory.errors = 0;
            }
            continue;
        }
        
        let lastCPU = Game.cpu.getUsed();
        
        if(roles[creep.memory.role])
            roles[creep.memory.role].obj.run(creep);
        else
            console.log("Uknown role=" + creep.memory.role);
            
        let diffCPU = (Game.cpu.getUsed() - lastCPU)
            
        if(!stat["cpu"]["run"][creep.memory.role]) {
            stat["cpu"]["run"][creep.memory.role] = {
                last: diffCPU,
                log: diffCPU,
                max: diffCPU,
            };
        } else {
            stat["cpu"]["run"][creep.memory.role].log = stat["cpu"]["run"][creep.memory.role].log*0.9 + diffCPU*0.1;
            stat["cpu"]["run"][creep.memory.role].last = diffCPU;
            if (diffCPU > stat["cpu"]["run"][creep.memory.role].max)
                stat["cpu"]["run"][creep.memory.role].max = diffCPU;
        }
    }
    
    stat.roles = JSON.parse(JSON.stringify(roles));
    
    
    for (let spawnName in spawn_config) {
        //console.log("Start operations for: " + spawnName);
        var spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn: " + spawnName);
            continue;
        }
        
                
        let canRepair = 0;
        if (!spawn.spawning && !_.some(Game.creeps, c => c.pos.isNearTo(spawn) && c.ticksToLive < 800) ) {
            let cs = spawn.room.find(FIND_CONSTRUCTION_SITES);
            let rs;
            if (!_.some(spawn.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}))) {
                rs = spawn.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 } );
            }
            let info = {
                longbuilder : utils.getLongBuilderTargets() ? 1 : 0,
                builder : (roles["builder"].count[spawnName] < cs.length + (rs ? rs.length : 0))
            };

            let minEnergy = 300;
            for (let arr of spawn_config[spawnName]["creeps"]) {
                let role = arr[0];
                let climit = arr[1];
                let emin = arr[2];
                
                if (climit <= 0)
                    continue;
                if (role == "ENERGY") {
                    minEnergy = climit;
                    continue;
                } else if (role == "REPAIR") {
                    canRepair = 1;
                    continue;
                }
                if (role in info && !info[role])
                    continue;
                if (
                    roles[role].count[spawnName] < climit || 
                    (roles[role].count[spawnName] == climit && _.some(Game.creeps, c => 
                        c.ticksToLive < 200 &&
                        c.memory.role == role &&
                        c.memory.spawnName == spawnName
                    ))
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
                        let res = roles[role].obj.create(spawnName, role, energy);

                        console.log(res[0] + " BORN by " + spawnName + ", energy (" + energy + "->" + res[2] + ") [" + res[1] + "]");
                    }
                    //console.log(spawnName + " wants to burn " + role);
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
            let hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(hostile) {
                tower.attack(hostile);
                console.log("Tower " + tower.id + " attacked hostile: owner=" + hostile.owner.username + "; hits=" + hostile.hits);
            } else {
                if (canRepair) {
                    let repairLimit = utils.roomConfig[tower.room.name].repairLimit || 100000;
                    let dstructs = tower.room.find(FIND_STRUCTURES, {
                        filter: (structure) => structure.hits < 0.9*structure.hitsMax && structure.hits < repairLimit
                    });
                    if(dstructs.length && tower.energy > 500) {
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
    
    let link_from = Game.getObjectById('587869503d6c02904166296f');
    let link_to = Game.getObjectById('58771a999d331a0f7f5ae31a');
    if(link_from && link_to && !link_from.cooldown && link_from.energy && link_to.energy < link_to.energyCapacity*0.7) {
        let res = link_from.transferEnergy(link_to);
        if(res < 0) 
            console.log("Link transfer energy with res=" + res);
    }
}