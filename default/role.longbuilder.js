var utils = require('utils');

var roleLongBuilder = {
    run: function(creep) {
	    if(creep.memory.building && creep.carry.energy == 0) {
        	creep.memory.building = false;
            creep.memory.targetID = null;
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }

	    if(creep.memory.building) {
            if(!creep.memory.targetID)
                creep.memory.targetID = utils.getLongBuilderTargets(creep);
                
            let target = Game.getObjectById(creep.memory.targetID);
            if (!target || target.hits && target.hits == target.hitsMax) {
                    creep.memory.targetID = null;
                    return;
            } else {
				creep.memory.roomName = target.pos.roomName;
			}
            let res;
            if (target.hits === undefined) {
                res = creep.build(target);
                creep.say((target.pos.roomName == creep.pos.roomName ? "" : "C") + "bld " + target.pos.x + "," + target.pos.y);
            } else {
                res = creep.repair(target);
                creep.say((target.pos.roomName == creep.pos.roomName ? "" : "C") + "rpr " + target.pos.x + "," + target.pos.y);
            }
            
            if (res == ERR_NOT_IN_RANGE)
                creep.moveTo(target, {ignoreRoads : true});
	    }
	    else {
	        if(!creep.memory.energyID)
	            creep.memory.energyID = utils.findSource(creep);
            utils.gotoSource(creep);
	    }
	},
	
	create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        let body = [];
	    while (total_energy >= 50) {
	        if(total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	        }
	        if(total_energy >= 100) {
	            body.push(WORK);
	            total_energy -= 100;
	        }
	        if(total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	        }
	        if(total_energy >= 50) {
	            body.push(CARRY);
	            total_energy -= 50;
	        }
	    }
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        return [newName, body, total_energy];
	},
	
	create2: function(energy) {
	    let body = [];
	    while (energy >= 50) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100) {
	            body.push(WORK);
	            energy -= 100;
	        }
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 50) {
	            body.push(CARRY);
	            energy -= 50;
	        }
	    }
	    return [body, energy];
	},
};

module.exports = roleLongBuilder;