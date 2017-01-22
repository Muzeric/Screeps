var utils = require('utils');

var role = {
    run: function(creep) {
        if(!creep.memory.energyName || !Game.flags[creep.memory.energyName]) {
            if(!set_energy(creep)) return;
        }
        
        if(creep.memory.cID === undefined)
            set_cid(creep);
        
        let container = Game.getObjectById(creep.memory.cID);
        if(!container) {
            console.log("Problem getting container for " + creep.name);
            delete creep.memory.cID;
            return;
        }
        
        if(creep.carry.energy == 0 && creep.memory.transfering) {
	        creep.memory.transfering = false;
	    } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
	        creep.memory.transfering = true;
	        set_cid(creep);
	    }
	    
	    if(!creep.memory.transfering) {
	        if(creep.room.name == Game.flags[creep.memory.energyName].pos.roomName) {
	            let attack_res = utils.try_attack(creep);
	            if(!attack_res) {
	                creep.memory.transfering = true;
	            } else if (attack_res == 1) {
	                ;
	            } else {
                    let source;
                    let res;
                    let containers = Game.flags[creep.memory.energyName].pos.findInRange(FIND_STRUCTURES, 2, {filter : s => 
                        s.structureType == STRUCTURE_CONTAINER &&
                        _.sum(Game.creeps, (c) => c.memory.role == "longminer" && c.memory.cID == s.id)
                    });
                    if(containers.length) {
                        source = containers[0];
                        res = creep.withdraw(source, RESOURCE_ENERGY);
                    } else {
	                    let sources = creep.room.lookForAt(LOOK_SOURCES, Game.flags[creep.memory.energyName].pos);
                        if(!sources.length) {
                            console.log(creep.name + " can't find source");
                            return;
                        }
                        source = sources[0];
                        res = creep.harvest(source);
                    }
                    
                    if(res == ERR_NOT_IN_RANGE) {
                        creep.moveTo(source);
                    } else if (res < 0) {
                        //console.log(creep.name + " tried harvest: " + res);
                    }
	            }
	        } else {
                creep.moveTo(Game.flags[creep.memory.energyName].pos);
                //console.log(creep.name + " going to " + creep.memory.energyName + " to " + exitDir);
	        }
        } else {
            if(creep.room.name == container.pos.roomName) {
                let res = creep.transfer(container, RESOURCE_ENERGY);
                if(res == ERR_NOT_IN_RANGE) {
                    let res = creep.moveTo(container);
                } else if (res == ERR_FULL) {
                    //console.log(creep.name + " container is full");
                    set_cid(creep);
                    return;
                }
            } else {
                utils.try_attack(creep);
                creep.moveTo(container.pos);
                //console.log(creep.name + " going to " + container.pos.roomName + " to " + exitDir);
            }
        }
	},
	
    create: function(spawnName, role, total_energy) {
	    let spawn = Game.spawns[spawnName];
        if(!spawn) {
            console.log("No spawn with name=" + spawnName);
            return;
        }
        total_energy -= 80*3 + 50*2; // For move-attack parts
        let body = [];
	    let cnum = 0;
	    let fat = -1;
	    while (total_energy >= 50) {
	        if(fat >= 0 && total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	            fat -= 2;
	        }
	        if(total_energy >= 50) {
	            body.push(CARRY);
	            total_energy -= 50;
	            cnum++;
	            fat++;
	        }
	        if(fat >= 0 && total_energy >= 50) {
	            body.push(MOVE);
	            total_energy -= 50;
	            fat -= 2;
	        }
	        if(cnum % 2 == 0 && total_energy >= 100) {
	            body.push(WORK);
	            total_energy -= 100;
	            fat++;
	        }
	    }
        body.push(MOVE,MOVE,ATTACK,ATTACK,ATTACK);
	    let newName = spawn.createCreep(body, role + "." + Math.random().toFixed(2), {role: role, spawnName: spawnName});
	    return [newName, body, total_energy];
	}
};

function set_cid (creep) {
    //console.log("Searching container for " + creep.name);
    if(creep.memory.energyName && (creep.memory.energyName == 'Source.W47N4' || creep.memory.energyName == 'Source.W47N3') && creep.memory.roomName == "W48N4") {
        let links = _.filter([Game.getObjectById('5885198c52b1ece7377c7f8b'), Game.getObjectById('587869503d6c02904166296f')], l => l.energy + creep.carry <= l.energyCapacity);
        if(links.length) {
            creep.memory.cID = links[0].id;
            //console.log("Link for " + creep.name + " is " + creep.memory.cID);
            return;
        }
    }
    if(Game.spawns[creep.memory.spawnName].room.storage) {
        creep.memory.cID = Game.spawns[creep.memory.spawnName].room.storage.id;
        //console.log(creep.name + " storage=" + creep.memory.cID);
        return;
    }
    let containers = Game.spawns[creep.memory.spawnName].room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
    if(!containers.length) {
        console.log(creep.name + " no containers in room, nothing to do");
        return;
    }
    creep.memory.cID = containers.sort( function(a,b) { 
        let suma = _.sum(Game.creeps, function (c) {let sum = 0; if(c.memory.role == "longharvester" && c.memory.cID == a.id) {sum += c.ticksToLive} return sum;});
        let sumb = _.sum(Game.creeps, function (c) {let sum = 0; if(c.memory.role == "longharvester" && c.memory.cID == b.id) {sum += c.ticksToLive} return sum;});
        return suma - sumb;
    })[0].id;
    //console.log(creep.name + " container=" + creep.memory.cID);
}

function set_energy (creep) {
    let sources = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' );
    if(!sources.length) {
        console.log(creep.name + " found no flags");
        return;
    }
    //console.log(creep.name + " sources: " + sources);
    
    creep.memory.energyName = sources.sort( function(a,b) { 
        let suma = _.sum(Game.creeps, (c) => c.memory.role == "longharvester" && c.memory.energyName == a.name);
        let sumb = _.sum(Game.creeps, (c) => c.memory.role == "longharvester" && c.memory.energyName == b.name);
        //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
        return suma - sumb;
    })[0].name;
    //console.log(creep.name + " energyName=" + creep.memory.energyName);
}

module.exports = role;