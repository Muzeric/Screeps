var utils = require('utils');
const profiler = require('screeps-profiler');

var role = {

    run: function(creep) {
        creep.memory.gotoFriendID = null;
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
            if (!friend && Game.roomsHelper.getHostilesCount(creep.memory.roomName, 0) > 1) {
                creep.say("Want pair");
                creep.moveTo(Game.spawns[creep.memory.spawnName])
            } else if (!friend || creep.pos.inRangeTo(friend, 3) || Game.roomsHelper.getHostilesCount(creep.memory.roomName, 0) <= 1 || creep.pos.isBorder() || friend.room.name == creep.memory.roomName) {
                creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            } else {
                if (!friend.memory.gotoFriendID) {
                    creep.moveTo(friend);
                    creep.memory.gotoFriendID = friend.id;
                } else if (creep.pos.isBorder()) {
                    creep.moveTo(friend);
                }
            }
            return;
        } else {
            if (!friend && Game.roomsHelper.getHostilesCount(creep.memory.roomName, 0) > 1) {
                creep.moveTo(Game.spawns[creep.memory.spawnName]);
                return;
            }
        }

        let target = creep.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
        if (target && friend && (!creep.pos.inRangeTo(friend, 4) || friend.hits < friend.hitsMax) && !creep.pos.inRangeTo(target, 4) && friend.room.name == creep.room.name) {
            if (!friend.memory.gotoFriendID) {
                creep.moveTo(friend);
                creep.memory.gotoFriendID = friend.id;
            } else if (creep.pos.isBorder()) {
                creep.moveTo(friend);
            }
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
            creep.moveTo(safePlace ? safePlace : target);
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
	
    create: function(energy, attack) {
        // 10 * 6 + 150 * 20 + 250 * 3 + 50 * 15 = 4560
        // 10 * 6 + 80 * 22  + 250 * 5 + 50 * 17 = 3920
        let tnum = attack ? 6 : 6;
        let anum = attack ? 22 : 0;
        let rnum = attack ? 0 : 20;
        let hnum = attack ? 5 : 3;
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
profiler.registerObject(role, 'roleAntikeeper');