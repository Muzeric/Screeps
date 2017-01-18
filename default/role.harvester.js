var utils = require('utils');

var roleHarvester = {

    /** @param {Creep} creep **/
    run: function(creep) {
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.transfering) {
            if(!creep.memory.energyID) {
	            creep.memory.energyID = utils.findSource(creep);
	        }
            utils.gotoSource(creep);
        } else {
            var target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (structure) => {
                        return (
                        ((
                            (structure.structureType == STRUCTURE_EXTENSION || 
                            (structure.structureType == STRUCTURE_TOWER && structure.energy < structure.energyCapacity*0.9) || 
                            structure.structureType == STRUCTURE_SPAWN) &&
                            structure.energy < structure.energyCapacity
                        ) && creep.ticksToLive > 500
                        )
                        || (creep.ticksToLive < 800 && structure.structureType == STRUCTURE_SPAWN)    
                        );
                    }
            });
            if(!target) {
                //console.log(creep.name + " has no target");
                return;
            }
            if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(target);
                //console.log(creep.name + " go to "+ target.pos.x + "," + target.pos.y +" res=" + res);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            } else if (
                target.structureType == STRUCTURE_SPAWN &&
                (creep.ticksToLive < 1200 || target.energy == target.energyCapacity) &&
                !target.spawning
                ) {
                    var res = target.renewCreep(creep);
                    //console.log(creep.name + " renewed (" + creep.ticksToLive + "): " + res)
            }
        }
	},
	
	create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        let energyDiff = 0;
        if (total_energy > 1300) {
            energyDiff = total_energy - 1300;
            total_energy = 1300;
        }
        total_energy -= 100;
        let body = [WORK];
        let fat = 1;
	    while (total_energy >= 50) {
	        if(fat >= 0 && total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	            fat -= 2;
	        }
	        if(total_energy >= 50) {
	            body.push(CARRY);
	            total_energy -= 50;
	            fat++;
	        }
	    }
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        total_energy += energyDiff;
	    return [newName, body, total_energy];
	}
};

module.exports = roleHarvester;