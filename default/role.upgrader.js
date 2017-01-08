var utils = require('utils');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep, spawn, creepsInRoom) {
	    if(creep.carry.energy == 0 && creep.memory.upgrading) {
	        creep.memory.upgrading = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.upgrading) {
	        creep.memory.upgrading = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.upgrading) {
	        if(!creep.memory.energyID) {
	            creep.memory.energyID = utils.findSource(creep, spawn, creepsInRoom);
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
	
	create: function(spawn) {
	    var newName = spawn.createCreep([WORK,WORK,WORK,WORK,CARRY,CARRY,CARRY,CARRY,MOVE,MOVE,MOVE,MOVE], "Upgrader" + "." + Math.random().toFixed(2), {role: 'upgrader'});
        console.log('Born: ' + newName);
	}
};

module.exports = roleUpgrader;