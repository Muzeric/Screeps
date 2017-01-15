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
                        !_.some(Game.creeps, {filter : c => c.memory.role == "longminer" && c.memory.cID == s.id && c.ticksToLive > 200})
                });

                if(containers.length) {
                    container = containers[0];
                    break;
                }
            }
            if (!container) {
                console.log(creep.name + ": no containers in room, nothing to do");
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

        if(container.pos.inRangeTo(source, 2)) {
            if(creep.pos.isNearTo(source) && creep.pos.isNearTo(container)) {
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
        console.log("total_energy:" + total_energy);
        total_energy -= 80*3 + 50*2; // For move-attack parts
        let body = [];
        let wnum = 0;
	    let fat = -1;
	    while (total_energy >= 50) {
	        if(fat >= 0 && total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	            fat -= 2;
	        }
	        if(wnum % 3 == 0 && total_energy >= 50) {
	            body.push(CARRY);
	            total_energy -= 50;
	            fat++;
	        }
	        if(fat >= 0 && total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	            fat -= 2;
	        }
	        if(total_energy >= 100) {
	            body.push(WORK);
	            total_energy -= 100;
                wnum++;
	            fat++;
	        }
	    }
        body.push(MOVE,MOVE,ATTACK,ATTACK,ATTACK);
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
        console.log("Born by " + spawnName + " creep " + newName + " (" + body + ")");
	}
};

module.exports = role;