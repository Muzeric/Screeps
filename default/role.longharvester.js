var travel = require('travel');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.room.name) >= 2) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller, {ignoreHostiled: 1});
			return;
        }

        if (!creep.memory.containerRoomName) {
            creep.memory.containerRoomName = this.findContainerRoomName(creep);
            return;
        }

        if (!creep.attackNearHostile()) {
            return;
        } else {
            if(_.sum(creep.carry) < creep.carryCapacity * (creep.getActiveBodyparts(WORK) > 1 ? 0.5 : 0.2) && creep.memory.transfering) {
                creep.memory.transfering = false;
                creep.memory.targetID = null;
            } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.transfering) {
                creep.memory.transfering = true;
                creep.memory.energyID = null;
            }
        }
        
        if(!creep.memory.transfering) {
            if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) > 2) {
                creep.say("AAA");
                if (creep.pos.isBorder())
                    creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller, {ignoreHostiled: 1});
                return;
            }

            creep.findSourceAndGo();
        } else {
            if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
                return;

            if (creep.room.name != creep.memory.containerRoomName && !creep.memory.targetID) {
                let p = Memory.rooms[creep.memory.containerRoomName].pointPos;
                if (!p) {
                    console.log(creep.name + ": no alive containerRoom.pos");
                    creep.memory.containerRoomName = null;
                    return;
                }
                creep.moveTo(new RoomPosition(p.x, p.y, p.roomName), {ignoreHostiled: 1});
                return;
            }

            if(!creep.memory.targetID)
                setTarget(creep);
        
            let container = Game.getObjectById(creep.memory.targetID);
            if(!container) {
                console.log("Problem getting container for " + creep.name);
                creep.memory.targetID = null;
                return;
            }

            let futureEst = _.sum(creep.carry) > container.energyCapacity - container.energy ? true : false;
            let res = creep.transfer(container, RESOURCE_ENERGY);
            if(res == ERR_NOT_IN_RANGE) {
                creep.moveTo(container);
            } else if (res == ERR_FULL || res == OK && futureEst) {
                if (setTarget(creep) == OK)
                    creep.moveTo(Game.getObjectById(creep.memory.targetID));
            } else {
                creep.memory.targetID = null;
            }
        }
	},

    prerun : function (creep) {
        if (!creep.memory.containerRoomName)
            creep.memory.containerRoomName = this.findContainerRoomName(creep);
    },

    findContainerRoomName: function (creep) {
        let minCost;
        let res = null;
        _.filter(Game.rooms, r => r.memory.type == "my" && r.memory.pointPos && r.getPathToRoom(creep.memory.roomName) > 0 && r.getPathToRoom(creep.memory.roomName) <= 4*50 && Game.map.getRoomLinearDistance(r.name, creep.memory.roomName) <= 3).forEach( function(r) {
            let carryParts = _.sum( _.map( _.filter(Game.creeps, c => c.memory.role == "longharvester" && c.memory.containerRoomName == r.name), c => _.sum(c.body, p => p.type == CARRY) ) );
            let carryDistance = r.getPathToRoom(creep.memory.roomName) || 0;
            let noSpace = r.storage ? (r.storage.storeCapacity - _.sum(r.storage.store) < MIN_SPACE_FOR_LONGHARVEST) : 0;
            let cost = (carryParts + carryDistance / 3) / r.energyCapacityAvailable + (r.memory.freeEnergy > MAX_ENERGY_BY_LONGHARVEST ? 50 : 0) + noSpace * 10000;
            if (minCost === undefined || cost < minCost) {
                res = r.name;
                minCost = cost;
            }
        });

        if (!res)
            console.log(creep.name + ": findContainerRoomName, can't set container room name from " + creep.memory.roomName);
        return res;

        //console.log(this.name + ": set containerRoomName=" + this.memory.containerRoomName);
    },
	
    create: function(energy, opts) {
        let attack = 0;
        let partsLimit = 50;
        if (energy > 1000 && opts.attack)
            attack = 1;
        if (attack) {
	        energy -= 80*2 + 50*1; // For move-attack parts
            partsLimit -= 3;
        }
        let body = [];
	    let cnum = 0;
	    let fat = 0;
        let wnum = 0;
	    while (energy >= 50 && body.length < partsLimit) {
            if(fat >= 0 && energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
	        }
            if(cnum % 2 == 0 && energy >= 100 && (opts.work || !wnum) && body.length < partsLimit) {
	            body.push(WORK);
	            energy -= 100;
	            fat++;
                wnum++;
	        }
	        if(fat >= 0 && energy >= 50 && body.length < partsLimit) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
	        }
	        if(energy >= 50 && body.length < partsLimit) {
	            body.push(CARRY);
	            energy -= 50;
	            cnum++;
	            fat++;
	        }
	    }
        if (attack)
            body.push(MOVE,ATTACK,ATTACK);
	    return [body, energy];
	},
};

