const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        let room = Game.rooms[creep.memory.roomName];
        if (!room) {
            console.log(creep.name + ": no room " + roomName);
            return;
        }

        if (creep.memory.cID === undefined) {
            if (!room.storage) {
                console.log(creep.name + ": no storage in " + room.name);
                return;
            }
            creep.memory.cID = room.storage.id;
        }
        
        if (creep.memory.energyID === undefined) {
            let ret = {};
            let link = room.getStoragedLink(ret);
            if (!link || !("object" in ret)) {
                console.log(creep.name + ": can't getStoragedLink in " + room.name);
                return;
            }
            creep.memory.energyID = link.id;
            creep.memory.betweenPos = ret.object.betweenPos;
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);
        if (creep.pos.isEqualTo(betweenPos)) {
            if (creep.carry.energy) {
                creep.transfer(room.storage, RESOURCE_ENERGY);
            } else {
                let link = Game.getObjectById(creep.memory.energyID);
                if (!link) {
                    console.log(creep.name + ": can't load link " + creep.memory.energyID);
                    return;
                }
                if (link.energy)
                    creep.withdraw(link, RESOURCE_ENERGY);
            }
        } else {
            creep.moveTo(betweenPos);
        }
	},
	
    create: function(energy) {
	    energy -= 50*6;
        let body = [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
        
	    return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleShortminer');