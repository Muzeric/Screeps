var utils = require('utils');
var travel = require('travel');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        /*
        if (Game.roomsHelper.getHostilesCount(creep.room.name) > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller, {ignoreHostiled: 1});
			return;
		}
        */

        if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
            return;

        let queue = global.cache.queueTransport;

        let storage = queue.getDefaultStorage();
        let terminal = queue.getDefaultTerminal();
        if (!terminal || !storage) {
            console.log(creep.name + ": no main terminal or storage");
            return;
        }

        if (!queue.checkRequest(creep.id) && _.sum(creep.carry) > 0) {
            if (creep.pos.isNearTo(storage)) {
                let res = 0;
                for(let resourceType in creep.carry)
                    res += creep.transfer(storage, resourceType);
                if (res < 0) // Not all carry transfered
                    return;
            } else {
                return creep.moveTo(storage, {ignoreHostiled: 1});
            }
        } else if (_.sum(creep.carry) == 0 && creep.ticksToLive < ALIVE_TICKS) {
            let spawn = Game.spawns[creep.memory.spawnName];
            if (spawn.recycleCreep(creep) == ERR_NOT_IN_RANGE)
                creep.moveTo(spawn, {ignoreHostiled: 1});
            return;
        }

        let request = queue.getRequest(creep.id, creep.pos);
        if (!request) {
            if (terminal)
                creep.moveTo(terminal);
            return;
        }
        
        let stage = 1;
        if (creep.carry[request.resourceType] >= 0)
            stage = 2;
        
        if (stage == 1) { // go to source and get res
            let from = Game.getObjectById(request.fromID);
            if (!from) {
                console.log(creep.name + ": can't get from by id=" + request.fromID);
                queue.badRequest(request.id);
                return;
            }

            let fromAmount = "mineralType" in from ? from.mineralAmount : from.store[request.resourceType];

            if (!creep.pos.isNearTo(from))
                return creep.moveTo(from, {ignoreHostiled: 1});

            let amount = _.min([request.amount - (creep.carry[request.resourceType] || 0), creep.carryCapacity - _.sum(creep.carry), fromAmount]);
            if (!amount) {
                queue.unbindRequest(request.id);
                return;
            }

            let res = creep.withdraw(from, request.resourceType, amount);
            if (res < 0)
                console.log(creep.name + ": withdraw from (" + from.id + ") with res=" + res);
            else
                queue.gotResource(request.id, amount);

        } else if (stage == 2) { // go to dest and transfer
            let to = Game.getObjectById(request.toID);
            if (!to) {
                console.log(creep.name + ": can't get to by id=" + request.toID);
                queue.badRequest(request.id);
                return;
            }

            let toSpaceLeft = "mineralType" in to ? to.mineralCapacity - to.mineralAmount :
                    (to.structureType == STRUCTURE_NUKER && request.resourceType == "G" ? to.ghodiumCapacity - to.ghodium : to.storeCapacity - _.sum(to.store))
            ;
            if (!toSpaceLeft || "mineralType" in to && to.mineralType && to.mineralType != request.resourceType) {
                queue.unbindRequest(request.id);
                return;
            }

            if (!creep.pos.isNearTo(to))
                return creep.moveTo(to, {ignoreHostiled: 1});
            
            let amount = _.min([request.amount, creep.carry[request.resourceType] || 0, toSpaceLeft]);
            if (!amount)
                return;
            
            let res = creep.transfer(to, request.resourceType, amount);
            if (res < 0)
                console.log(creep.name + ": transfer to (" + to.id + ") with res=" + res);
            else
                queue.putResource(request.id, amount);
        }
	},
	
    create: function(energy, opts) {
        let partsLimit = 50;
        let body = [];
	    let fat = 0;
	    while (energy >= 50 && body.length < partsLimit) {
	        if(fat >= 0 && energy >= 50 && body.length < partsLimit) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
	        }
	        if(energy >= 50 && body.length < partsLimit) {
	            body.push(CARRY);
	            energy -= 50;
	            fat++;
	        }
	    }
	    return [body, energy];
	},
};

module.exports = role;
profiler.registerObject(role, 'roleTransporter');