function setTarget (creep) {
    let memory = creep.room.memory;
    if (!memory) {
        console.log(creep.name + ": setTarget have no memory of " + creep.room.name);
        return ERR_NOT_IN_RANGE;
    }

    creep.memory.targetID = null;
    let targets = _.filter(
        _.filter(memory.structures[STRUCTURE_LINK] || [], t => !t.storaged).concat(
        (memory.structures[STRUCTURE_EXTENSION] || []),
        (memory.structures[STRUCTURE_LAB] || []), 
        _.filter(memory.structures[STRUCTURE_CONTAINER] || [], t => t.controllered), 
        (memory.structures[STRUCTURE_TOWER] || []),
        (memory.structures[STRUCTURE_SPAWN] || []),
        _.filter(memory.structures[STRUCTURE_TERMINAL] || [], t => t.energy < MIN_TERMINAL_ENERGY),
        (memory.structures[STRUCTURE_STORAGE] || []),
        _.filter(memory.structures[STRUCTURE_NUKER] || [], t => creep.room.memory.freeEnergy >= NUKER_ENERGY_LIMIT),
        (memory.structures[STRUCTURE_POWER_SPAWN] || [])
    ),
    t => t.energy < t.energyCapacity && (!("my" in t) || t.my));

    if (!targets.length) {
        //console.log(creep.name + ": no any container for energy");
        return ERR_NOT_FOUND;
    }

    let minTarget;
    let minCost;
    for(let target of targets) {
        let wantEnergy = target.energyCapacity - target.energy;
        let cpath = creep.pos.getRangeTo(target.pos.x, target.pos.y);
        let wantCarry = global.cache.wantCarry[target.id] || 0;
        let cpriority = 0;
        if (wantCarry >= wantEnergy)
            continue;
        //else if (target.structureType == STRUCTURE_LINK)
        //    cpriority = 50;
        else if (target.structureType == STRUCTURE_STORAGE)
            cpriority = -100;
        else if (target.structureType == STRUCTURE_TOWER && target.energy < target.energyCapacity * 0.9)
            cpriority = 100;
        else if (target.structureType == STRUCTURE_TOWER && target.energy > target.energyCapacity * 0.9)
            cpriority = -30;
        else if (target.structureType == STRUCTURE_NUKER)
            cpriority = -49;

        let cost = cpath * 1.2 - cpriority;
        if (minCost === undefined || cost < minCost) {
            minTarget = target;
            minCost = cost;
        }
        //if (creep.name == "harvester.0.999")
        //   console.log(creep.name + " [" + creep.room.name + "] has target " + target.id + " in " + cpath + " with " + wantCarry + " wantCarry and " + wantEnergy + " wanted and cpriotiy=" + cpriority + " cost=" + cost + ", targetID=" + minTarget.id);
    }
    if (minTarget === undefined)
        return ERR_NOT_FOUND;
        
    creep.memory.targetID = minTarget.id;
    global.cache.wantCarry[creep.memory.targetID] = (global.cache.wantCarry[creep.memory.targetID] || 0) + _.min([creep.carry.energy, minTarget.energyCapacity - minTarget.energy]);

    return OK;
}

module.exports = role;
profiler.registerObject(role, 'roleLongharvester');