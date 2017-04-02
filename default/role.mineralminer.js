var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.room.name) > 0) {
			creep.say("AAA");
			creep.moveTo(Game.rooms[creep.memory.roomName].controller);
			return;
		}

        if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) > 0) {
            creep.say("AAA");
            if (creep.pos.isBorder())
                creep.moveTo(Game.rooms[creep.memory.roomName].controller);
            return;
        }

        if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
            return;

        let room = Game.rooms[creep.memory.roomName];
        if (!room) {
            console.log(creep.name + ": no Game.rooms[" + creep.memory.roomName + "]");
            return;
        }

        if (room.memory.type != 'my') {
            if (!creep.memory.filled && creep.carry.energy > 0 && _.sum(creep.carry) == creep.carryCapacity) {
                creep.memory.filled = 1;
            } else if (!creep.memory.filled && _.sum(creep.carry) < creep.carryCapacity) {
                creep.findSourceAndGo();
                return;
            }
        }

        if(!creep.memory.exctractorID || !creep.memory.cID || !creep.memory.mineralID) {
            let extractor = room.getPairedExtractor();

            if (!extractor) {
                console.log(creep.name + ": can't get extractor");
                return;
            }

            if (!extractor.cID && extractor.buildContainerID) {
                buildContainer(creep, extractor.buildContainerID);
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

            if (room.memory.type != 'my') {
                if (container.hits < container.hitsMax && creep.carry.energy > 0) {
                    creep.repair(container);
                    return;
                } else if (container.hits < container.hitsMax * 0.6 && creep.carry.energy == 0) {
                    for (let rt in creep.carry)
                        creep.transfer(container, rt);
                    creep.memory.filled = 0;
                    return;
                }
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

            if (creep.carry[mineral.mineralType] > MINERALMINER_CARRY_LIMIT || creep.carry[mineral.mineralType] > 0 && creep.ticksToLive < KEEPLAIR_LEAVE_TIME * 2)
                creep.transfer(container, mineral.mineralType);
            else if (!source.cooldown && (_.sum(container.store) < container.storeCapacity || _.sum(creep.carry) < creep.carryCapacity))
                creep.harvest(mineral);

            if (global.cache.queueTransport.getStoreWithReserved(container, mineral.mineralType) > TRANSPORTER_MIN_CONTAINER_AMOUNT)
                global.cache.queueTransport.addRequest(container, null, mineral.mineralType, TRANSPORTER_MIN_CONTAINER_AMOUNT);
        } else {
            let res = creep.moveTo(betweenPos);
            if(res == ERR_NO_PATH) {
                creep.memory.errors++;
            } else if (res == OK) {
                creep.memory.errors = 0;
            }
        }
	},
	
    create: function(energy, build) {
        let body = [];
        let clim = build ? 17 : 1;
        let wlim = build ? 15 : 31;
        let fat = 0;
        while (energy >= 100 && (wlim || clim)) {
            if (energy >= 100 && wlim) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            energy -= 100;
	        }

            if (energy >= 50 && clim) {
                body.push(CARRY);
                clim--;
                fat++;
                energy -= 50;
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

function buildContainer (creep, buildContainerID) {
    let target = Game.getObjectById(buildContainerID);
    if (!target || !("progress" in target))
        return ERR_INVALID_TARGET;
    
    if (creep.memory.building && creep.carry.energy == 0) {
        creep.memory.building = false;
    } else if (!creep.memory.building && creep.carry.energy > 0 && _.sum(creep.carry) == creep.carryCapacity) {
        creep.memory.building = true;
        creep.memory.energyID = null;
    }

    if (creep.memory.building) {
        if (creep.build(target) == ERR_NOT_IN_RANGE)
            creep.moveTo(target);
    } else {
        creep.findSourceAndGo();
    }

    return OK;
}

module.exports = role;
profiler.registerObject(role, 'roleMineralMiner');