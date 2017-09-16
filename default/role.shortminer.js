var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if (creep.memory.cID === undefined) {
            if (!creep.room.storage) {
                console.log(creep.name + ": no storage in " + creep.room.name);
                return;
            }
            creep.memory.cID = creep.room.storage.id;
        }
        
        if (creep.memory.energyID === undefined) {
            let ret = {};
            let link = creep.room.getStoragedLink(ret);
            if (!link || !("object" in ret)) {
                console.log(creep.name + ": can't getStoragedLink in " + creep.room.name);
                return;
            }
            creep.memory.energyID = link.id;
            creep.memory.betweenPos = ret.object.betweenPos;
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);
        if (creep.pos.isEqualTo(betweenPos)) {
            if(creep.carry.energy == 0 && creep.memory.transfering)
                creep.memory.transfering = false;
            else if ((_.sum(creep.carry) == creep.carryCapacity || creep.carry.energy && !source.energy) && !creep.memory.transfering)
                creep.memory.transfering = true;
            
            if(creep.memory.transfering) {
                if (creep.carry.energy)
                    creep.transfer(creep.room.storage, RESOURCE_ENERGY);
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