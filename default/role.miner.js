var utils = require('utils');

var role = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if(!creep.memory.cID || !creep.memory.energyID || !creep.memory.betweenPos) {
            let container = creep.room.getPairedContainer();

            if (!container) {
                console.log(creep.name + ": can't get container");
                return;
            }

            creep.memory.cID = container.id;
            creep.memory.energyID = container.source.id;
            creep.memory.betweenPos = container.source.betweenPos;
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);

        if (creep.pos.isEqualTo(betweenPos)) {
            container = Game.getObjectById(creep.memory.cID);
            if(!container) {
                console.log(creep.name + " problem getting container by id=" + creep.memory.cID);
                creep.memory.cID = null;
                return;
            }

            source = Game.getObjectById(creep.memory.energyID);
            if(!source) {
                console.log(creep.name + " problem getting source by id=" + creep.memory.energyID);
                creep.memory.energyID = null;
                return;
            }

            if (creep.carry.energy && 
                (
                    container.hits < container.hitsMax * 0.8 && Game.time - (creep.memory.lastRepair || 0) > 2 ||
                    container.hits < container.hitsMax * 0.95 && Game.time - (creep.memory.lastRepair || 0) > 10 ||
                    container.hits < container.hitsMax && container.store[RESOURCE_ENERGY] == container.storeCapacity
                )
            ) {
                creep.repair(container);
                creep.memory.lastRepair = Game.time;
            } else {
                if(creep.carry.energy < creep.carryCapacity)
                    creep.harvest(source);
                creep.transfer(container, RESOURCE_ENERGY);
            }
        } else {
            creep.moveTo(betweenPos);
        }
	},
	
    create: function(energy) {
        energy -= 50;
        let body = [CARRY];
        let wlim = 5;
        let fat = 1;
        while (energy >= 100 && wlim) {
            if (energy >= 100) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            energy -= 100;
	        }
            if (fat > 0 && energy >= 50) {
                body.push(MOVE);
	            energy -= 50;
                fat -= 2;
            }
        }

	    return [body, energy];
	},
};

module.exports = role;