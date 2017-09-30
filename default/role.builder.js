const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let room = Game.rooms[creep.memory.roomName];
        if (!room)
            return null;

        if (room.getBuilderTicks() > BOOST_BUILDER_MIN_BTICKS && creep.boost(WORK, "build") == OK)
            return;

	    if(creep.memory.building && creep.carry.energy == 0) {
            creep.memory.building = false;
            creep.memory.targetID = null;
	    }
	    if(!creep.memory.building && _.sum(creep.carry) == creep.carryCapacity) {
	        creep.memory.building = true;
	        creep.memory.energyID = null;
        }
        
        if(!creep.memory.targetID)
            creep.memory.targetID = getBuilderTargets(creep, room);

        if(!creep.memory.targetID) {
            if (creep.carry.energy) {
                if(creep.upgradeController(room.controller) == ERR_NOT_IN_RANGE)
                    creep.moveTo(room.controller, {range: 2});
            } else {
                for (let s of creep.pos.lookFor(LOOK_STRUCTURES)) {
                    if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) != -1) {
                        creep.move(Math.floor(Math.random() * 8) + 1);
                        break;
                    }
                }
            }
            return;
        }

	    if(creep.memory.building) {
            let target = Game.getObjectById(creep.memory.targetID);
            if (!target || "hits" in target && (target.hits == target.hitsMax || target.hits >= room.getRepairLimit())) {
                room.finishBuildRepair(creep.memory.targetID);
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

function getBuilderTargets (creep, room) {
    let targets = room.getConstructions().concat(room.getRepairs());
    if (!targets.length)
        return null;
    let minCost;
    let targetID;
    for (let target of targets) {
        let pos = new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName);
        let creeps = global.cache.targets[target.id] || 0;
        let cost = ("hits" in target ? target.hits / 1000 : 0) + (creep.pos.getRangeTo(pos) || 0) + (target.constructionStructureType == STRUCTURE_SPAWN ? -100 : (target.constructionStructureType == STRUCTURE_EXTENSION ? -10 : 0));
        if (target.structureType == STRUCTURE_RAMPART && target.hits && target.hits < REPAIR_TOWER_LIMIT)
            cost -= 50;
        if (creeps > 1)
            cost += 50 * creeps;
        if (minCost === undefined || cost < minCost) {
            targetID = target.id;
            minCost = cost;
        }
    }
    if (targetID)
        global.cache.targets[targetID] = (global.cache.targets[targetID] || 0) + 1;

    return targetID;
}

module.exports = role;
profiler.registerObject(role, 'roleBuilder');