//test
//test 2

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
};
for (let role in roles) {
    roles[role]["obj"] = require('role.' + role);
}
var utils = require('utils');

var spawn_config = {
    "Spawn1" : [
        ["harvester", 1],
        ["miner", 1],
        ["ENERGY", 1500],
        ["attacker", 0],
        ["harvester", 3],
        ["miner", 2],
        ["upgrader", 1],
        ["longminer", 3],
        ["claimer", 2],
        ["shortminer", 1],
        ["longminer", 6],
        ["builder", 1],
        ["longbuilder", 1],
        ["upgrader", 4]
    ],
    "Spawn2" : [
        ["harvester", 1],
        ["miner", 1],
        ["ENERGY", 1500],
        ["harvester", 1],
        ["miner", 2],
        ["upgrader", 4],
        ["builder", 1],
    ]
};

module.exports.loop = function () {
    var error_count = {};
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            console.log("Died: " + Memory.creeps[name].spawnName + "." + name);
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
        
        if(roles[creep.memory.role])
            roles[creep.memory.role].obj.run(creep);
        else
            console.log("Uknown role=" + creep.memory.role);
    }
    
    for (let spawnName in spawn_config) {
        //console.log("Start operations for: " + spawnName);
        var spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn: " + spawnName);
            continue;
        }
        
        if (!spawn.spawning) {
            let cs = spawn.room.find(FIND_CONSTRUCTION_SITES);
            let rs;
            if (!_.some(spawn.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}))) {
                rs = spawn.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 } );
            }
            let info = {
                longbuilder : utils.getLongBuilderTargets() ? 1 : 0,
                builder : (roles["builder"].count[spawnName] < cs.length + (rs ? rs.length : 0))
            };
        
            let min_energy = 300;
            for (let arr of spawn_config[spawnName]) {
                let role = arr[0];
                let climit = arr[1];
                if (climit <= 0)
                    continue;
                if (role == "ENERGY") {
                    min_energy = climit;
                    continue;
                }
                if (spawn.room.energyAvailable < spawn.room.energyCapacityAvailable && spawn.room.energyAvailable < min_energy)
                    continue;
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
                    roles[role].obj.create(spawnName, role, spawn.room.energyAvailable);
                    //console.log(spawnName + " wants to burn " + role);
                    break;
                }
            }
            //console.log("Enough creeps by " + spawnName);
        }

        let towers = spawn.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_TOWER });
        for(let tower of towers) {
            let hostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if(hostile) {
                tower.attack(hostile);
                console.log("Tower " + tower.id + " attacked hostile: owner=" + hostile.owner.username + "; hits=" + hostile.hits);
            } else {
                let dstructs = tower.room.find(FIND_STRUCTURES, {
                    filter: (structure) => structure.hits < 0.9*structure.hitsMax && structure.hits < 964000
                });
                if(dstructs.length && tower.energy > 500) {
                    let dstruct = dstructs.sort(function (a,b) {
                        return a.hits - b.hits;
                    })[0];
                    tower.repair(dstruct);
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