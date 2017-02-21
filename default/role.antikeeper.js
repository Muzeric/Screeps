var utils = require('utils');

var role = {

    run: function(creep) {
        let healed = 0;
        if (creep.hits < creep.hitsMax) {
            creep.heal(creep);
            healed = 1;
        }
	    
        let friend = _.filter(Game.creeps, c => c.memory.role == "antikeeper" && c.memory.roomName == creep.memory.roomName && c != creep && !c.spawning)[0];
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            if (!friend && Memory.warning[creep.memory.roomName] > 1) {
                creep.say("Want pair");
                creep.moveTo(Game.spawns[creep.memory.spawnName])
            } else if (!friend || creep.pos.inRangeTo(friend, 4) || Memory.warning[creep.memory.roomName] < 1 || creep.pos.x == 0 || creep.pos.y == 0 || creep.pos.x == 49 || creep.pos.y == 49 || friend.room.name == creep.memory.roomName) {
                creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName], {visualizePathStyle : {lineStyle: "dotted", stroke : "#FF0000", opacity : 0.5}});
            } else {
                creep.moveTo(friend);
            }
            return;
        } else {
            if (!friend && Memory.warning[creep.memory.roomName] > 1) {
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
                return;
            }
        }

        let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (target && friend && (!creep.pos.inRangeTo(friend, 4) || friend.hits < friend.hitsMax) && !creep.pos.inRangeTo(target, 4) ) {
            creep.moveTo(friend);
            if (friend.hits < friend.hitsMax && !healed) {
                if (creep.heal(friend) == ERR_NOT_IN_RANGE)
                    creep.rangedHeal(friend);
            }
            return;
        }

        let seeked;
        if (target) {
            let safePlace;
            if (!creep.memory.arg) {
                safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(creep, target.pos, 3));
                creep.rangedAttack(target);
            } else {
                if (creep.pos.isNearTo(target)) {
                    if (healed)
                        creep.cancelOrder('heal');
                    creep.attack(target);
                }
            }
            creep.moveTo(safePlace ? safePlace : target)
        } else if (seeked = creep.pos.findInRange(FIND_MY_CREEPS, 11, {filter: c => c.hits < c.hitsMax && c != creep})[0] ) {
            if (creep.pos.isNearTo(seeked)) {
                if (!healed)
                    creep.heal(seeked);
            } else {
                creep.moveTo(seeked);
                creep.rangedHeal(seeked);
            }
        } else {
            let lairs = creep.room.find(FIND_STRUCTURES, { filter : s => s.structureType == STRUCTURE_KEEPER_LAIR});
            if (!lairs.length) {
                console.log(creep.name + " no lairs in " + creep.room.name);
                return;
            }
            let lair = lairs.sort(function(a,b) {
                return a.ticksToSpawn - b.ticksToSpawn;
            })[0];

            if (creep.memory.arg || creep.pos.getRangeTo(lair) > 3)
                creep.moveTo(lair);
        }

	},
	
    create: function(energy, hostiles) {
        // 10 * 6 + 150 * 16 + 50 * 13 + 250 * 3 = 4560 3860
        // 10 * 6 + 80 * 19 + 50 * 15  + 250 * 5 = 3790 3580
        let tnum = hostiles ? 6 : 6;
        let anum = hostiles ? 19 : 0;
        let rnum = hostiles ? 0 : 16;
        let hnum = hostiles ? 5 : 3;
        let mnum = Math.ceil((tnum + anum + rnum + hnum)/2);
        energy -= 10 * tnum + 80 * anum + 150 * rnum + 50 * mnum + 250 * hnum;
        
        let body = [];
        
        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 1)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        while (rnum-- > 0)
            body.push(RANGED_ATTACK);
        while (mnum-- > -1)
            body.push(MOVE);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;