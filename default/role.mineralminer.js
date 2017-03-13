var utils = require('utils');
var queue = require('queue.transport');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if(!creep.memory.exctractorID || !creep.memory.cID || !creep.memory.mineralID) {
            let extractor = creep.room.getPairedExtractor();

            if (!extractor) {
                console.log(creep.name + ": can't get extractor");
                return;
            }

            creep.memory.extractorID = extractor.id;
            creep.memory.cID = extractor.cID;
            creep.memory.mineralID = extractor.mineralID;
            creep.memory.betweenPos = extractor.betweenPos;
        }

        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);

        if (creep.pos.isEqualTo(betweenPos)) {
            let container = Game.getObjectById(creep.memory.cID);
            if(!container) {
                console.log(creep.name + " problem getting container by id=" + creep.memory.cID);
                creep.memory.cID = null;
                return;
            }

            let source = Game.getObjectById(creep.memory.extractorID);
            if(!source) {
                console.log(creep.name + " problem getting extractor by id=" + creep.memory.extractorID);
                creep.memory.extractorID = null;
                return;
            }

            let mineral = Game.getObjectById(creep.memory.mineralID);
            if (!mineral) {
                console.log(creep.name + " problem getting mineral by id=" + creep.memory.mineralID);
                creep.memory.mineralID = null;
                return;
            }

            if (!source.cooldown && (_.sum(container.store) < container.storeCapacity || _.sum(creep.carry) < creep.carryCapacity))
                creep.harvest(mineral);

            if (queue.getStoreWithReserved(container, mineral.mineralType) > TRANSPORTER_MIN_CONTAINER_AMOUNT)
                queue.addRequest(container, null, mineral.mineralType, TRANSPORTER_MIN_CONTAINER_AMOUNT);
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
profiler.registerObject(role, 'roleMineralMiner');