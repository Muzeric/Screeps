var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if(!creep.memory.cID || !creep.memory.energyID || !creep.memory.betweenPos) {
            if (!Game.rooms[creep.memory.roomName]) {
                console.log(creep.name + ": no Game.rooms[" + creep.memory.roomName + "]");
                return;
            }
            let container = Game.rooms[creep.memory.roomName].getPairedContainer(creep.room.name == creep.memory.roomName ? creep.pos : null);

            if (!container) {
                console.log(creep.name + ": can't get container");
                return;
            }

            creep.memory.cID = container.id;
            creep.memory.energyID = container.source.id;
            creep.memory.betweenPos = container.betweenPos;
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);

        if (creep.pos.isEqualTo(betweenPos)) {
            let container = Game.getObjectById(creep.memory.cID);
            if(!container) {
                console.log(creep.name + " problem getting container by id=" + creep.memory.cID);
                creep.memory.cID = null;
                return;
            }

            let source = Game.getObjectById(creep.memory.energyID);
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
                if (creep.pos.isEqualTo(container.pos)) {
                    if (_.sum(creep.carry) < creep.carryCapacity || _.sum(container.store) < container.storeCapacity)
                        creep.harvest(source);
                } else {
                    if(creep.carry.energy < creep.carryCapacity)
                        creep.harvest(source);
                    creep.transfer(container, RESOURCE_ENERGY);
                }
            }
        } else {
            let res = creep.moveTo(betweenPos);
            if(res == ERR_NO_PATH) {
                creep.memory.errors++;
            } else if (res == OK) {
                creep.memory.errors = 0;
            }
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
profiler.registerObject(role, 'roleMiner');