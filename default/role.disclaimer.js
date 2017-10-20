const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (creep.memory.done) {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE)
                creep.moveTo(spawn, {ignoreHostiled: 1});
            return;
        }

        if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
            return;

        //if (creep.boost(MOVE, "fatigue", true) == OK)
        //    return;

        if (!creep.memory.controllerPlace) {
            if (
                !(creep.memory.roomName in Memory.rooms) || 
                !("structures" in Memory.rooms[creep.memory.roomName]) ||
                !(STRUCTURE_CONTROLLER in Memory.rooms[creep.memory.roomName].structures) ||
                !Memory.rooms[creep.memory.roomName].structures[STRUCTURE_CONTROLLER].length
            ) {
                let flag = _.filter(Game.flags, f => f.pos.roomName == creep.memory.roomName && f.name.substring(0,f.name.indexOf('.')) == "DisController" )[0];
                if (flag) {
                    creep.moveTo(flag, {ignoreHostiled: 1});
                    console.log(creep.name + ": goto flag");
                } else {
                    console.log(creep.name + ": no controller info for " + creep.memory.roomName);
                }
                return;
            }

            let controller = Memory.rooms[creep.memory.roomName].structures[STRUCTURE_CONTROLLER][0];
            if (!("rangedPlaces" in controller) || !controller.rangedPlaces.length) {
                console.log(creep.name + ": no rangedPlaces for controller");
                return;
            }

            creep.memory.controllerPlace = controller.rangedPlaces[0];
        }

        let controllerPos = new RoomPosition(creep.memory.controllerPlace.x, creep.memory.controllerPlace.y, creep.memory.controllerPlace.roomName);
        if (creep.pos.isEqualTo(controllerPos)) {
            let res = creep.attackController(creep.room.controller);
            console.log(creep.name + ": attackController with res=" + res);
            if (res == OK) {
                creep.memory.done = 1;
                creep.room.memory.lastAttackController = Game.time;
            }
        } else {
            creep.moveTo(controllerPos, {ignoreHostiled: 1});
        }
	},
	
    create: function(energy) {
        // return [[MOVE], 50];
        // 600 * 19 + 50 * 19 = 12350
        let cnum = DISCLAIMER_CLAIM_COUNT;
        let body = [];
        while(cnum-- && energy >= 650) {
            body.push(MOVE);
	        energy -= 50;
            body.push(CLAIM);
	        energy -= 600;
	    }

	    return [body, energy];
	}
};

module.exports = role;
profiler.registerObject(role, 'roleDisclaimer');