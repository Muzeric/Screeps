const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let flags = _.filter(Game.flags, f => f.name.substring(0, 9) == 'Dismantle');
        if (!flags.length)
            return;
        let flag = flags.sort()[0];

        if (creep.boost(WORK, "dismantle") == OK)
            return;
        
        if (flag.pos.roomName != creep.room.name) {
            creep.moveTo(flag, {ignoreHostiled: 1});
        } else {
            let target = Game.getObjectById(creep.memory.dismTargetID);
            if (!target) {
                target = 
                //Game.getObjectById(Memory.targets[creep.room.name]) ||
                _.filter(flag.pos.lookFor(LOOK_STRUCTURES), s => s.structureType != "road")[0] ||
                creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType == STRUCTURE_TOWER}) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_SPAWNS) ||
                creep.pos.findClosestByPath(FIND_HOSTILE_STRUCTURES, {filter : s => s.structureType != STRUCTURE_CONTROLLER})
                ;
                if (!target) {
                    creep.moveTo(flag, {ignoreHostiled: 1});
                    creep.memory.dismTargetID = null;
                    return;
                }
                creep.memory.dismTargetID = target.id;
            }
            if (creep.dismantle(target) == ERR_NOT_IN_RANGE)
                creep.moveTo(target, {ignoreHostiled: 1});
        }
	},
	
	create: function(energy) {
        let body = [];
        let tnum = 5;
        let mnum = 5;
        while (energy >= 10 && tnum--) {
            body.push(TOUGH);
            energy -= 10;
        }
        while (energy >= 50 && mnum--) {
            body.push(MOVE);
            energy -= 50;
        }
	    while (energy >= 50 && body.length < 50) {
	        if(energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	        }
	        if(energy >= 100 && body.length < 50) {
	            body.push(WORK);
	            energy -= 100;
	        }
	    }
	    return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleDismantler');