var utils = require('utils');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {
	    if(creep.carry.energy == 0 && creep.memory.upgrading) {
			creep.memory.upgrading = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.upgrading) {
	        creep.memory.upgrading = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.upgrading) {
	        if(!creep.memory.energyID) {
	            creep.memory.energyID = utils.findSource(creep, 1);
	        }
            utils.gotoSource(creep);
        } else {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(creep.room.controller);
                //console.log(creep.name + " go res=" + res);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            }
        }
	},
	
	create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        console.log("total_energy:" + total_energy);
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
	            body.push(CARRY);
	            total_energy -= 50;
	        }
	    }
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        console.log("Born by " + spawnName + " creep " + newName + " (" + body + ")");
	}
};

module.exports = roleUpgrader;