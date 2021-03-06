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

		if (!creep.memory.startcheck) {
			creep.memory.contlinkID = room.getControlleredLink(1);
			creep.memory.contcontID = room.getControlleredContainer(1);
			creep.memory.startcheck = 1;
		}

		if ((creep.memory.contlinkID || creep.memory.contcontID) && creep.carry.energy < creep.getActiveBodyparts(WORK)) {
			let contlink = Game.getObjectById(creep.memory.contlinkID);
			if (contlink && contlink.energy > 0 && creep.pos.isNearTo(contlink)) {
				if (creep.withdraw(contlink, "energy") == OK) {
					if(creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE)
						creep.moveTo(room.controller, {range: 2});
					return;
				}
			}

			let container = Game.getObjectById(creep.memory.contcontID);
			if (container && container.store.energy >= 0 && creep.pos.isNearTo(container)) {
				if (creep.withdraw(container, "energy") == OK) {
					if(creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE)
						creep.moveTo(room.controller, {range: 2});
					return;
				}
			}
		}

	    if(creep.carry.energy == 0 && creep.memory.upgrading) {
			creep.memory.upgrading = false;
	    } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.upgrading) {
	        creep.memory.upgrading = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.upgrading) {
	        creep.findSourceAndGo({contlink: 1});
        } else {
            if(creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(room.controller, {range: 2});
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
		let fat = 0;
		let wcount = 0;
		let fatCoeff = opts.controllered ? 0.5 : 1;
	    while (energy >= 50 && body.length < 50 && wlim) {
			if(fat * fatCoeff >= 0 && energy >= 50 && body.length < 50) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
			}
	        if(energy >= 50 && body.length < 50 && (!opts.controllered || wcount % 15 == 0 || energy < 100)) {
	            body.push(CARRY);
				energy -= 50;
				fat++;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
				energy -= 100;
				wlim--;
				wcount++;
				fat++;
	        }
	    }
	    return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleUpgrader');