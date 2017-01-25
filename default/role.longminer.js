var utils = require('utils');

var role = {
    run: function(creep) {
        let source;
        let container;

        if(creep.memory.cID === undefined || !creep.memory.energyID) {
            let flags = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' && f.room);
            if (!flags.length) {
                console.log(creep.name + " found no Source.flags with known rooms");
                return;
            }

            let flag;
            for (flag of flags.sort( function (a,b) { return creep.pos.getRangeTo(a) - creep.pos.getRangeTo(b); })) {
                let containers = flag.pos.findInRange(FIND_STRUCTURES, 2, {filter : s => 
                        s.structureType == STRUCTURE_CONTAINER &&
                        !_.some(Game.creeps, c => c.memory.role == "longminer" && c.memory.cID == s.id && c.ticksToLive > 200)
                });

                if(containers.length) {
                    container = containers[0];
                    break;
                }
            }
            if (!container) {
                //console.log(creep.name + ": no containers in room, nothing to do");
                return;
            }
            creep.memory.cID = container.id;
            console.log(creep.name + " found container " + creep.memory.cID);

            let sources = container.room.lookForAt(LOOK_SOURCES, flag);
            if(!sources.length) {
                console.log(creep.name + " problem getting sources");
                return;
            }
            source = sources[0];
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

        utils.try_attack(creep);
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
	
    create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        total_energy -= 80*2 + 50; // For move-attack parts
        total_energy -= 50;
        let body = [CARRY];
        let wlim = 5;
        let fat = 1;
        while (total_energy >= 100 && wlim) {
            if (total_energy >= 100) {
	            body.push(WORK);
	            wlim--;
                fat++;
	            total_energy -= 100;
	        }
            if (fat > 0 && total_energy >= 50) {
                body.push(MOVE);
	            total_energy -= 50;
                fat -= 2;
            }
        }
        if(fat > 0 && total_energy >= 50) {
            body.push(MOVE);
            total_energy -= 50;
	    }
        body.push(MOVE,ATTACK,ATTACK);
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        return [newName, body, total_energy];
	},
	
    create2: function(energy) {
	    energy -= 80*2 + 50; // For move-attack parts
        energy -= 50;
        let body = [CARRY];
        let wlim = 5;
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
        if(fat > 0 && energy >= 50) {
            body.push(MOVE);
            energy -= 50;
	    }
        body.push(MOVE,ATTACK,ATTACK);
	    return [body, energy];
	},
};

module.exports = role;