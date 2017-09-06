var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if (creep.memory.cID === undefined) {
            creep.memory.cID = creep.room.storage.id;
        }
        let container = Game.getObjectById(creep.memory.cID);
        if(!container) {
            console.log(creep.name + " has problem with getting container " + creep.memory.cID);
            delete creep.memory.cID;
            return;
        }

        if (creep.memory.energyID === undefined) {
            let sources = container.pos.findInRange(FIND_STRUCTURES, 2, {filter: s => s.structureType == STRUCTURE_LINK});
            if(!sources.length) {
                console.log("Problem getting source for " + creep.name);
                return;
            }
            creep.memory.energyID = sources[0].id;
        }
        let source = Game.getObjectById(creep.memory.energyID);
        if (!source) {
            console.log(creep.name + " has problem with getting source " + creep.memory.energyID);
            delete creep.memory.energyID;
            return;
        }
        
        if(creep.carry.energy == 0 && creep.memory.transfering) {
            creep.memory.transfering = false;
        } else if ((_.sum(creep.carry) == creep.carryCapacity || creep.carry.energy && !source.energy) && !creep.memory.transfering) {
            creep.memory.transfering = true;
        }
        
        if(!creep.memory.transfering) {   
            if(creep.withdraw(source, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                creep.moveTo(source)
        } else {
            if(creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                creep.moveTo(container);
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