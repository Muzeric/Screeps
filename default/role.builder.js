var utils = require('utils');

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
            if (!target || target.hits && (target.hits == target.hitsMax || target.hits >= utils.repairLimit)) {
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
	        utils.findSourceAndGo(creep);
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
    let target = creep.pos.findClosestByPath(FIND_MY_CONSTRUCTION_SITES, { filter : s => !_.some(Game.creeps, c => c.memory.role == "longbuilder" && c.memory.targetID == s.id) });
    if (target)
        return target.id;
    let targets = creep.room.find(FIND_STRUCTURES, { filter: s => s.hits < s.hitsMax*0.9 && s.hits < utils.repairLimit && !_.some(Game.creeps, c => c.memory.targetID == s.id) } );
    if (targets.length) {
        let rand = Math.floor(Math.random() * 5) % targets.length;
        target = targets.sort(function (a,b) { 
            let suma = a.hits / 1000 + creep.pos.getRangeTo(a);
            let sumb = b.hits / 1000 + creep.pos.getRangeTo(b);
            return suma - sumb; 
        })[0];
        return target.id;
    }
    
    return null;
}

module.exports = role;