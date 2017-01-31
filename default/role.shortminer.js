var utils = require('utils');

var roleShortMiner = {
    /** @param {Creep} creep **/
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if(creep.memory.cID === undefined) {
            //console.log("Searching container for " + creep.name);
            creep.memory.cID = creep.room.storage.id;
            //console.log("Container for " + creep.name + " is " + creep.memory.cID);
        }
        
        let container = Game.getObjectById(creep.memory.cID);
        if(!container) {
            console.log("Problem getting container for " + creep.name);
            delete creep.memory.cID;
            return;
        }

        let sources = container.pos.findInRange(FIND_STRUCTURES, 2, {filter: s => s.structureType == STRUCTURE_LINK});
        if(!sources.length) {
            console.log("Problem getting source for " + creep.name);
            return;
        }
        let source = sources[0];
        
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
        } else if ((creep.carry.energy == creep.carryCapacity || creep.carry.energy && !source.energy) && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	    }
	    
	    if(!creep.memory.transfering) {   
            let res = creep.withdraw(source, RESOURCE_ENERGY);
            if(res == ERR_NOT_IN_RANGE) {
                let res = creep.moveTo(source);
                if(res < 0)
                    console.log(creep.name + " moved to energy with res=" + res);
            } else if (res < 0) {
                //console.log(creep.name + " got energy with res=" + res);
            }
        } else {
            if(creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                let res = creep.moveTo(container);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            }
        }
	},
	
    create: function(energy) {
	    energy -= 50*6;
        let body = [MOVE,MOVE,CARRY,CARRY,CARRY,CARRY];
        
	    return [body, energy];
	},
};

module.exports = roleShortMiner;