var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
		if (Game.roomsHelper.getHostilesCount(creep.room.name) > 0) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

		if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) > 0) {
			creep.say("AAA");
			if (creep.pos.isBorder())
				creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

		if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
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
			creep.memory.targetID = getLongBuilderTargets(creep);
	 
		if(!creep.memory.targetID) {
			for (let s of creep.pos.lookFor(LOOK_STRUCTURES)) {
				if ([STRUCTURE_CONTAINER, STRUCTURE_ROAD, STRUCTURE_RAMPART].indexOf(s.structureType) != -1) {
					creep.move(Math.floor(Math.random() * 8) + 1);
					break;
				}
			}
            return;
        }

	    if(creep.memory.building) {
            if(!creep.memory.targetID)
                creep.memory.targetID = getLongBuilderTargets(creep);
                
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
	        creep.findSourceAndGo();
	    }
	},
	
	create: function(energy) {
	    let body = [];
	    while (energy >= 50  && body.length < 50) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
	            energy -= 100;
	        }
	        if(energy >= 50 && body.length < 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 50 && body.length < 50) {
	            body.push(CARRY);
	            energy -= 50;
	        }
	    }
	    return [body, energy];
	},
};

function getLongBuilderTargets(creep) {
	for (let room of _.sortBy(
		_.filter(Game.rooms, r => r.name in global.cache.creepsByRoomName && _.filter(global.cache.creepsByRoomName[r.name], c => c.memory.role == "longharvester").length), 
		r => creep.room == r ? 0 : creep.room.getPathToRoom(r.name) || 1000)
	) {
		let targets = room.getConstructions().concat(room.getRepairs());
		if (!targets.length)
			continue;
		let minCost;
		let targetID;
		for (let target of targets) {
			let pos = new RoomPosition(target.pos.x, target.pos.y, target.pos.roomName);
			let cost = (target.hits || 0) / 1000 + (creep.pos.getRangeTo(pos) || 0) + 50 * (global.cache.targets[target.id] || 0);
			if (minCost === undefined || cost < minCost) {
				targetID = target.id;
				minCost = cost;
			}
		}
		if (targetID) {
			global.cache.targets[targetID] = (global.cache.targets[targetID] || 0) + 1;
			return targetID;
		}
	}
	
	return null;
}

module.exports = role;
profiler.registerObject(role, 'roleLongbuilder');