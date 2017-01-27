var utils = require('utils');

var role = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        let source;
        let container;

        if(creep.memory.cID === undefined || !creep.memory.energyID) {
            let containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
            if(!containers.length) {
                console.log(creep.name + ": no containers in room, nothing to do");
                return;
            }
            container = containers.sort( function(a,b) { 
                let suma = _.sum(Game.creeps, function (c) {let sum = 0; if(c.memory.role == "miner" && c.memory.cID == a.id) {sum += c.ticksToLive} return sum;});
                let sumb = _.sum(Game.creeps, function (c) {let sum = 0; if(c.memory.role == "miner" && c.memory.cID == b.id) {sum += c.ticksToLive} return sum;});
                return suma - sumb;
            })[0];
            creep.memory.cID = container.id;
            console.log(creep.name + " found container " + creep.memory.cID);

            source = container.pos.findClosestByPath(FIND_SOURCES, {ignoreCreeps : true});
            if(!source) {
                console.log(creep.name + " problem getting source");
                return;
            }
            creep.memory.energyID = source.id;
            console.log(creep.name + " found source " + creep.memory.energyID);
        } else {
            container = Game.getObjectById(creep.memory.cID);
            if(!container) {
                console.log(creep.name + " problem getting container by id=" + creep.memory.cID);
                delete creep.memory.cID;
                return;
            }

            source = Game.getObjectById(creep.memory.energyID);
            if(!source) {
                console.log(creep.name + " problem getting source by id=" + creep.memory.energyID);
                delete creep.memory.cID;
                return;
            }
        }

        if(container.pos.inRangeTo(source, 2)) {
            if(creep.pos.isNearTo(source) && creep.pos.isNearTo(container)) {
                if(creep.carry.energy < creep.carryCapacity)
                    creep.harvest(source);
                creep.transfer(container, RESOURCE_ENERGY);
            } else {
                creep.moveTo(source);
                creep.moveTo(container);
            }
        } else {
            if(creep.carry.energy == 0 && creep.memory.transfering) {
                creep.memory.transfering = false;
            } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
                creep.memory.transfering = true;
            }
            
            if(!creep.memory.transfering)
                if(creep.harvest(source) == ERR_NOT_IN_RANGE)
                    creep.moveTo(source);
            else
                if(creep.transfer(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE)
                    creep.moveTo(container);
        }
	},
	
    create: function(energy) {
        energy -= 50;
        let body = [CARRY];
        let wlim = 5;
        let fat = 1;
        let mnum = 0;
        while (energy >= 100 && wlim) {
            if (energy >= 100) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            energy -= 100;
	        }
            if ((!mnum || fat/(mnum*2) >= 2) && energy >= 50) {
                body.push(MOVE);
	            energy -= 50;
                mnum++;
            }
        }

	    return [body, energy];
	},
};

module.exports = role;