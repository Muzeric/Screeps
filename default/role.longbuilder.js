var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
		if (Memory.warning[creep.room.name] > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

		if (Memory.warning[creep.memory.roomName] > 1) {
			creep.say("AAA");
			if (creep.pos.x == 49 || creep.pos.y == 49 || creep.pos.x == 0 || creep.pos.y == 0)
				creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

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
			let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10);
			if (hostiles.length) {
				let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(creep, hostiles[0].pos, 6));
				creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
				return;
			}

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
	let builds = _.filter(Game.flags, f => f.name.substring(0, 5) == 'Build' && Game.rooms[f.pos.roomName]);
	
	for(let buildf of builds.sort(function(a,b){ return 
		a.pos.roomName == creep.room.name ? -1 :
		(Game.map.getRoomLinearDistance(a.pos.roomName, creep.room.name) - Game.map.getRoomLinearDistance(b.pos.roomName, creep.room.name))
	;})) {
		let object = buildf;
		if (creep.room.name == buildf.room.name)
			object = creep;
			
		let target = object.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, { filter : s => s.structureType != STRUCTURE_ROAD && !_.some(Game.creeps, c => c.memory.role == "longbuilder" && c.memory.targetID == s.id) });
		if(target)
			return target.id;
	}

	let targets = Array();
	for(let buildf of builds) {  
		if(_.some(buildf.room.find(FIND_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER})))
			continue;
		targets = targets.concat( buildf.room.find(FIND_STRUCTURES, { filter: (structure) => 
			structure.structureType != STRUCTURE_ROAD &&
			structure.hits < structure.hitsMax*0.9 &&
			structure.hits < REPAIR_LIMIT &&
			!_.some(Game.creeps, c => c.memory.role == "longbuilder" && c.memory.targetID == structure.id) 
		} ) );
	}
	
	if(targets.length) {
			var rt = targets.sort(function (a,b) { 
				let suma = (a.hits*100/a.hitsMax < 25 ? -1000 : a.hits*100/a.hitsMax) + Game.map.getRoomLinearDistance(a.pos.roomName, creep.room.name) + (creep.pos.getRangeTo(a) || 0);
				let sumb = (b.hits*100/b.hitsMax < 25 ? -1000 : b.hits*100/b.hitsMax) + Game.map.getRoomLinearDistance(b.pos.roomName, creep.room.name) + (creep.pos.getRangeTo(b) || 0);
				return (suma - sumb) || (a.hits - b.hits); 
			})[0];
			return rt.id;
	}
	
	return null;
}

module.exports = role;
profiler.registerObject(role, 'roleLongbuilder');