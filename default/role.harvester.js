const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
            creep.memory.targetID = null;
	    } else if (_.sum(creep.carry) == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        creep.memory.errors = 0;
	        creep.memory.energyID = null;
	    }
        
        let target = getTarget(creep, creep.carry.energy);
	    if(!creep.memory.transfering) {
            creep.findSourceAndGo({exceptStorage: target && target.structureType == STRUCTURE_STORAGE});
            creep.memory.targetID = null;
        } else {
            if(!target)
                return;
            
            let tres = creep.transfer(target, RESOURCE_ENERGY);
            if (tres == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(target);
                if(res == ERR_NO_PATH) {
                    creep.memory.errors++;
                } else if (res == OK) {
                    creep.memory.errors = 0;
                }
            } else if (tres == OK) {
                let estEnergy = creep.carry.energy - (target.energyCapacity ? target.energyCapacity - target.energy : target.storeCapacity - _.sum(target.store));
                if (estEnergy) {
                    let target = getTarget(creep, estEnergy, 1);
                    if(!target)
                        return;
                    creep.moveTo(target);
                } else {
                    creep.findSourceAndGo();
                }
            }
        }
	},
	
	create: function(energy, options = {}) {
        let energyDiff = 0;
        let limit = options.top ? 2700 : 1350;
        if (energy > limit) {
            energyDiff = energy - limit;
            energy = limit;
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
            if((options.work || !wnum) && energy >= 100 && body.length < 50) {
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

function getTarget (creep, estEnergy, renew) {
    let target = renew ? null : Game.getObjectById(creep.memory.targetID);
    
    if (!target || 
        (target.energyCapacity && target.energy == target.energyCapacity) ||                
        (target.storeCapacity && _.sum(target.store) == target.storeCapacity)
    ) {
        setTarget(creep, estEnergy);
    } else {
        return target;
    }
    target = Game.getObjectById(creep.memory.targetID);
    
    return target;
}

function setTarget (creep, estEnergy) {
    let memory = Memory.rooms[creep.memory.roomName];
    if (!memory) {
        console.log(creep.name + ": setTarget have no memory of " + creep.memory.roomName);
        return ERR_NOT_IN_RANGE;
    }

    creep.memory.targetID = null;
    let targets = _.filter(
        (memory.structures[STRUCTURE_EXTENSION] || []).concat( 
        (memory.structures[STRUCTURE_LAB] || []), 
        (memory.structures[STRUCTURE_CONTAINER] || []), 
        (memory.structures[STRUCTURE_TOWER] || []),
        (memory.structures[STRUCTURE_SPAWN] || []),
        (memory.structures[STRUCTURE_TERMINAL] || []),
        (memory.structures[STRUCTURE_STORAGE] || []),
        (memory.structures[STRUCTURE_NUKER] || []),
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
        if (target.structureType == STRUCTURE_TERMINAL && target.energy > MIN_TERMINAL_ENERGY)
            continue;
        else if (target.structureType == STRUCTURE_NUKER && creep.room.memory.freeEnergy < NUKER_ENERGY_LIMIT)
            continue;
        else if (target.structureType == STRUCTURE_CONTAINER && !target.controllered)
            continue;
        let wantEnergy = target.energyCapacity - target.energy;
        let cpath = creep.pos.getRangeTo(target.pos.x, target.pos.y);
        let wantCarry = global.cache.wantCarry[target.id] || 0;
        let cpriority = 0;
        if (wantCarry >= wantEnergy)
            continue;
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
    global.cache.wantCarry[creep.memory.targetID] = (global.cache.wantCarry[creep.memory.targetID] || 0) + estEnergy;

    return OK;
}

module.exports = role;
profiler.registerObject(role, 'roleHarvester');