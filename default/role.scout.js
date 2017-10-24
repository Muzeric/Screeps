const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        return;
        let roomName = "E29S12";
        if (creep.room.name == roomName) {
            let target = creep.pos.findClosestByPath(FIND_CONSTRUCTION_SITES);
            if (target)
                creep.moveTo(target, {ignoreHostiled: 1});
        } else {
            creep.moveTo(new RoomPosition(30,30,roomName), {ignoreHostiled: 1});
        }
	},
	
    create: function(energy) {
        let body = [];
        if(energy >= 50) {
            body.push(MOVE);
	        energy -= 50;
	    }

	    return [body, energy];
	}
};

module.exports = role;
profiler.registerObject(role, 'roleScout');