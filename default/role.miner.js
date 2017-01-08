var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep, spawn, creepsInRoom) {
        if(creep.memory.cID === undefined) {
            console.log("Searching container for " + creep.name);
            let containers = spawn.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
            if(!containers.length) {
                console.log("No containers in room, nothing to do for " + creep.name);
                return;
            }
            creep.memory.cID = containers.sort( function(a,b) { 
                let suma = _.sum(creepsInRoom, (c) => c.memory.role == "miner" && c.memory.cID == a.id);
                let sumb = _.sum(creepsInRoom, (c) => c.memory.role == "miner" && c.memory.cID == b.id);
                return suma - sumb;
            })[0].id;
            console.log("Container for " + creep.name + " is " + creep.memory.cID);
        }
        
        let container = Game.getObjectById(creep.memory.cID);
        if(!container) {
            console.log("Problem getting container for " + creep.name);
            delete creep.memory.cID;
            return;
        }
        
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.transfering) {
            let source = container.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps : true});
            if(!source) {
                console.log("Problem getting source for " + creep.name);
                return;
            }
            creep.memory.energyID = source.id;
            if(creep.harvest(source) == ERR_NOT_IN_RANGE) {
                creep.moveTo(source, { costCallback : function(name, cm) { cm.set(4, 43, 255) } });
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
	
	create: function(spawn) {
	    var newName = spawn.createCreep([WORK,WORK,WORK,WORK,WORK,WORK,WORK,CARRY,MOVE], "Miner" + "." + Math.random().toFixed(2), {role: 'miner'});
        console.log('Born: ' + newName);
	}
};

module.exports = roleMiner;