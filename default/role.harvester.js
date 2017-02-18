var utils = require('utils');

var roleHarvester = {
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
            creep.memory.needRepair = 0;
            creep.findSourceAndGo();
        } else {
            if (creep.ticksToLive < 500)
                creep.memory.needRepair = 1;
            else if (creep.ticksToLive > 1200)
                creep.memory.needRepair = 0;
            if (creep.memory.needRepair) {
                let spawns = creep.room.find(FIND_MY_SPAWNS);
                if (!spawns.length) {
                    console.log(creep.name + ": needRepair, but no spawns in room");
                    return;
                }
                let spawn = spawns.sort(function(a,b) {return a.spawning - b.spawning;})[0];
                if (spawn.energy < spawn.energyCapacity)
                    creep.transfer(spawn, RESOURCE_ENERGY);
                if(spawn.renewCreep(creep) == ERR_NOT_IN_RANGE)
                    creep.moveTo(spawn);
                return;
            }
            let target;
            if (creep.memory.targetID)
                target = Game.getObjectById(creep.memory.targetID);
            if( !target ||
                (target.energyCapacity && target.energy == target.energyCapacity) ||
                (target.storeCapacity && target.store[RESOURCE_ENERGY] == target.storeCapacity) ||
                (target.structureType == STRUCTURE_TOWER && target.energy > target.energyCapacity * 0.9)
             ) {
                creep.memory.targetID = null;
                let targets = creep.room.find(FIND_STRUCTURES, {filter: s => 
                    (
                        s.structureType == STRUCTURE_EXTENSION ||
                        s.structureType == STRUCTURE_LAB ||
                        s.structureType == STRUCTURE_TOWER ||
                        s.structureType == STRUCTURE_SPAWN ||
                        s.structureType == STRUCTURE_STORAGE
                    ) && (
                        (s.energyCapacity && s.energy < s.energyCapacity) ||
                        (s.storeCapacity && s.store[RESOURCE_ENERGY] < s.storeCapacity)
                    )
                });

                if (!targets.length) {
                    //console.log(creep.name + ": no any container for energy");
                    return;
                }

                let targetInfo = {};
                for(let target of targets) {
                    let wantEnergy = target.storeCapacity ? target.storeCapacity - target.store[RESOURCE_ENERGY] : target.energyCapacity - target.energy;
                    let cpath = creep.pos.getRangeTo(target);
                    let wantCarry = _.reduce(_.filter(Game.creeps, c => c.memory.role == "harvester" && c.memory.targetID == target.id), function (sum, value) { return sum + value.carry.energy; }, 0);
                    let cpriority = 0;
                    if (wantCarry >= wantEnergy)
                        cpriority = -100;
                    else if (target.structureType == STRUCTURE_STORAGE)
                        cpriority = -50;
                    else if (target.structureType == STRUCTURE_TOWER && target.energy < target.energyCapacity * 0.9)
                        cpriority = 100;
                    else if (target.structureType == STRUCTURE_TOWER && target.energy > target.energyCapacity * 0.9)
                        cpriority = -30;

                    targetInfo[target.id] = cpath * 1.2 - cpriority;
                    //console.log(creep.name + " [" + creep.room.name + "] has target " + target.id + " in " + cpath + " with " + wantCarry + " wantCarry and " + wantEnergy + " wanted and cpriotiy=" + cpriority + " sum=" + targetInfo[target.id]);
                }
                target = targets.sort( function (a,b) {
                    let suma = targetInfo[a.id];
                    let sumb = targetInfo[b.id];
                    //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
                    return suma - sumb;
                })[0];
                creep.memory.targetID = target.id;
            }

            if(!target) {
                console.log(creep.name + ": target "+ creep.memory.targetID +" dead");
                creep.memory.targetID = null;
                return;
            }

            if(creep.transfer(target, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                var res = creep.moveTo(target);
                //console.log(creep.name + " go to "+ target.pos.x + "," + target.pos.y +" res=" + res);
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

module.exports = roleHarvester;