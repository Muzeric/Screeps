var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!creep.memory.targetID && !utils.checkInRoomAndGo(creep))
            return;

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.memory.targetID = null;
	    }
	    if(!creep.memory.building && creep.carry.energy == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.memory.energyID = null;
	    }

	    if(creep.memory.building) {
            if(!creep.memory.targetID)
                creep.memory.targetID = getBuilderTargets(creep);
            
            let target = Game.getObjectById(creep.memory.targetID);
            if (!target || "hits" in target && (target.hits == target.hitsMax || target.hits >= creep.room.getRapairLimit())) {
                creep.room.finishBuildRepair(creep.memory.targetID);
                creep.memory.targetID = null;
                return;
            }
            
            let res;
            if (target.hits === undefined) {
                res = creep.build(target);
                creep.say("bld " + target.pos.x + "," + target.pos.y);
            } else {
                res = creep.repair(target);
                creep.say("rpr " + target.pos.x + "," + target.pos.y);
            }
            
            if (res == ERR_NOT_IN_RANGE)
                creep.moveTo(target);
	    } else {
	        creep.findSourceAndGo();
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

function getBuilderTargets (creep) {
    let targets = creep.room.getConstructions() || creep.room.getRepairs();
    if (!target.length)
        return null;
    let minCost;
    let targetID;
    for (let target of targets) {
        let pos = new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName);
        let cost = ("hits" in target ? target.hits / 1000 : 0) + creep.pos.getRangeTo(pos);
        if (cost <= 1)
            return target.id;
        else if (minCost === undefined || cost < minCost)
            targetID = target.id;
    }

    return targetID;
}

module.exports = role;
profiler.registerObject(role, 'roleBuilder');