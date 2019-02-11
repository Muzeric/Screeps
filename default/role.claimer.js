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
                
                let flag = _.filter(Game.flags, f => f.pos.roomName == creep.memory.roomName && f.name.substring(0,f.name.indexOf('.')) == "Controller" )[0];
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
            creep.memory.signed = controller.signed;
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
            if (!creep.memory.signed && creep.room.controller.sign.username != LOGIN) {
                creep.signController(creep.room.controller, SIGN);
                creep.memory.signed = true;
            }
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