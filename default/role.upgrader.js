var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
		let room = Game.rooms[creep.memory.roomName];
		if (!room) {
			console.log(creep.name + ": no Game.rooms[" + creep.memory.roomName + "]");
			return;
		}

		if (creep.boost(WORK, "upgradeController") == OK)
			return;

	    if(creep.carry.energy == 0 && creep.memory.upgrading) {
			creep.memory.upgrading = false;
	    } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.upgrading) {
	        creep.memory.upgrading = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.upgrading) {
	        creep.findSourceAndGo();
        } else {
            if(creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(room.controller, {range: 2});
                //console.log(creep.name + " go res=" + res);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            }
        }
	},
	
	create: function(energy, opts = {}) {
		let body = [];
		let wlim = opts.top ? 15 : 100;
	    while (energy >= 50 && body.length < 50 && wlim) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
				energy -= 100;
				wlim--;
	        }
	        if(energy >= 50 && body.length < 50) {
	            body.push(CARRY);
	            energy -= 50;
	        }
	    }
	    return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleUpgrader');