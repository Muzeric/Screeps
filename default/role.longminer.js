var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.room.name) > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

		if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) > 1) {
			creep.say("AAA");
			if (creep.pos.isBorder())
				creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

        if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
            return;

        if (creep.room.name != creep.memory.roomName) {
            let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' && f.pos.roomName == creep.memory.roomName);
            if (!flags.length) {
                console.log(creep.name + " found no Source.flags with known rooms");
                return;
            }
            creep.moveTo(flags[0]);
            return;
        }

        if(!creep.memory.cID || !creep.memory.energyID || !creep.memory.betweenPos) {
            let container = creep.room.getPairedContainer();

            if (!container) {
                console.log(creep.name + ": can't get container");
                return;
            }

            creep.memory.cID = container.id;
            creep.memory.energyID = container.source.id;
            creep.memory.betweenPos = container.betweenPos;
        }
        
        let betweenPos = new RoomPosition(creep.memory.betweenPos.x, creep.memory.betweenPos.y, creep.memory.betweenPos.roomName);
        if(!creep.attackNearHostile()) {
            return;
        } else if (creep.pos.isEqualTo(betweenPos)) {
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
	
    create: function(energy, skarea) {
        energy -= 50; // CARRY
        let body = [];
        let wlim = skarea ? 9 : 6;
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
profiler.registerObject(role, 'roleLongminer');