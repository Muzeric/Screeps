var utils = require('utils');

var role = {
    run: function(creep) {
        if (Memory.warning[creep.room.name] > 1) {
			creep.say("AAA");
			creep.moveTo(Game.rooms[creep.memory.roomName].controller);
			return;
		}
        
        let source;
        let container;

        if(creep.memory.cID === undefined || !creep.memory.energyID) {
            let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' && f.pos.roomName == creep.memory.roomName);
            if (!flags.length) {
                console.log(creep.name + " found no Source.flags with known rooms");
                return;
            }

            if (creep.room.name != creep.memory.roomName) {
                creep.moveTo(flags[0]);
                return;
            }

            let containers = creep.room.find(FIND_STRUCTURES, { filter: s => 
                (s.structureType == STRUCTURE_CONTAINER || s.structureType == STRUCTURE_LINK) &&
                _.some(s.pos.findInRange(FIND_SOURCES, 2, {filter: r => r.pos.findPathTo(s, {ignoreCreeps : true}).length <= 2})) 
            });
            if(!containers.length) {
                console.log(creep.name + ": no containers in room, nothing to do");
                return;
            }
            container = containers.sort( function(a,b) { 
                let suma = _.sum(_.filter(Game.creeps, c => c.memory.role == "longminer" && c.memory.cID == a.id), function(c) {return c.ticksToLive});
                let sumb = _.sum(_.filter(Game.creeps, c => c.memory.role == "longminer" && c.memory.cID == b.id), function(c) {return c.ticksToLive});
                return suma - sumb || (a.structureType == STRUCTURE_LINK ? -1 : 1);
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

        let lair;
        if (lair = creep.pos.findInRange(FIND_STRUCTURES, 10, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR && s.ticksToSpawn < 10})[0] ) {
            let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(lair.pos, 6));
            creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
            return;
        }

        let hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 10, {filter: c => c.owner.username == "Source Keeper" && (c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK))});
        if (hostiles.length) {
            let safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(hostiles[0].pos, 6));
            creep.moveTo(safePlace ? safePlace : Game.rooms[creep.memory.roomName].controller);
            return;
        }

        hostiles = creep.pos.findInRange(FIND_HOSTILE_CREEPS, 4, {filter: c => c.owner.username != "Source Keeper" && (c.getActiveBodyparts(ATTACK) || c.getActiveBodyparts(RANGED_ATTACK))});
        if (hostiles.length) {
            let target = hostiles.sort(function(a,b){ return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b) || a.hits - b.hits;})[0];
            if (creep.attack(target) == ERR_NOT_IN_RANGE)
                creep.moveTo(target);
        } else if(container.pos.inRangeTo(source, 2)) {
            if(creep.pos.isNearTo(source) && creep.pos.isNearTo(container)) {
                if (creep.carry.energy && 
                    (
                         container.hits < container.hitsMax * 0.5 && Game.time - (creep.memory.lastRepair || 0) > 2 ||
                         container.hits < container.hitsMax * 0.95 && Game.time - (creep.memory.lastRepair || 0) > 10
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
                if (creep.pos.isNearTo(container))
                    creep.moveTo(source);
                else
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
	
    create: function(energy, skarea) {
        energy -= 50; // CARRY
        let body = [];
        let wlim = skarea ? 11 : 6;
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
        if(!skarea && energy >= 80*2 + 50) {
            body.push(MOVE,ATTACK,ATTACK);
            energy -= 80*2 + 50;
        }
        body.push(CARRY);
	    return [body, energy];
	},
};

module.exports = role;