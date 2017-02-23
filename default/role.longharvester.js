var utils = require('utils');

var role = {
    run: function(creep) {
        if (Memory.warning[creep.room.name] > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

        if (!creep.memory.containerRoomName)
            creep.setContainerRoomName();

        if(!creep.memory.energyName || !Game.flags[creep.memory.energyName]) {
            if(!set_energy(creep)) 
                return;
        }

        if (!creep.attackNearHostile()) {
            console.log(creep.name + " attacked near hostile");
            return;
        } else {
            if(creep.carry.energy == 0 && creep.memory.transfering) {
                creep.memory.transfering = false;
                creep.memory.cID = null;
            } else if (creep.carry.energy == creep.carryCapacity && !creep.memory.transfering) {
                creep.memory.transfering = true;
                creep.memory.energyID = null;
            }
        }
        
        if(!creep.memory.transfering) {
            if (Memory.warning[creep.memory.roomName] > 1) {
                creep.say("AAA");
                if (creep.pos.x == 49 || creep.pos.y == 49 || creep.pos.x == 0 || creep.pos.y == 0)
                    creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
                return;
            }

	        if(creep.room.name == Game.flags[creep.memory.energyName].pos.roomName)
                creep.findSourceAndGo();
            else
                creep.moveTo(Game.flags[creep.memory.energyName].pos);
        } else {
            if (creep.room.memory.type == 'lair' && !creep.goFromKeepers())
                return;

            if (creep.room.name != creep.memory.containerRoomName && !creep.memory.cID) {
                let p = Memory.rooms[creep.memory.containerRoomName].pointPos;
                if (!p) {
                    console.log(creep.name + ": no alive containerRoom.pos");
                    creep.memory.containerRoomName = null;
                    return;
                }
                creep.moveTo(new RoomPosition(p.x, p.y, p.roomName));
                return;
            }

            if(!creep.memory.cID)
                set_cid(creep);
        
            let container = Game.getObjectById(creep.memory.cID);
            if(!container) {
                console.log("Problem getting container for " + creep.name);
                creep.memory.cID = null;
                return;
            }

            let res = creep.transfer(container, RESOURCE_ENERGY);
            if(res == ERR_NOT_IN_RANGE) 
                creep.moveTo(container);
            else if (res == ERR_FULL)
                set_cid(creep);
        }
	},
	
    create: function(energy, worker) {
        let attack = 0;
        if (energy > 1000)
            attack = 1;
        if (attack)
	        energy -= 80*2 + 50*1; // For move-attack parts
        let body = [];
	    let cnum = 0;
	    let fat = 0;
        let wnum = 0;
	    while (energy >= 50 && body.length < 47) {
            if(fat >= 0 && energy >= 50) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
	        }
            if(cnum % 2 == 0 && energy >= 100 && (worker || !wnum) && body.length < 47) {
	            body.push(WORK);
	            energy -= 100;
	            fat++;
                wnum++;
	        }
	        if(fat >= 0 && energy >= 50 && body.length < 47) {
	            body.push(MOVE);
	            energy -= 50;
	            fat -= 2;
	        }
	        if(energy >= 50 && body.length < 47) {
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

function set_cid (creep) {
    //console.log("Searching container for " + creep.name);
    if(creep.room.storage && creep.room.storage.storeCapacity - _.sum(creep.room.storage.store) > 0) {
        let links = creep.room.find(FIND_STRUCTURES, {filter: s => s.structureType == STRUCTURE_LINK && s.pos.getRangeTo(creep.room.storage) > 3 && s.energyCapacity - s.energy > 0});
        creep.memory.cID = creep.pos.findClosestByPath(links.concat(creep.room.storage), {ignoreCreeps: true}).id;
        return;
    }
    let containers = creep.room.find(FIND_STRUCTURES, { filter: s => s.structureType == STRUCTURE_CONTAINER });
    if(!containers.length) {
        console.log(creep.name + " no containers in room, nothing to do");
        return;
    }
    creep.memory.cID = containers.sort( function(a,b) { return a.store[RESOURCE_ENERGY] - b.store[RESOURCE_ENERGY]; })[0].id;
    //console.log(creep.name + " container=" + creep.memory.cID);
}

function set_energy (creep) {
    let sources = _.filter(Game.flags, f => f.name.substring(0, 6) == 'Source' && f.pos.roomName == creep.memory.roomName);
    if(!sources.length) {
        console.log(creep.name + " found no flags");
        return;
    }
    //console.log(creep.name + " sources: " + sources);
    
    creep.memory.energyName = sources.sort( function(a,b) { 
        let suma = _.sum(Game.creeps, (c) => c.memory.role == "longharvester" && c.memory.energyName == a.name);// + Game.map.getRoomLinearDistance(a.pos.roomName, creep.memory.roomName);
        let sumb = _.sum(Game.creeps, (c) => c.memory.role == "longharvester" && c.memory.energyName == b.name);// + Game.map.getRoomLinearDistance(b.pos.roomName, creep.memory.roomName);
        //console.log("a=" + a.id + ",b=" + b.id + ",suma=" + suma + ",sumb=" + sumb);
        return suma - sumb;
    })[0].name;
    //console.log(creep.name + " energyName=" + creep.memory.energyName);
}

module.exports = role;