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
            creep.memory.contlinkID = room.getControlleredLink(1);
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);
        if (creep.pos.isEqualTo(betweenPos)) {
            let link = Game.getObjectById(creep.memory.energyID);
            if (!link) {
                console.log(creep.name + ": can't load link " + creep.memory.energyID);
                return;
            }
            let contlinkNeed = 0;
            if (creep.memory.contlinkID) {
                let contlink = Game.getObjectById(creep.memory.contlinkID);
                if (contlink && contlink.energy < contlink.energyCapacity / 3) {
                    contlinkNeed = contlink.energyCapacity - contlink.energy - link.energy;
                }
            }
            if (contlinkNeed > 0) {
                if (creep.carry.energy >= contlinkNeed || _.sum(creep.carry) == creep.carryCapacity) {
                    creep.transfer(link, RESOURCE_ENERGY, _.min([creep.carry.energy, contlinkNeed]));
                } else {
                    creep.withdraw(room.storage, RESOURCE_ENERGY);
                }
            } else {
                if (creep.carry.energy) {
                    creep.transfer(room.storage, RESOURCE_ENERGY);
                } else if (link.energy) {
                    creep.withdraw(link, RESOURCE_ENERGY);
                }
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