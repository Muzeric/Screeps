var utils = require('utils');

var role = {

    run: function(creep) {
        let healed = 0;
        if (creep.hits < creep.hitsMax && creep.getActiveBodyparts(HEAL)) {
            creep.heal(creep);
            healed = 1;
        }
	    
        if (creep.room.name != creep.memory.roomName) {
            if (!Game.flags["Antikeeper." + creep.memory.roomName]) {
                console.log(creep.name + " no flag in " + creep.memory.roomName);
                return;
            }
            creep.moveTo(Game.flags["Antikeeper." + creep.memory.roomName]);
            return;
        }

        let target = creep.pos.findClosestByPath(FIND_HOSTILE_CREEPS);
        let seeked;
        if (target) {
            let safePlace;
            if (!creep.memory.arg) {
                safePlace = creep.pos.findClosestByPath(utils.getRangedPlaces(creep, target.pos, 3));
                creep.rangedAttack(target);
            } else {
                if (creep.pos.isNearTo(target)) {
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
                if (!moved)
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
        // 10 * 6 + 150 * 20 + 50 * 15 + 250 * 3 = 4560
        // 10 * 6 + 80 * 21 + 50 * 16  + 250 * 5 = 3790
        let tnum = hostiles ? 6 : 6;
        let anum = hostiles ? 21 : 0;
        let rnum = hostiles ? 0 : 20;
        let hnum = hostiles ? 5 : 3;
        let mnum = Math.ceil((tnum + anum + rnum + hnum)/2);
        energy -= 10 * tnum + 80 * anum + 150 * rnum + 50 * mnum + 250 * hnum;
        
        let body = [];
        
        while (tnum-- > 0)
            body.push(TOUGH);
        while (mnum-- > 0)
            body.push(MOVE);
        while (anum-- > 0)
            body.push(ATTACK);
        while (rnum-- > 0)
            body.push(RANGED_ATTACK);
        while (hnum-- > 0)
            body.push(HEAL);
        
        return [body, energy];
	},
};

module.exports = role;