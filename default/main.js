var roleHarvester = require('role.harvester');
var roleUpgrader = require('role.upgrader');
var roleBuilder = require('role.builder');
var roleMiner = require('role.miner');
var utils = require('utils');

module.exports.loop = function () {
    let spawn = Game.spawns["Spawn1"];
    let creepsInRoom = spawn.room.find(FIND_MY_CREEPS);
    
    var error_count = 0;
    for(var name in Memory.creeps) {
        if(!Game.creeps[name]) {
            delete Memory.creeps[name];
            console.log('Died:', name);
        } else if (Game.creeps[name].memory.errors > 0) {
            console.log(name + " has "+ Game.creeps[name].memory.errors + " errors");
            error_count += Game.creeps[name].memory.errors;
        }
    }

    var count = 0;
    var crs = {
        "harvester" : 0,
        "builder" : 0,
        "upgrader" : 0,
        "miner" : 0,
    };
    var sources = spawn.room.find(FIND_SOURCES);
    
    for(var creep of creepsInRoom) {
        crs[creep.memory.role] = (crs[creep.memory.role]||0) + 1;
        
        if(error_count) {
            if(creep.moveTo(creep.room.controller) == OK) {
                creep.memory.errors = 0;
            }
            continue;
        }

        var sID = creep.name.slice(-1) % sources.length;
        if(creep.memory.sID != null) {
            sID = creep.memory.sID;
        }
        
        if (creep.memory.role == 'harvester') {
            roleHarvester.run(creep, spawn, creepsInRoom);
        } else if (creep.memory.role == 'upgrader') {
            roleUpgrader.run(creep, spawn, creepsInRoom);
        } else if (creep.memory.role == 'builder') {
            roleBuilder.run(creep, spawn, creepsInRoom);
        } else if (creep.memory.role == 'miner') {
            roleMiner.run(creep, spawn, creepsInRoom);
        }
        count++;
    }
    
    for (let name in crs) {
        //console.log(name + ": " + crs[name]);
    }

    if(spawn.room.energyAvailable < 800) {
        //console.log("Spawn1 has not enough energy");
    } else if (crs["harvester"] < 3) {
        roleHarvester.create(spawn);
    } else if (crs["miner"] < 4) {
        roleMiner.create(spawn);
    } else if (crs["upgrader"] < 5) {
        roleUpgrader.create(spawn);
    } else if (crs["builder"] < 4) {
        roleBuilder.create(spawn);
    }
    
    var tower = Game.getObjectById('587056fcda857f0660495603');
    if(tower) {
        /*
        var closestDamagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (structure) => structure.hits < structure.hitsMax
        });
        if(closestDamagedStructure) {
            tower.repair(closestDamagedStructure);
        }
        */

        var closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if(closestHostile) {
            tower.attack(closestHostile);
            console.log("Attack!!!");
        }
    }
    
    /*
    let containers = spawn.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
    for(let cont of containers) {
        if(_.sum(creepsInRoom, (c) => c.memory.role == "miner" && c.memory.cID == cont.id) < 2) {
            //console.log("Need miner for cont " + cont.id);
        }
    }
    
    for(let source of sources) {
        //console.log("source " + source.id + " has " + _.sum(creepsInRoom, (c) => c.memory.energyID == source.id) + " links");
    }
    
    let source = sources.sort(function(a,b) { 
        let suma = _.sum(creepsInRoom, (c) => c.memory.energyID == a.id);
        let sumb = _.sum(creepsInRoom, (c) => c.memory.energyID == b.id);
        //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
        return suma - sumb;
    })[0];
    console.log("Min source = " + source.id);
    */
}