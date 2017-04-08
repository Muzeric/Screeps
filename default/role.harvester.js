var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (!utils.checkInRoomAndGo(creep))
            return;

        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
            creep.memory.targetID = null;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
	    
	    if(!creep.memory.transfering) {
            creep.findSourceAndGo();
        } else {
            let target = getTarget(creep);
            if(!target) {
                //console.log(creep.name + ": target "+ creep.memory.targetID +" dead");
                creep.memory.targetID = null;
                return;
            }

            if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(target);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            }
        }
	},
	
	create: function(energy, worker) {
	    let energyDiff = 0;
        if (energy > 1350) {
            energyDiff = energy - 1350;
            energy = 1350;
        }
        let body = [];
        let fat = 0;
        let mnum = 0;
        let wnum = 0;
	    while (energy >= 50 && body.length < 50) {
	        if((!mnum || fat/(mnum*2) >= 1) && energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
                mnum++;
	        }
	        if(energy >= 50 && body.length < 50) {
	            body.push(CARRY);
	            energy -= 50;
	            fat++;
	        }
            if((worker || !wnum) && energy >= 100 && body.length < 50) {
	            body.push(WORK);
	            energy -= 100;
	            fat++;
                wnum++;
	        }
	    }
	    energy += energyDiff;
	    return [body, energy];
	},
};

function getTarget (creep) {
    let target = Game.getObjectById(creep.memory.targetID);
    
    if (!target || 
        (target.energyCapacity && target.energy == target.energyCapacity) ||                
        (target.storeCapacity && _.sum(target.store) == target.storeCapacity)
    ) {
        if (creep.memory.targetObj)
            creep.memory.targetObj.energy = creep.memory.targetObj.energyCapacity;
        setTarget(creep);
    }
    target = Game.getObjectById(creep.memory.targetID);
    
    return target;
}

function setTarget (creep) {
    creep.memory.targetID = null;
    let targets = _.filter(
        (creep.room.memory.structures[STRUCTURE_EXTENSION] || []).concat( 
        (creep.room.memory.structures[STRUCTURE_LAB] || []), 
        (creep.room.memory.structures[STRUCTURE_TOWER] || []),
        (creep.room.memory.structures[STRUCTURE_SPAWN] || []),
        (creep.room.memory.structures[STRUCTURE_TERMINAL] || []),
        (creep.room.memory.structures[STRUCTURE_STORAGE] || []),
        (creep.room.memory.structures[STRUCTURE_NUKER] || []),
        (creep.room.memory.structures[STRUCTURE_POWER_SPAWN] || [])
    ),
    t => t.energy < t.energyCapacity);

    if (!targets.length) {
        //console.log(creep.name + ": no any container for energy");
        return;
    }

    let minTarget;
    let minCost;
    for(let target of targets) {
        if (target.structureType == STRUCTURE_TERMINAL && target.energy > MIN_TERMINAL_ENERGY)
            continue;
        else if (target.structureType == STRUCTURE_NUKER && creep.room.memory.energy < REPAIR_ENERGY_LIMIT)
            continue;
        let wantEnergy = target.energyCapacity - target.energy;
        let cpath = creep.pos.getRangeTo(target.pos.x, target.pos.y);
        let wantCarry = global.cache.wantCarry[creep.room.name] ? global.cache.wantCarry[creep.room.name][target.id] || 0 : 0;
        let cpriority = 0;
        if (wantCarry >= wantEnergy)
            cpriority = -100;
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
    creep.memory.targetID = minTarget.id;
    creep.memory.targetObj = minTarget;
}

module.exports = role;
profiler.registerObject(role, 'roleHarvester');