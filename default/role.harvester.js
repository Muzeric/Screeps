var utils = require('utils');

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep, spawn, creepsInRoom) {
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.transfering) {
            if(!creep.memory.energyID) {
	            creep.memory.energyID = utils.findSource(creep, spawn, creepsInRoom);
	        }
            utils.gotoSource(creep);
        } else {
            var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        //return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_SPAWN) &&
                        return (structure.structureType == STRUCTURE_EXTENSION || structure.structureType == STRUCTURE_TOWER) &&
                            structure.energy < structure.energyCapacity;
                    }
            });
            if(target) {
                if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    var res = creep.moveTo(target);
                    //console.log(creep.name + " go to "+ target.pos.x + "," + target.pos.y +" res=" + res);
                    if(res == ERR_NO_PATH) {
                        creep.memory.errors++;
                    } else if (res == OK) {
                        creep.memory.errors = 0;
                    }
                }
            } else {
                if(creep.transfer(Game.spawns['Spawn1'], RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                    let res = creep.moveTo(Game.spawns['Spawn1']);
                    if(res == ERR_NO_PATH) {
                        creep.memory.errors++;
                    } else if (res == OK) {
                        creep.memory.errors = 0;
                    }
                } else if (creep.ticksToLive < 1000 || Game.spawns["Spawn1"].energy == Game.spawns["Spawn1"].energyCapacity) {
                    var res = Game.spawns["Spawn1"].renewCreep(creep);
                    console.log(creep.name + " renewed: " + res)
                }
            }
        }
	},
	
	create: function(spawn) {
	    var newName = spawn.createCreep([WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], "Harvester" + "." + Math.random().toFixed(2), {role: 'harvester'});
        console.log('Born: ' + newName);
	}
};

module.exports = roleHarvester;