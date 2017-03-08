var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {
    run: function(creep) {
        if (Game.roomsHelper.getHostilesCount(creep.room.name) > 1) {
			creep.say("AAA");
			creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
			return;
		}

        if (!creep.memory.containerRoomName) {
            creep.memory.containerRoomName = this.findContainerRoomName(creep);
            return;
        }

        if (!creep.attackNearHostile()) {
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
            if (Game.roomsHelper.getHostilesCount(creep.memory.roomName) > 1) {
                creep.say("AAA");
                if (creep.pos.isBorder())
                    creep.moveTo(Game.spawns[creep.memory.spawnName].room.controller);
                return;
            }

            creep.findSourceAndGo();
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

    prerun : function (creep) {
        if (!creep.memory.containerRoomName)
            creep.memory.containerRoomName = this.findContainerRoomName(creep);
    },

    findContainerRoomName: function (creep) {
        let minCost;
        let res = null;
        _.filter(Game.rooms, r => r.memory.type == "my" && r.memory.pointPos && Game.map.getRoomLinearDistance(r.name, creep.memory.roomName) <= 3).forEach( function(r) {
            let carryParts = _.sum( _.map( _.filter(Game.creeps, c => c.memory.role == "longharvester" && c.memory.containerRoomName == r.name), c => _.sum(c.body, p => p.type == CARRY) ) );
            let cost = carryParts / r.energyCapacityAvailable;
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

module.exports = role;
profiler.registerObject(role, 'roleLongharvester');