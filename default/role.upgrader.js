var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
		let room = Game.rooms[creep.memory.roomName];
		if (!room) {
			console.log(creep.name + ": no Game.rooms[" + creep.memory.roomName + "]");
			return;
		}

		let unboostedCount = creep.getUnboostedBodyparts(WORK);
		let bt = "GH2O";
		while (0 && unboostedCount && (room.storage && room.storage.store[bt] >= LAB_BOOST_MINERAL || creep.carry[bt] >= LAB_BOOST_MINERAL)) {
			let lab = room.getFreeLab(unboostedCount * LAB_BOOST_ENERGY);
			if (!lab)
				break;
			let need = LAB_BOOST_ENERGY * unboostedCount;
			let got = creep.carry[bt];
			let free = creep.carryCapacity - _.sum(creep.carry);
			let able = rooms.storage.store[bt];
			if (got >= LAB_BOOST_MINERAL && (got >= need || free < LAB_BOOST_MINERAL)) {
				// boosting stage
				if (creep.isNearTo(lab)) {
					creep.transfer(lab, bt);
					let res = lab.boostCreep(creep);
					console.log(creep.name + ": BOOSTED (res)");
				} else {
					creep.moveTo(lab);
				}
			} else {
				// getting stage
				if (creep.withdraw(room.storage, bt, _.floor( _.min([need - got, free, able]) / LAB_BOOST_MINERAL) * LAB_BOOST_MINERAL ) == ERR_NOT_IN_RANGE) {
					creep.moveTo(room.storage);
				}
			}
			return;
		}

	    if(creep.carry.energy == 0 && creep.memory.upgrading) {
			creep.memory.upgrading = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.upgrading) {
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
	
	create: function(energy) {
	    let body = [];
	    while (energy >= 50 && body.length < 50) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
	            energy -= 100;
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