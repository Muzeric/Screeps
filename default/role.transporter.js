var utils = require('utils');
var travel = require('travel');
var queue = require('queue.transport');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.room.name) > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

        let terminal = queue.getDefaultStorage();
        let storage =  queue.getDefaultTerminal();
        if (!terminal || !storage) {
            console.log(creep.name + ": no main terminal or storage");
            return;
        }

        if (!creep.memory.reqID && _.sum(creep.carry) > 0) {
            if (creep.pos.isNearTo(storage)) {
                let res = 0;
                for(let resourceType in creep.carry)
                    res += creep.transfer(storage, resourceType);
                if (res < 0) // Not all carry transfered
                    return;
            } else {
                return creep.moveTo(storage);
            }
        }

        let request = queue.getRequest(creep.memory.reqID, creep.id);
        if (!request) {
            creep.memory.reqID = null;
            return;
        } else {
            creep.memory.reqID = request.id;
        }

        let stage = 1;
        if (_.sum(creep.carry) == creep.carryCapacity || creep.carry[request.resourceType] >= request.amount)
            stage = 2;
        
        if (stage == 1) { // go to source and get res
            let from = Game.getObjectById(request.fromID);
            if (!from) {
                console.log(creep.name + ": can't get from by id=" + request.fromID);
                queue.badRequest(creep.memory.reqID);
                creep.memory.reqID = null;
                return;
            }

            if (!creep.pos.isNearTo(from))
                return creep.moveTo(from);

            let amount = _.min([request.amount - (creep.carry[request.resourceType] || 0), creep.carryCapacity - _.sum(creep.carry), from.store[request.resourceType]]);
            if (!amount)
                return;
            let res = creep.withdraw(from, request.resourceType, amount);
            if (res < 0)
                console.log(creep.name + ": withdraw from (" + from.id + ") with res=" + res);
            else
                queue.gotResource(creep.memory.reqID, amount);

        } else if (stage == 2) { // go to dest and transfer
            let to = Game.getObjectById(request.toID);
            if (!to) {
                console.log(creep.name + ": can't get to by id=" + request.toID);
                queue.badRequest(creep.memory.reqID);
                creep.memory.reqID = null;
                return;
            }

            if (!creep.pos.isNearTo(to))
                return creep.moveTo(to);
            
            let amount = _.min([request.amount, creep.carry[request.resourceType] || 0, to.storeCapacity - _.sum(to.store)]);
            if (!amount)
                return;
            
            let res = creep.transfer(to, request.resourceType, amount);
            if (res < 0)
                console.log(creep.name + ": transfer to (" + to.id + ") with res=" + res);
            else
                creep.memory.reqID = queue.putResource(creep.memory.reqID, amount);
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