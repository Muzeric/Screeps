var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!creep.memory.controllerPlace) {
            if (
                !(creep.memory.roomName in Memory.rooms) || 
                !("structures" in Memory.rooms[creep.memory.roomName]) ||
                !(STRUCTURE_CONTROLLER in Memory.rooms[creep.memory.roomName].structures) ||
                !Memory.rooms[creep.memory.roomName].structures[STRUCTURE_CONTROLLER].length
            ) {
                console.log(creep.name + ": no controller info for " + creep.memory.roomName);
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
            let res;
            if ("claimRoom" in Memory && Memory.claimRoom == creep.room.name)
                res = creep.claimController(creep.room.controller);
            else
                res = creep.reserveController(creep.room.controller);
            if (res < 0)
                console.log(creep.name + ": reserve[claim]Controller with res=" + res);
        } else {
            creep.moveTo(controllerPos);
        }
	},
	
    create: function(energy, lite) {
        let cnum = 2 - lite;
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
profiler.registerObject(role, 'roleClaimer');